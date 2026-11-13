import { test, expect, expectHealthyPage } from "./fixtures.js";

// Lista de Asesores (la oficina): por asesor, de un vistazo, prospectos abiertos y cuántos piden atención, propiedades disponibles,
// visitas del mes, citas que le quedan hoy y si está ausente; cada cifra con algo lleva a Prospectos ya filtrado.

const hace = (horas) => new Date(Date.now() - horas * 3600000).toISOString();
const dia = (n) => new Date(Date.now() + n * 864e5).toLocaleDateString("en-CA");
const poner = (page, clave, valor) => page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [clave, valor]);

const prospecto = (id, advisor_id, extra = {}) => ({
  id,
  name: `Prospecto ${id} QA`,
  phone: "8715550101",
  email: null,
  source: "manual",
  stage: "contactado",
  advisor_id,
  property_id: null,
  looking_for: null,
  notes: null,
  last_contact_at: hace(24),
  next_followup_at: dia(3),
  lost_reason: null,
  created_at: hace(24 * 20),
  updated_at: hace(24),
  ...extra,
});

const propiedad = (id, advisor_ids, extra = {}) => ({
  id,
  code: id.toUpperCase(),
  title: `Casa ${id} QA`,
  type: "casa",
  description: "x",
  price: 1000000,
  area_m2: 100,
  bedrooms: 3,
  bathrooms: 2,
  parking: 1,
  zone: "Lerdo",
  address: "Calle 1",
  lat: 25.5,
  lng: -103.5,
  status: "disponible",
  operation_type: "compra",
  active: true,
  main_image: "",
  images: [],
  advisor_ids,
  created_at: hace(500),
  updated_at: hace(500),
  ...extra,
});

test.describe("Lista de Asesores", () => {
  test.beforeEach(async ({ seedAdminSession }) => {
    await seedAdminSession();
  });

  test("cada asesor con sus números, lo que pide atención enlaza a Prospectos filtrado, y los ausentes se marcan", async ({ page, go, press }) => {
    await go("/admin/asesores");
    const hoy = new Date().toISOString().slice(0, 10);
    await poner(page, "acl_local_prospectos", [
      prospecto("a", "advisor-1"),
      prospecto("b", "advisor-1", { next_followup_at: dia(-2) }), // seguimiento vencido
      prospecto("c", "advisor-1", { stage: "nuevo", source: "sitio", last_contact_at: null, next_followup_at: null, created_at: hace(30) }), // entrante sin atender, ya tarde
      prospecto("d", "advisor-1", { stage: "cerrado" }), // no cuenta
      prospecto("e", "advisor-2"),
    ]);
    await poner(page, "acl_local_properties", [propiedad("h1", ["advisor-1"]), propiedad("h2", ["advisor-1", "advisor-2"]), propiedad("h3", ["advisor-1"], { status: "vendida" })]);
    await poner(page, "acl_local_visits", [
      { id: "v1", property_id: "h1", advisor_id: "advisor-1", visited_at: `${hoy}T09:00:00`, interest: "interesado", prospect_name: "X" },
    ]);
    await poner(page, "acl_local_visit_schedules", { "advisor-1": { settings: { enabled: false, slot_minutes: 60, min_notice_hours: 2, horizon_days: 14 }, weekly: [], timeOff: [{ id: "o1", fecha_inicio: dia(-1), fecha_fin: dia(2), motivo: null }] } });
    await go("/admin/asesores");

    const fila = page.locator('tr[data-advisor="advisor-1"]');
    await expect(fila).toContainText("Carlos Delgado");
    await expect(fila.locator(".cell-open")).toHaveText(/^\s*(Prospectos abiertos\s*)?3\s*$/);
    await expect(fila.locator(".cell-unat")).toContainText("1");
    await expect(fila.locator(".cell-over")).toContainText("1");
    await expect(fila.locator(".cell-props")).toContainText("2"); // h1 y h2; la vendida no
    await expect(fila.locator(".cell-visits")).toContainText("1");
    await expect(fila.locator("[data-away]")).toContainText("Ausente hasta el");
    await expect(page.locator('tr[data-advisor="advisor-2"] .cell-open')).toContainText("1");
    await expect(page.locator('tr[data-advisor="advisor-2"] [data-away]')).toHaveCount(0);

    // Totales del equipo.
    await expect(page.locator('[data-total="openProspects"] strong')).toHaveText("4");
    await expect(page.locator('[data-total="unattended"] strong')).toHaveText("1");

    // Las cifras con algo llevan a Prospectos ya filtrado por ese asesor.
    await expect(fila.locator(".cell-unat a")).toHaveAttribute("href", "/admin/prospectos?asesor=advisor-1&filtro=sin-atender");
    await expect(fila.locator(".cell-over a")).toHaveAttribute("href", "/admin/prospectos?asesor=advisor-1&filtro=vencidos");
    await press(fila.locator(".cell-open a"));
    await expect(page).toHaveURL(/\/admin\/prospectos\?asesor=advisor-1$/);
  });

  test("editar y eliminar siguen ahí y la lista cabe en el teléfono", async ({ page, go }) => {
    await go("/admin/asesores");
    const fila = page.locator('tr[data-advisor="advisor-1"]');
    await expect(fila.getByRole("link", { name: "Editar" })).toHaveAttribute("href", "/admin/asesores/advisor-1");
    await expect(fila.getByRole("button", { name: "Eliminar" })).toBeVisible();
    await expect(fila.locator(".badge").first()).toBeVisible();
    await expectHealthyPage(page);
  });
});
