import { test, expect } from "./fixtures.js";

// Equipo hoy: el resumen del día para la oficina. Por asesor, lo que se le queda sin atender (entrantes sin atender, seguimientos
// vencidos, prospectos que nadie ha tocado en una semana) y lo del día, con enlaces a Prospectos ya filtrado y «Reasignar…».
// Modo demo: el administrador demo no tiene asesor propio, o sea que ve a todo el equipo (como la oficina).

const hace = (horas) => new Date(Date.now() - horas * 3600000).toISOString();
const dia = (n) => new Date(Date.now() + n * 864e5).toLocaleDateString("en-CA");
const hoy = () => dia(0);

const prospecto = (id, name, advisor_id, extra = {}) => ({
  id,
  name,
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

const cita = (id, over) => ({
  id,
  advisor_id: "advisor-1",
  client_id: null,
  property_id: null,
  prospecto_id: null,
  titulo: id,
  fecha: hoy(),
  hora: "23:59",
  actividades: null,
  lugar: null,
  contact_name: null,
  contact_phone: null,
  contact_email: null,
  status: "confirmada",
  source: "admin",
  booking_token: id.padEnd(32, "0").slice(0, 32),
  created_at: hace(1),
  updated_at: hace(1),
  ...over,
});

const poner = (page, clave, valor) => page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [clave, valor]);

test.describe("Equipo hoy (oficina)", () => {
  test.beforeEach(async ({ seedAdminSession }) => {
    await seedAdminSession();
  });

  test("cada asesor con sus números, el que más atención pide primero, lo que no tiene dueño aparte, y los números llevan a Prospectos filtrado", async ({
    page,
    go,
    press,
  }) => {
    await go("/admin/equipo");
    await poner(page, "acl_local_prospectos", [
      // Carlos (advisor-1): un entrante sin atender hace 6 h (urgente), un seguimiento vencido y uno olvidado
      prospecto("c-nuevo", "Carlos Entrante QA", "advisor-1", { stage: "nuevo", source: "sitio", last_contact_at: null, next_followup_at: null, created_at: hace(6) }),
      prospecto("c-vencido", "Carlos Vencido QA", "advisor-1", { next_followup_at: dia(-2) }),
      prospecto("c-olvidado", "Carlos Olvidado QA", "advisor-1", { next_followup_at: null, last_contact_at: hace(24 * 12) }),
      // Ana (advisor-2): todo al día
      prospecto("a-ok", "Ana Al Dia QA", "advisor-2"),
      // Sin asesor: nadie le da seguimiento
      prospecto("s-vencido", "Huerfano Vencido QA", null, { next_followup_at: dia(-5) }),
    ]);
    await poner(page, "acl_local_agenda_citas", [
      cita("cita-carlos-hoy", { titulo: "Visita de hoy QA" }),
      cita("sol-1", { advisor_id: null, status: "solicitada", source: "sitio", fecha: dia(1), hora: "10:00" }),
    ]);
    await go("/admin/equipo");
    await expect(page.getByRole("heading", { name: "Equipo hoy", level: 1 })).toBeVisible();

    await test.step("totales del equipo y solicitudes de visita sin tomar", async () => {
      const total = (clave) => page.locator(`[data-total="${clave}"] strong`);
      await expect(total("unattended")).toHaveText("1");
      await expect(total("overdue")).toHaveText("2"); // el de Carlos y el de sin asesor
      await expect(total("forgotten")).toHaveText("1");
      await expect(total("agendaToday")).toHaveText("1");
      await expect(total("toClose")).toHaveText("0");
      await expect(page.getByRole("status").filter({ hasText: "solicitud" })).toContainText("1 solicitud de visita del sitio sin tomar.");
    });

    await test.step("tarjetas: sin asesor primero, luego el que más atención pide, y los que están al día", async () => {
      const orden = await page.locator(".team-card").evaluateAll((els) => els.map((e) => e.getAttribute("data-advisor")));
      expect(orden).toEqual(["ninguno", "advisor-1", "advisor-2", "advisor-3"]);
      const carlos = page.locator('[data-advisor="advisor-1"]');
      await expect(carlos).toContainText("Carlos Delgado");
      await expect(carlos).toContainText("Urgente");
      await expect(carlos.locator('[data-tile="unattended"]')).toContainText("1 urgente");
      await expect(carlos.locator('[data-tile="overdue"] strong')).toHaveText("1");
      await expect(carlos.locator('[data-tile="forgotten"] strong')).toHaveText("1");
      await expect(carlos.locator('[data-tile="agendaToday"] strong')).toHaveText("1");
      for (const id of ["advisor-2", "advisor-3"]) {
        const al_dia = page.locator(`[data-advisor="${id}"]`);
        await expect(al_dia).toContainText("Al día");
        await expect(al_dia.getByRole("link", { name: "Reasignar…" })).toHaveCount(0);
      }
      const huerfano = page.locator('[data-advisor="ninguno"]');
      await expect(huerfano).toContainText("Sin asesor");
      await expect(huerfano).toContainText("nadie les da seguimiento");
      await expect(huerfano.locator('[data-tile="agendaToday"]')).toHaveCount(0); // sin citas: no son de nadie
    });

    await test.step("un número lleva a Prospectos ya filtrado por ese asesor y ese problema", async () => {
      await press(page.locator('[data-advisor="advisor-1"] [data-tile="overdue"]'));
      await page.waitForURL(/\/admin\/prospectos\?asesor=advisor-1&filtro=vencidos/);
      await expect(page.getByRole("combobox", { name: "Asesor responsable" })).toHaveValue("advisor-1");
      await expect(page.getByRole("checkbox", { name: "Solo seguimientos vencidos" })).toBeChecked();
      await expect(page.locator(".prospect-card", { hasText: "Carlos Vencido QA" })).toBeVisible();
      await expect(page.locator(".prospect-card", { hasText: "Carlos Olvidado QA" })).toHaveCount(0);
      await expect(page.locator(".prospect-card", { hasText: "Huerfano Vencido QA" })).toHaveCount(0);
    });

    await test.step("«Olvidados» y «sin asesor» también se pueden filtrar", async () => {
      await go("/admin/prospectos?asesor=advisor-1&filtro=olvidados");
      await expect(page.getByRole("checkbox", { name: "Solo sin seguimiento (7+ días)" })).toBeChecked();
      await expect(page.locator(".prospect-card", { hasText: "Carlos Olvidado QA" })).toBeVisible();
      await expect(page.locator(".prospect-card", { hasText: "Carlos Vencido QA" })).toHaveCount(0);

      await go("/admin/prospectos?asesor=ninguno");
      await expect(page.getByRole("combobox", { name: "Asesor responsable" }).locator("option:checked")).toHaveText("Sin asesor");
      await expect(page.locator(".prospect-card", { hasText: "Huerfano Vencido QA" })).toBeVisible();
      await expect(page.locator(".prospect-card", { hasText: "Carlos Vencido QA" })).toHaveCount(0);
    });

    await test.step("«Reasignar…» abre Prospectos filtrado y en modo «Seleccionar», para pasarlos a otro asesor en lote", async () => {
      await go("/admin/equipo");
      await press(page.locator('[data-advisor="ninguno"]').getByRole("link", { name: "Reasignar…" }));
      await page.waitForURL(/asesor=ninguno&filtro=vencidos&seleccionar=1/);
      await expect(page.getByRole("button", { name: "Salir de selección" })).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator(".prospect-card", { hasText: "Huerfano Vencido QA" }).locator("input[type=checkbox]")).toBeVisible();
    });
  });

  test("todo al día: sin pendientes ni solicitudes, todas las tarjetas «Al día»", async ({ page, go }) => {
    await go("/admin/equipo");
    await poner(page, "acl_local_prospectos", [prospecto("ok1", "Todo Bien QA", "advisor-1")]);
    await poner(page, "acl_local_agenda_citas", []);
    await go("/admin/equipo");
    await expect(page.locator('[data-total="overdue"] strong')).toHaveText("0");
    await expect(page.getByRole("status").filter({ hasText: "solicitud" })).toHaveCount(0);
    await expect(page.locator(".team-card--ok")).toHaveCount(3);
    await expect(page.locator(".team-card--urgent, .team-card--attention")).toHaveCount(0);
  });

  test("se llega desde el menú (Clientes → Equipo hoy) y desde Mi día", async ({ page, go, press, isMobile }) => {
    await go("/admin/mi-dia");
    // En el teléfono los enlaces del encabezado de Mi día se esconden (están en la barra de abajo): basta con que existan.
    await expect(page.locator('.my-day__links a[href="/admin/equipo"]')).toBeAttached();

    if (isMobile) await press(page.locator(".admin-layout__menu-btn"));
    const carpeta = page.locator(".admin-layout__group-toggle", { hasText: "Clientes" });
    if ((await carpeta.getAttribute("aria-expanded")) !== "true") await press(carpeta);
    await press(page.locator('.admin-layout__sidebar a[href="/admin/equipo"]'));
    await page.waitForURL((u) => u.pathname === "/admin/equipo");
    await expect(page.getByRole("heading", { name: "Equipo hoy", level: 1 })).toBeVisible();
  });
});
