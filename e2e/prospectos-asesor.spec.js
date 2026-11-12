import { test, expect, isoDate, abrirMas } from "./fixtures.js";

// Lo que el asesor hace a diario con un prospecto, sin cambiar de pantalla ni volver a teclear datos:
//  - «Agendar» abre la cita ya llena (título, propiedad, contacto, prospecto) y solo falta fecha y hora;
//  - la ficha del prospecto muestra primero el resumen y las acciones, con la edición plegada;
//  - en el teléfono Prospectos se ve una etapa a la vez, con pestañas y contadores.

const hoy = () => new Date().toISOString();

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
  created_at: hoy(),
  updated_at: hoy(),
  ...extra,
});

// Deja los prospectos en el almacenamiento del modo demo y recarga la pantalla pedida.
async function sembrar(page, go, rows, ruta) {
  await go("/admin/prospectos");
  await page.evaluate((r) => localStorage.setItem("acl_local_prospectos", JSON.stringify(r)), rows);
  await go(ruta);
}

const leer = (page, clave) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "[]"), clave);

test.describe("Prospectos: acciones del día a día", () => {
  test.beforeEach(async ({ seedAdminSession }) => {
    await seedAdminSession();
  });

  test("«Agendar» desde la tarjeta abre la cita ya llena; solo falta fecha y hora, y queda ligada al prospecto", async ({ page, go, press }) => {
    test.setTimeout(60_000);
    const p = prospecto("p-agendar", "Marina Agendar QA", { property_id: "prop-1", looking_for: "Casa de 3 recámaras", email: "marina@example.com" });
    await sembrar(page, go, [p], "/admin/prospectos");

    const tarjeta = page.locator(".prospect-card", { hasText: p.name });
    await abrirMas(tarjeta, press);
    await press(tarjeta.getByRole("link", { name: "Agendar", exact: true }));
    await page.waitForURL("**/admin/agenda/nueva");

    await test.step("llega con todo puesto", async () => {
      await expect(page.locator("#cita-titulo")).toHaveValue("Visita: Casa en Residencial Senderos");
      await expect(page.locator("#cita-propiedad")).toHaveValue("prop-1");
      await expect(page.locator("#cita-contact-name")).toHaveValue(p.name);
      await expect(page.locator("#cita-contact-phone")).toHaveValue(p.phone);
      await expect(page.locator("#cita-contact-email")).toHaveValue(p.email);
      await expect(page.locator("#cita-actividades")).toHaveValue("Busca: Casa de 3 recámaras");
      await expect(page.getByTestId("cita-prospecto")).toContainText("ligada a un prospecto");
    });

    await test.step("con fecha y hora se guarda y abre el enlace para mandárselo", async () => {
      await page.fill("#cita-fecha", isoDate(3));
      await page.fill("#cita-hora", "11:30");
      await press(page.locator("form button[type=submit]"));
      await page.waitForURL(/\/admin\/agenda\/(?!nueva)[^/]+$/);
      await expect(page.getByRole("status").filter({ hasText: /cita/i }).first()).toBeVisible();
      const [cita] = await leer(page, "acl_local_agenda_citas");
      expect(cita).toMatchObject({ prospecto_id: "p-agendar", property_id: "prop-1", titulo: "Visita: Casa en Residencial Senderos", contact_name: p.name, hora: "11:30" });
    });
  });

  test("«Cancelar» regresa a Prospectos, no a la agenda", async ({ page, go, press }) => {
    const p = prospecto("p-cancelar", "Cancelar QA", { property_id: "prop-1" });
    await sembrar(page, go, [p], "/admin/prospectos");
    const tarjeta = page.locator(".prospect-card", { hasText: p.name });
    await abrirMas(tarjeta, press);
    await press(tarjeta.getByRole("link", { name: "Agendar", exact: true }));
    await page.waitForURL("**/admin/agenda/nueva");
    await press(page.getByRole("button", { name: "Cancelar" }));
    await page.waitForURL("**/admin/prospectos");
  });

  test("en Mi día el prospecto pendiente también tiene «Agendar»", async ({ page, go, press }) => {
    const p = prospecto("p-midia", "Mi Día QA", { source: "sitio", created_at: new Date(Date.now() - 5 * 3600e3).toISOString() });
    await sembrar(page, go, [p], "/admin/mi-dia");
    const item = page.locator(".my-day__item", { hasText: p.name });
    await press(item.getByRole("link", { name: "Agendar", exact: true }));
    await page.waitForURL("**/admin/agenda/nueva");
    await expect(page.locator("#cita-titulo")).toHaveValue(`Cita con ${p.name}`);
    await expect(page.locator("#cita-contact-name")).toHaveValue(p.name);
  });

  test("la ficha muestra primero el resumen y las acciones; la edición va plegada y registrar contacto actualiza todo", async ({ page, go, press }) => {
    test.setTimeout(60_000);
    const p = prospecto("p-ficha", "Ficha Completa QA", {
      source: "sitio",
      property_id: "prop-1",
      looking_for: "Departamento céntrico",
      notes: "Mensaje de WhatsApp: busco algo cerca del trabajo",
      created_at: new Date(Date.now() - 6 * 3600e3).toISOString(),
    });
    await sembrar(page, go, [p], `/admin/prospectos/${p.id}`);

    await test.step("resumen y acciones a la vista", async () => {
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(p.name);
      const ficha = page.locator(".prospect-profile");
      await expect(ficha).toContainText("Casa en Residencial Senderos");
      await expect(ficha).toContainText("Departamento céntrico");
      await expect(ficha).toContainText("busco algo cerca del trabajo");
      await expect(ficha).toContainText("Sin contacto aún");
      await expect(ficha.locator(".prospect-chip", { hasText: /Sin atender/ })).toBeVisible();
      await expect(ficha.getByRole("link", { name: "Llamar" })).toHaveAttribute("href", "tel:+528715550101");
      await expect(ficha.getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", "https://wa.me/528715550101");
      await expect(ficha.getByRole("link", { name: "Agendar", exact: true })).toBeVisible();
      await expect(ficha.locator("select.quick-reply-select")).toBeVisible();
    });

    await test.step("el formulario de edición está plegado hasta que se pide", async () => {
      const edicion = page.locator("details.prospect-edit");
      await expect(edicion).toHaveJSProperty("open", false);
      await expect(page.locator("#pr-name")).toBeHidden();
      await press(edicion.locator("summary"));
      await expect(page.locator("#pr-name")).toHaveValue(p.name);
    });

    await test.step("registrar contacto desde la ficha: historial, último contacto y etapa se actualizan", async () => {
      const ficha = page.locator(".prospect-profile");
      await press(ficha.getByRole("button", { name: "Registrar contacto" }));
      const formulario = ficha.locator("form.contact-form");
      await expect(formulario).toBeVisible();
      await press(formulario.getByText("Llamada", { exact: true }));
      await press(formulario.getByRole("button", { name: "En 3 días" }));
      await press(formulario.locator("button[type=submit]"));
      await expect(formulario).toHaveCount(0);
      await expect(ficha).toContainText("Último contacto: hoy");
      await expect(ficha.locator(".prospect-chip", { hasText: /Sin atender/ })).toHaveCount(0);
      await expect(ficha.locator("select[aria-label='Etapa']")).toHaveValue("contactado");
      await expect(page.locator(".contact-history__item")).toHaveCount(1);
      const [guardado] = await leer(page, "acl_local_prospectos");
      expect(guardado).toMatchObject({ stage: "contactado" });
      expect(guardado.next_followup_at).toBeTruthy();
    });

    await test.step("cambiar de etapa desde la ficha", async () => {
      await page.locator(".prospect-profile select[aria-label='Etapa']").selectOption("interesado");
      await expect(page.locator(".prospect-profile .prospect-chip", { hasText: "Interesado" })).toBeVisible();
      const [guardado] = await leer(page, "acl_local_prospectos");
      expect(guardado.stage).toBe("interesado");
    });
  });

  test("una cita agendada desde la ficha regresa a la ficha al cancelar", async ({ page, go, press }) => {
    const p = prospecto("p-ficha-agendar", "Ficha Agendar QA");
    await sembrar(page, go, [p], `/admin/prospectos/${p.id}`);
    await press(page.locator(".prospect-profile").getByRole("link", { name: "Agendar", exact: true }));
    await page.waitForURL("**/admin/agenda/nueva");
    await press(page.getByRole("button", { name: "Cancelar" }));
    await page.waitForURL(`**/admin/prospectos/${p.id}`);
  });

  test("el tablero: una etapa a la vez con pestañas en el teléfono; todas las columnas en pantalla ancha", async ({ page, go, press, isMobile }) => {
    const filas = [
      prospecto("t1", "Nuevo Uno QA"),
      prospecto("t2", "Nuevo Dos QA"),
      prospecto("t3", "Contactado Uno QA", { stage: "contactado", last_contact_at: hoy() }),
      prospecto("t4", "Negociacion Uno QA", { stage: "negociacion", last_contact_at: hoy() }),
    ];
    await sembrar(page, go, filas, "/admin/prospectos");
    const tarjeta = (nombre) => page.locator(".prospect-card", { hasText: nombre });
    const pestañas = page.getByRole("group", { name: "Etapas del embudo" });

    if (!isMobile) {
      await expect(pestañas).toBeHidden();
      for (const f of filas) await expect(tarjeta(f.name)).toBeVisible();
      return;
    }

    await test.step("se abre en la primera etapa con prospectos y cada pestaña lleva su contador", async () => {
      await expect(pestañas).toBeVisible();
      await expect(pestañas.getByRole("button", { name: /^Nuevo\s*2$/ })).toHaveAttribute("aria-pressed", "true");
      await expect(pestañas.getByRole("button", { name: /^Contactado\s*1$/ })).toBeVisible();
      await expect(pestañas.getByRole("button", { name: /^Interesado\s*0$/ })).toBeVisible();
      await expect(tarjeta("Nuevo Uno QA")).toBeVisible();
      await expect(tarjeta("Nuevo Dos QA")).toBeVisible();
      await expect(tarjeta("Contactado Uno QA")).toBeHidden();
    });

    await test.step("tocar otra pestaña cambia de etapa", async () => {
      await press(pestañas.getByRole("button", { name: /^En negociación/ }));
      await expect(tarjeta("Negociacion Uno QA")).toBeVisible();
      await expect(tarjeta("Nuevo Uno QA")).toBeHidden();
    });

    await test.step("al cambiar la etapa de una tarjeta, la pestaña la sigue", async () => {
      await press(pestañas.getByRole("button", { name: /^Nuevo/ }));
      const t = tarjeta("Nuevo Dos QA");
      await abrirMas(t, press);
      await t.getByLabel("Etapa").selectOption("interesado");
      await expect(pestañas.getByRole("button", { name: /^Interesado\s*1$/ })).toHaveAttribute("aria-pressed", "true");
      await expect(tarjeta("Nuevo Dos QA")).toBeVisible();
    });

    await test.step("la tarjeta es compacta: mensaje, llamar y «Más»; eliminar queda oculto hasta abrir «Más»", async () => {
      await press(pestañas.getByRole("button", { name: /^Nuevo/ }));
      const t = tarjeta("Nuevo Uno QA");
      await expect(t.locator("select.quick-reply-select")).toBeVisible();
      await expect(t.getByRole("link", { name: "Llamar" })).toBeVisible();
      await expect(t.getByRole("button", { name: "Eliminar" })).toBeHidden();
      await abrirMas(t, press);
      await expect(t.getByRole("button", { name: "Eliminar" })).toBeVisible();
    });
  });

  test("el botón «+» ofrece prospecto, cita y visita; la cita y la visita regresan a donde se estaba al cancelar", async ({ page, go, press }) => {
    await go("/admin/mi-dia");
    const mas = page.getByRole("button", { name: "Acciones rápidas" });
    const menu = page.getByRole("menu", { name: "Acciones rápidas" });

    await test.step("el menú trae las tres acciones y se cierra con Escape o tocando fuera", async () => {
      await press(mas);
      await expect(mas).toHaveAttribute("aria-expanded", "true");
      await expect(menu.getByRole("menuitem")).toHaveText(["Prospecto rápido", "Nueva cita", "Registrar visita"]);
      await page.keyboard.press("Escape");
      await expect(menu).toBeHidden();
      await press(mas);
      await page.mouse.click(5, 120);
      await expect(menu).toBeHidden();
    });

    await test.step("«Nueva cita» abre el formulario y «Cancelar» regresa a Mi día", async () => {
      await press(mas);
      await press(menu.getByRole("menuitem", { name: "Nueva cita" }));
      await page.waitForURL("**/admin/agenda/nueva");
      await expect(menu).toBeHidden();
      await press(page.getByRole("button", { name: "Cancelar" }));
      await page.waitForURL("**/admin/mi-dia");
    });

    await test.step("«Registrar visita» abre el formulario de visitas", async () => {
      await press(mas);
      await press(menu.getByRole("menuitem", { name: "Registrar visita" }));
      await page.waitForURL("**/admin/visitas/nueva");
      await press(page.getByRole("link", { name: "Cancelar" }));
      await page.waitForURL("**/admin/mi-dia");
    });
  });
});
