import { test, expect } from "./fixtures.js";

// Dos atajos para trabajar a más prospectos con menos toques:
//  - Búsqueda global: los resultados con teléfono ofrecen «Llamar» y «WhatsApp» directo; en un prospecto,
//    además, su ficha se abre con «Registrar contacto» ya listo (canal elegido).
//  - Prospectos en lote: elegir varios y cambiarles de etapa, de asesor o el seguimiento de una vez.

const ahora = () => new Date().toISOString();

const prospecto = (id, name, extra = {}) => ({
  id,
  name,
  phone: "8715550101",
  email: null,
  source: "manual",
  stage: "nuevo",
  advisor_id: "advisor-1",
  property_id: null,
  looking_for: null,
  notes: null,
  last_contact_at: null,
  next_followup_at: null,
  lost_reason: null,
  created_at: ahora(),
  updated_at: ahora(),
  ...extra,
});

const cliente = (id, name, phone) => ({ id, name, type: "comprador", email: null, phone, notes: null, active: true, financiamiento: null, created_at: ahora(), updated_at: ahora() });

const leer = (page, clave) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "[]"), clave);
const guardar = (page, clave, valor) => page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [clave, valor]);

test.describe("Búsqueda global: llamar y escribir desde el resultado", () => {
  test.beforeEach(async ({ seedAdminSession }) => {
    await seedAdminSession();
  });

  async function sembrarYBuscar(page, go, press, texto) {
    await go("/admin/prospectos");
    await guardar(page, "acl_local_prospectos", [prospecto("bq-p", "Pedro Busqueda QA", { phone: "871 555 0123" }), prospecto("bq-s", "Sin Telefono Busqueda QA", { phone: "" })]);
    await guardar(page, "acl_local_clients", [cliente("bq-c", "Rosa Busqueda QA", "871 555 0199")]);
    await go("/admin/mi-dia");
    // Los enlaces tel: no se siguen en la prueba (el navegador de pruebas no tiene a dónde marcar).
    await page.evaluate(() => document.addEventListener("click", (e) => e.target.closest?.("a[href^='tel:']") && e.preventDefault(), true));
    const campo = page.locator(".admin-search__input");
    await press(campo);
    await campo.fill(texto);
    await expect(page.locator(".admin-search__row").first()).toBeVisible();
  }

  test("los resultados con teléfono traen «Llamar» y «WhatsApp»; los que no, no", async ({ page, go, press }) => {
    await sembrarYBuscar(page, go, press, "Busqueda QA");
    const fila = (nombre) => page.locator(".admin-search__row", { hasText: nombre });

    await expect(fila("Rosa Busqueda QA").getByRole("link", { name: "Llamar a Rosa Busqueda QA" })).toHaveAttribute("href", "tel:+528715550199");
    await expect(fila("Rosa Busqueda QA").getByRole("link", { name: "WhatsApp a Rosa Busqueda QA" })).toHaveAttribute("href", "https://wa.me/528715550199");
    await expect(fila("Pedro Busqueda QA").getByRole("link", { name: /^Llamar a/ })).toHaveAttribute("href", "tel:+528715550123");
    await expect(fila("Sin Telefono Busqueda QA").locator(".admin-search__action")).toHaveCount(0);
  });

  test("«Llamar» a un cliente solo cierra la búsqueda (no cambia de pantalla)", async ({ page, go, press }) => {
    await sembrarYBuscar(page, go, press, "Rosa Busqueda");
    await press(page.getByRole("link", { name: "Llamar a Rosa Busqueda QA" }));
    await expect(page.locator(".admin-search__panel")).toBeHidden();
    expect(new URL(page.url()).pathname).toBe("/admin/mi-dia");
  });

  test("«Llamar» a un prospecto abre su ficha con «Registrar contacto» listo y la llamada elegida", async ({ page, go, press }) => {
    await sembrarYBuscar(page, go, press, "Pedro Busqueda");
    await press(page.getByRole("link", { name: "Llamar a Pedro Busqueda QA" }));
    await page.waitForURL("**/admin/prospectos/bq-p");
    const formulario = page.locator(".prospect-profile form.contact-form");
    await expect(formulario).toBeVisible();
    await expect(formulario.getByRole("radio", { name: "Llamada" })).toBeChecked();
    // Un toque de resultado y queda registrada.
    await press(formulario.getByRole("button", { name: "No contestó" }));
    await expect(formulario).toHaveCount(0);
    const [guardado] = (await leer(page, "acl_local_prospect_contacts")).slice(-1);
    expect(guardado).toMatchObject({ prospecto_id: "bq-p", channel: "llamada", note: "No contestó" });
  });

  test("«WhatsApp» a un prospecto abre el chat en otra pestaña y su ficha con el canal WhatsApp", async ({ page, go, press }) => {
    await sembrarYBuscar(page, go, press, "Pedro Busqueda");
    const [chat] = await Promise.all([page.waitForEvent("popup"), press(page.getByRole("link", { name: "WhatsApp a Pedro Busqueda QA" }))]);
    await chat.close();
    await page.waitForURL("**/admin/prospectos/bq-p");
    const formulario = page.locator(".prospect-profile form.contact-form");
    await expect(formulario).toBeVisible();
    await expect(formulario.getByRole("radio", { name: "WhatsApp" })).toBeChecked();
  });

  test("al recargar la ficha el formulario no se reabre solo (el aviso se consume)", async ({ page, go, press }) => {
    await sembrarYBuscar(page, go, press, "Pedro Busqueda");
    await press(page.getByRole("link", { name: "Llamar a Pedro Busqueda QA" }));
    await page.waitForURL("**/admin/prospectos/bq-p");
    await expect(page.locator(".prospect-profile form.contact-form")).toBeVisible();
    await go("/admin/prospectos/bq-p");
    await expect(page.locator(".prospect-profile")).toBeVisible();
    await expect(page.locator(".prospect-profile form.contact-form")).toHaveCount(0);
  });
});

const enDias = (dias) => new Date(Date.now() + dias * 864e5).toLocaleDateString("en-CA");

test.describe("Prospectos en lote", () => {
  test.beforeEach(async ({ seedAdminSession }) => {
    await seedAdminSession();
  });

  async function sembrar(page, go, rows) {
    await go("/admin/prospectos");
    await guardar(page, "acl_local_prospectos", rows);
    await go("/admin/prospectos");
  }

  const tarjeta = (page, nombre) => page.locator(".prospect-card", { hasText: nombre });
  const barra = (page) => page.getByRole("region", { name: "Acciones en lote" });

  test("«Seleccionar» muestra las casillas, cuenta los elegidos y «Salir de selección» las quita", async ({ page, go, press }) => {
    await sembrar(page, go, [prospecto("l1", "Lote Uno QA"), prospecto("l2", "Lote Dos QA"), prospecto("l3", "Lote Tres QA")]);
    await expect(page.locator(".prospect-card__pick")).toHaveCount(0);

    await press(page.getByRole("button", { name: "Seleccionar", exact: true }));
    await expect(page.locator(".prospect-card__pick")).toHaveCount(3);
    await expect(barra(page)).toContainText("Toca los prospectos");

    await press(tarjeta(page, "Lote Uno QA").getByRole("checkbox"));
    await press(tarjeta(page, "Lote Dos QA").getByRole("checkbox"));
    await expect(barra(page)).toContainText("2 seleccionados");
    await expect(tarjeta(page, "Lote Uno QA")).toHaveClass(/is-selected/);

    await press(barra(page).getByRole("button", { name: "Cancelar selección" }));
    await expect(barra(page)).toContainText("Toca los prospectos");
    await expect(page.locator(".prospect-card.is-selected")).toHaveCount(0);

    await press(page.getByRole("button", { name: "Salir de selección" }));
    await expect(page.locator(".prospect-card__pick")).toHaveCount(0);
    await expect(barra(page)).toHaveCount(0);
  });

  test("elegir todos de una etapa y moverlos de etapa: se actualizan todos y el tablero los sigue", async ({ page, go, press }) => {
    await sembrar(page, go, [prospecto("l1", "Etapa Uno QA"), prospecto("l2", "Etapa Dos QA"), prospecto("l3", "Etapa Tres QA")]);
    await press(page.getByRole("button", { name: "Seleccionar", exact: true }));
    await press(page.getByLabel(/Seleccionar todos \(3\)/));
    await expect(barra(page)).toContainText("3 seleccionados");

    await press(barra(page).getByRole("button", { name: /^Acciones/ }));
    await barra(page).getByLabel("Mover a etapa", { exact: true }).selectOption("interesado");
    await press(barra(page).getByRole("button", { name: "Aplicar: Mover a etapa" }));
    await expect(barra(page).getByRole("status")).toContainText("Listo: 3 actualizados.");

    const guardados = await leer(page, "acl_local_prospectos");
    expect(guardados.map((p) => p.stage)).toEqual(["interesado", "interesado", "interesado"]);
    // Las tarjetas siguen a la vista (en el teléfono, la pestaña se fue a «Interesado»).
    await expect(tarjeta(page, "Etapa Dos QA")).toBeVisible();
  });

  test("seguimiento en lote: lo pone a los de etapa abierta y avisa de los que no aplican (cerrados)", async ({ page, go, press }) => {
    await sembrar(page, go, [
      prospecto("s1", "Sigue Uno QA", { stage: "contactado", last_contact_at: ahora() }),
      prospecto("s2", "Sigue Dos QA", { stage: "interesado", last_contact_at: ahora(), next_followup_at: enDias(10) }),
      prospecto("s3", "Sigue Cerrado QA", { stage: "contactado", last_contact_at: ahora() }),
    ]);
    // El tercero se cierra a mano para que no aplique el seguimiento.
    await press(page.getByRole("button", { name: "Seleccionar", exact: true }));
    await press(tarjeta(page, "Sigue Uno QA").getByRole("checkbox"));
    await press(barra(page).getByRole("button", { name: /^Acciones/ }));
    await press(barra(page).getByRole("button", { name: "En 3 días" }));
    await expect(barra(page).getByRole("status")).toContainText("Listo: 1 actualizado.");

    let guardados = await leer(page, "acl_local_prospectos");
    expect(guardados.find((p) => p.id === "s1").next_followup_at).toBe(enDias(3));
    expect(guardados.find((p) => p.id === "s2").next_followup_at).toBe(enDias(10)); // no estaba elegido

    // Con un cerrado en la selección, ese no se toca y se avisa.
    await page.evaluate(() => {
      const rows = JSON.parse(localStorage.getItem("acl_local_prospectos"));
      rows.find((p) => p.id === "s3").stage = "cerrado";
      localStorage.setItem("acl_local_prospectos", JSON.stringify(rows));
    });
    await go("/admin/prospectos");
    await press(page.getByRole("button", { name: "Seleccionar", exact: true }));
    // En el teléfono se ve una etapa a la vez: se eligen las dos que hay en «Contactado»/«Cerrado» desde su pestaña.
    const pestana = (nombre) => page.getByRole("group", { name: "Etapas del embudo" }).getByRole("button", { name: new RegExp(`^${nombre}`) });
    if (await pestana("Cerrado").isVisible()) await press(pestana("Cerrado"));
    await press(tarjeta(page, "Sigue Cerrado QA").getByRole("checkbox"));
    if (await pestana("Contactado").isVisible()) await press(pestana("Contactado"));
    await press(tarjeta(page, "Sigue Uno QA").getByRole("checkbox"));
    await press(barra(page).getByRole("button", { name: /^Acciones/ }));
    await press(barra(page).getByRole("button", { name: "Sin fecha" }));
    await expect(barra(page).getByRole("status")).toContainText("Listo: 1 actualizado.");
    await expect(barra(page).getByRole("status")).toContainText("1 sin cambios");
    guardados = await leer(page, "acl_local_prospectos");
    expect(guardados.find((p) => p.id === "s1").next_followup_at).toBeNull();
    expect(guardados.find((p) => p.id === "s3").next_followup_at).toBeNull();
  });

  test("la oficina reasigna a otro asesor a los elegidos", async ({ page, go, press }) => {
    await sembrar(page, go, [prospecto("a1", "Asesor Uno QA"), prospecto("a2", "Asesor Dos QA")]);
    await press(page.getByRole("button", { name: "Seleccionar", exact: true }));
    await press(page.getByLabel(/Seleccionar todos \(2\)/));
    await press(barra(page).getByRole("button", { name: /^Acciones/ }));
    await barra(page).getByLabel("Reasignar a", { exact: true }).selectOption({ label: "Ana Martínez" });
    await press(barra(page).getByRole("button", { name: "Aplicar: Reasignar a" }));
    await expect(barra(page).getByRole("status")).toContainText("Listo: 2 actualizados.");
    const guardados = await leer(page, "acl_local_prospectos");
    expect(guardados.map((p) => p.advisor_id)).toEqual(["advisor-2", "advisor-2"]);
  });

  test("un filtro nuevo no deja aplicar acciones a prospectos que ya no se ven", async ({ page, go, press }) => {
    await sembrar(page, go, [prospecto("f1", "Filtra Uno QA"), prospecto("f2", "Filtra Dos QA")]);
    await press(page.getByRole("button", { name: "Seleccionar", exact: true }));
    await press(page.getByLabel(/Seleccionar todos \(2\)/));
    await expect(barra(page)).toContainText("2 seleccionados");
    await page.getByRole("searchbox", { name: /nombre, teléfono o propiedad/ }).fill("Uno");
    await expect(barra(page)).toContainText("1 seleccionado");
  });
});
