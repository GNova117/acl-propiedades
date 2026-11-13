import { test, expect, ADMIN } from "./fixtures.js";

// Ausencias y vacaciones del asesor: se capturan en Mi perfil (tarjeta propia, sin depender de la reserva en línea) y se notan en Mi día,
// en «Equipo hoy» (la oficina) y al asignar prospectos nuevos desde Mensajes. Son los días de descanso del horario de visitas.

const dia = (n) => new Date(Date.now() + n * 864e5).toLocaleDateString("en-CA");
const hace = (horas) => new Date(Date.now() - horas * 3600000).toISOString();
const poner = (page, clave, valor) => page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [clave, valor]);
const leer = (page, clave) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "null"), clave);
const ACCESO_ASESOR = [{ id: "access-qa", email: ADMIN.email, role_id: "role-admin", advisor_id: "advisor-1" }];

const prospecto = (id, name, advisor_id) => ({
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
});

test.describe("Ausencias y vacaciones", () => {
  test.beforeEach(async ({ seedAdminSession }) => {
    await seedAdminSession();
  });

  test("el asesor captura una ausencia en Mi perfil, Mi día se lo recuerda y al quitarla desaparece", async ({ page, go, press }) => {
    await go("/admin/mi-dia");
    await poner(page, "acl_local_admin_access", ACCESO_ASESOR);
    await go("/admin/mi-perfil");

    const tarjeta = page.locator(".absence-card");
    await expect(tarjeta.getByRole("heading", { name: "Ausencias y vacaciones" })).toBeVisible();
    await expect(tarjeta).toContainText("No hay ausencias programadas.");

    await tarjeta.getByLabel("Desde").fill(dia(0));
    await tarjeta.getByLabel("Hasta").fill(dia(3));
    await tarjeta.getByLabel("Motivo (opcional)").fill("Vacaciones QA");
    await press(tarjeta.getByRole("button", { name: "Agregar ausencia" }));

    const fila = tarjeta.locator(".absence-card__item", { hasText: "Vacaciones QA" });
    await expect(fila).toBeVisible();
    await expect(fila.locator(".absence-card__now")).toHaveText("Ausente ahora");
    const guardadas = (await leer(page, "acl_local_visit_schedules"))["advisor-1"].timeOff;
    expect(guardadas.map((o) => [o.fecha_inicio, o.fecha_fin, o.motivo])).toEqual([[dia(0), dia(3), "Vacaciones QA"]]);

    await go("/admin/mi-dia");
    await expect(page.locator(".my-day__away")).toContainText("Estás marcado como ausente hasta el");
    await expect(page.locator(".my-day__away").getByRole("link", { name: "Cambiar" })).toHaveAttribute("href", "/admin/mi-perfil");

    await go("/admin/mi-perfil");
    await press(page.locator(".absence-card .absence-card__item").getByRole("button", { name: /Quitar/ }));
    await expect(page.locator(".absence-card")).toContainText("No hay ausencias programadas.");
    await go("/admin/mi-dia");
    await expect(page.locator(".my-day__away")).toHaveCount(0);
  });

  test("valida las fechas (fin antes del inicio) y una ausencia futura no marca «ausente ahora»", async ({ page, go, press }) => {
    await go("/admin/mi-dia");
    await poner(page, "acl_local_admin_access", ACCESO_ASESOR);
    await go("/admin/mi-perfil");
    const tarjeta = page.locator(".absence-card");

    await tarjeta.getByLabel("Desde").fill(dia(5));
    await tarjeta.getByLabel("Hasta").fill(dia(2));
    await press(tarjeta.getByRole("button", { name: "Agregar ausencia" }));
    await expect(tarjeta.getByRole("alert")).toHaveText("El fin no puede ser antes del inicio.");
    expect((await leer(page, "acl_local_visit_schedules"))?.["advisor-1"]?.timeOff ?? []).toEqual([]); // la validación no guarda nada

    await tarjeta.getByLabel("Hasta").fill(dia(7));
    await press(tarjeta.getByRole("button", { name: "Agregar ausencia" }));
    await expect(tarjeta.locator(".absence-card__item")).toHaveCount(1);
    await expect(tarjeta.locator(".absence-card__now")).toHaveCount(0);
    await go("/admin/mi-dia");
    await expect(page.locator(".my-day__away")).toHaveCount(0);
  });

  test("guardar el horario de visitas no borra las ausencias", async ({ page, go, press }) => {
    await go("/admin/mi-dia");
    await poner(page, "acl_local_admin_access", ACCESO_ASESOR);
    await poner(page, "acl_local_visit_schedules", { "advisor-1": { settings: { enabled: false, slot_minutes: 60, min_notice_hours: 2, horizon_days: 14 }, weekly: [], timeOff: [{ id: "off-1", fecha_inicio: dia(10), fecha_fin: dia(12), motivo: "Viaje QA" }] } });
    await go("/admin/mi-perfil");
    await expect(page.locator(".absence-card")).toContainText("Viaje QA");
    await press(page.locator(".visit-schedule").getByRole("button", { name: "Guardar", exact: true }));
    await expect(page.locator(".visit-schedule")).toContainText("Guardado");
    const guardado = (await leer(page, "acl_local_visit_schedules"))["advisor-1"];
    expect(guardado.timeOff.map((o) => o.motivo)).toEqual(["Viaje QA"]);
  });
});

test.describe("Ausencias en la oficina", () => {
  test.beforeEach(async ({ seedAdminSession }) => {
    await seedAdminSession();
  });

  test("Equipo hoy muestra quién está ausente y ofrece reasignar sus prospectos", async ({ page, go }) => {
    await go("/admin/equipo");
    await poner(page, "acl_local_prospectos", [prospecto("p1", "Ana Prospecto QA", "advisor-1"), prospecto("p2", "Beto Prospecto QA", "advisor-2")]);
    await poner(page, "acl_local_visit_schedules", { "advisor-1": { settings: { enabled: false, slot_minutes: 60, min_notice_hours: 2, horizon_days: 14 }, weekly: [], timeOff: [{ id: "off-1", fecha_inicio: dia(-1), fecha_fin: dia(4), motivo: null }] } });
    await go("/admin/equipo");

    const ausente = page.locator('[data-advisor="advisor-1"]');
    await expect(ausente.locator("[data-away]")).toContainText("Ausente hasta el");
    const reasignar = ausente.getByRole("link", { name: "Reasignar sus prospectos…" });
    await expect(reasignar).toBeVisible();
    const url = new URL(await reasignar.getAttribute("href"), "http://x");
    expect(url.searchParams.get("asesor")).toBe("advisor-1");
    expect(url.searchParams.get("seleccionar")).toBe("1");
    await expect(page.locator('[data-advisor="advisor-2"] [data-away]')).toHaveCount(0);
  });

  test("al crear un prospecto desde un mensaje, se asigna al primer asesor de la propiedad que no esté ausente", async ({ page, go, press }) => {
    await go("/admin/mensajes");
    const base = { type: "casa", description: "x", price: 1500000, area_m2: 100, bedrooms: 3, bathrooms: 2, parking: 1, zone: "Lerdo", address: "Calle 1", lat: 25.5, lng: -103.5, status: "disponible", operation_type: "compra", active: true, main_image: "", images: [], created_at: hace(100), updated_at: hace(100) };
    await poner(page, "acl_local_properties", [{ ...base, id: "prop-qa", code: "QA-1", title: "Casa Dos Asesores QA", advisor_ids: ["advisor-1", "advisor-2"] }]);
    await poner(page, "acl_local_messages", [{ id: "msg-1", name: "Cliente Mensaje QA", email: "c@c.com", phone: "8715550202", message: "Quiero verla", property_id: "prop-qa", channel: "formulario", status: "nuevo", created_at: hace(1) }]);
    await poner(page, "acl_local_visit_schedules", { "advisor-1": { settings: { enabled: false, slot_minutes: 60, min_notice_hours: 2, horizon_days: 14 }, weekly: [], timeOff: [{ id: "off-1", fecha_inicio: dia(0), fecha_fin: dia(2), motivo: null }] } });
    await go("/admin/mensajes");

    await press(page.locator("tr", { hasText: "Cliente Mensaje QA" }).getByRole("button", { name: /prospecto/i }).first());
    await expect.poll(async () => (await leer(page, "acl_local_prospectos")) ?.length ?? 0).toBe(1);
    const [creado] = await leer(page, "acl_local_prospectos");
    expect(creado).toMatchObject({ name: "Cliente Mensaje QA", advisor_id: "advisor-2", message_id: "msg-1" });
  });
});
