import { test, expect, isoDate } from "./fixtures.js";

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

  // Cierre del ciclo (fase 6): quien reserva ya es un prospecto; la visita que ya pasó se cierra
  // y se registra con los datos de la cita; las métricas cuentan la asistencia.
  test("cierre del ciclo: prospecto al reservar, visita por cerrar, registrar con datos de la cita y métricas", async ({ page, go, press }) => {
    await page.addInitScript((horario) => localStorage.setItem("acl_local_visit_schedules", JSON.stringify(horario)), HORARIO);

    // ── Reservar desde la ficha ──
    await go(PROPIEDAD);
    const tarjeta = page.locator("#agendar-visita");
    await press(tarjeta.getByRole("button", { name: "Agendar visita" }));
    await expect(page.locator(".visit-slots__day").first()).toBeVisible();
    await press(page.locator(".visit-slots__day").nth(3));
    await press(page.locator(".visit-slots__time").first());
    await page.fill("#booking-name", "Beto Cierre QA");
    await page.fill("#booking-email", "beto.qa@correo.com");
    await page.fill("#booking-phone", "871 765 4321");
    await press(tarjeta.getByRole("button", { name: "Confirmar visita" }));
    await expect(tarjeta.locator(".visit-booking__done")).toBeVisible();

    // La visita ya pasó (hace 3 días) y el seguimiento automático del prospecto se movió con ella.
    await page.evaluate((fecha) => {
      const citas = JSON.parse(localStorage.getItem("acl_local_agenda_citas"));
      const prospectos = JSON.parse(localStorage.getItem("acl_local_prospectos"));
      for (const cita of citas.filter((c) => c.source === "sitio")) {
        cita.fecha = fecha;
        cita.hora = "11:00";
        const d = new Date(`${fecha}T12:00:00Z`);
        d.setUTCDate(d.getUTCDate() + 1);
        prospectos.find((p) => p.id === cita.prospecto_id).next_followup_at = d.toISOString().slice(0, 10);
      }
      localStorage.setItem("acl_local_agenda_citas", JSON.stringify(citas));
      localStorage.setItem("acl_local_prospectos", JSON.stringify(prospectos));
    }, isoDate(-3));
    await page.evaluate((email) => localStorage.setItem("acl_local_session", JSON.stringify({ user: { email } })), "admin@aclpropiedades.com");

    // ── Ya es un prospecto interesado, con la fuente de la reserva ──
    await go("/admin/prospectos");
    const prospecto = page.locator("main", { hasText: "Beto Cierre QA" });
    await expect(prospecto).toContainText("Visita agendada en el sitio");
    await expect(prospecto).toContainText("Interesado");

    // ── Mi día lo avisa como visita por cerrar; se registra con los datos de la cita ──
    await go("/admin/mi-dia");
    const porCerrar = page.locator("section[aria-labelledby='my-day-close']");
    await expect(porCerrar).toContainText("Visitas por cerrar");
    await expect(porCerrar).toContainText("Beto Cierre QA");
    await press(porCerrar.getByRole("link", { name: "Registrar visita" }));
    await page.waitForURL("**/admin/visitas/nueva");
    await expect(page.locator("main")).toContainText("Esta visita viene de una cita de la Agenda");
    await expect(page.locator("#visit-property")).not.toHaveValue("");
    await expect(page.locator("#visit-prospect")).toHaveValue("Beto Cierre QA");
    await expect(page.locator("#visit-when")).toHaveValue(`${isoDate(-3)}T11:00`);
    await press(page.locator("[role=radiogroup] .visit-pill").first()); // «Interés» es obligatorio
    await press(page.locator("form.visit-form button[type=submit]"));
    await page.waitForURL("**/admin/mi-dia"); // vuelve de donde vino
    await expect(page.locator("main")).not.toContainText("Visitas por cerrar");

    // ── La cita quedó realizada y ligada a su visita, y el prospecto a su cita ──
    await go("/admin/agenda");
    const fila = page.locator("tbody tr", { hasText: "Beto Cierre QA" });
    await expect(fila).toContainText("Realizada");
    await expect(fila).toContainText("Visita registrada");
    await expect(fila).toContainText("Ver prospecto");
    await expect(fila.getByRole("button", { name: "Registrar visita" })).toHaveCount(0);

    // ── Métricas de asistencia ──
    await go("/admin/estadisticas");
    const metricas = page.locator(".funnel-visits");
    await expect(metricas).toContainText("Visitas agendadas desde el sitio");
    await expect(metricas).toContainText("100 %");
    await expect(metricas).toContainText("1 de 1 visitas cerradas");
  });
});
