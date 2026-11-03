import { test, expect } from "./fixtures.js";

// «Agendar visita con horarios reales»: el visitante reserva un horario libre desde la
// ficha, administra su visita desde el enlace /visita/<token> (confirmar, cambiar,
// cancelar) y el asesor lo ve en la Agenda y en Mensajes. En PC y en móvil.
//
// Los horarios del asesor se siembran en el localStorage (modo demo) antes de que cargue
// la app: el asesor 1 atiende todos los días de 9 a 20 h, sin anticipación mínima. Se
// eligen días lejanos (no hoy) para que las reglas de «2 h de aviso» no dependan de la
// hora a la que corra la prueba. La propiedad de prueba, prop-1, la atiende el asesor 1.

const PROPIEDAD = "/propiedades/prop-1";
const HORARIO = {
  "advisor-1": {
    settings: { enabled: true, slot_minutes: 60, min_notice_hours: 0, horizon_days: 14 },
    weekly: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, start_time: "09:00", end_time: "20:00" })),
    timeOff: [],
  },
};

test.describe("Agendar visita", () => {
  test("sin horario del asesor queda el formulario de solicitud de siempre", async ({ page, go, press }) => {
    await go(PROPIEDAD);
    await press(page.locator("#agendar-visita").getByRole("button", { name: "Agendar visita" }));
    await expect(page.locator("#visit-date")).toBeVisible();
    await expect(page.locator(".visit-slots__day")).toHaveCount(0);
  });

  test("reservar, administrar la visita desde su enlace y verla en el panel", async ({ page, go, press }) => {
    await page.addInitScript((horario) => localStorage.setItem("acl_local_visit_schedules", JSON.stringify(horario)), HORARIO);

    // ── Reservar desde la ficha ──
    await go(PROPIEDAD);
    const tarjeta = page.locator("#agendar-visita");
    await press(tarjeta.getByRole("button", { name: "Agendar visita" }));
    await expect(page.locator(".visit-slots__day").first()).toBeVisible();

    await press(tarjeta.getByRole("button", { name: "Confirmar visita" }));
    await expect(tarjeta).toContainText("Elige un día y una hora para continuar.");

    await press(page.locator(".visit-slots__day").nth(3)); // un día lejano: sin depender de la hora actual
    await press(page.locator(".visit-slots__time").first());
    await press(tarjeta.getByRole("button", { name: "Confirmar visita" }));
    await expect(tarjeta).toContainText("Este campo es obligatorio");

    await page.fill("#booking-name", "Ana Pérez QA");
    await page.fill("#booking-email", "ana.qa@correo.com");
    await page.fill("#booking-phone", "871 123 4567");
    await press(tarjeta.getByRole("button", { name: "Confirmar visita" }));
    await expect(tarjeta.locator(".visit-booking__done")).toContainText("¡Tu visita está agendada!");
    await expect(tarjeta).toContainText("Te atiende Carlos Delgado.");
    // La ficha no publica los datos de contacto del asesor: el WhatsApp es el de la oficina.
    expect(await tarjeta.innerHTML()).not.toMatch(/8711234567|871 123 4567/);

    // ── La página de la visita ──
    await press(tarjeta.getByRole("link", { name: "Ver, cambiar o cancelar mi visita" }));
    await page.waitForURL(/\/visita\/[0-9a-f]{32}$/);
    const token = new URL(page.url()).pathname.split("/").pop();
    await expect(page.locator("h1")).toContainText("Hola, Ana");
    await expect(page.locator(".visit-page__status")).toHaveText("Visita agendada");
    const antes = await page.locator(".visit-page__when").innerText();

    await press(page.getByRole("button", { name: "Confirmo que asistiré" }));
    await expect(page.locator(".visit-page__ok")).toContainText("Ya confirmaste tu asistencia");

    await press(page.getByRole("button", { name: "Cambiar horario" }));
    await expect(page.locator(".visit-slots__day").first()).toBeVisible();
    await press(page.locator(".visit-slots__day").nth(5));
    await press(page.locator(".visit-slots__time").first());
    await press(page.getByRole("button", { name: "Confirmar nuevo horario" }));
    await expect(page.locator(".visit-page__notice-line--ok")).toContainText("cambiamos tu visita");
    await expect(page.locator(".visit-page__when")).not.toHaveText(antes);
    await expect(page.locator(".visit-page__actions")).toContainText("Puedes cambiar el horario 1 vez más.");

    await press(page.getByRole("button", { name: "Cancelar visita" }));
    await page.fill("#visit-cancel-reason", "Surgió un imprevisto QA");
    await press(page.getByRole("button", { name: "Sí, cancelar mi visita" }));
    await expect(page.locator(".visit-page__status")).toHaveText("Visita cancelada");
    await expect(page.locator(".visit-page__actions")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Agendar otra visita" })).toBeVisible();

    // Recargar el enlace muestra lo mismo: el estado vive en la base, no en la pantalla.
    await go(`/visita/${token}`);
    await expect(page.locator(".visit-page__status")).toHaveText("Visita cancelada");

    // ── El asesor lo ve en el panel ──
    await page.evaluate(
      (email) => localStorage.setItem("acl_local_session", JSON.stringify({ user: { email } })),
      "admin@aclpropiedades.com",
    );
    await go("/admin/agenda");
    await page.selectOption("#agenda-status-filter", "cancelled");
    const fila = page.locator("tbody tr", { hasText: "Ana Pérez QA" });
    await expect(fila).toContainText("Cancelada por el cliente — Surgió un imprevisto QA");
    await expect(fila).toContainText("Sitio web");

    await go("/admin/mensajes");
    await expect(page.locator("main")).toContainText("Visita cancelada por el cliente");
    await expect(page.locator("main")).toContainText("Visita reprogramada por el cliente");
    // Un aviso de cambio se etiqueta como tal y no se puede convertir en cita ni en prospecto.
    const aviso = page.locator("tbody tr", { hasText: "Visita cancelada por el cliente" });
    await expect(aviso).toContainText("Cambió o canceló su visita");
    await expect(aviso.getByRole("button", { name: /prospecto/i })).toHaveCount(0);
    await expect(aviso.getByRole("link", { name: /Agendar cita/i })).toHaveCount(0);
    // La reserva original sí queda como mensaje (con su etiqueta) y tampoco se vuelve a agendar.
    await expect(page.locator("tbody tr", { hasText: "Visita agendada" }).first()).toContainText("Agendó una visita en el sitio");
  });
});
