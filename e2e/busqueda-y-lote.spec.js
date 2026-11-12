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
