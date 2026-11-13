import { test, expect, ADMIN, isoDate } from "./fixtures.js";

// Registrar una visita y agendar una cita sin señal: no se pierden ni hacen esperar. Quedan en la cola de este dispositivo
// (la misma de «Prospecto rápido» y «Registrar contacto»; ver sin-senal.spec.js) y se envían solas al volver la señal, sin
// duplicarse. «Sin señal» es de verdad: el navegador de pruebas se pone sin conexión.

const COLA = `acl_offline_queue_v1:${ADMIN.email}`;
const CITAS = "acl_local_agenda_citas";
const VISITAS = "acl_local_visits";
const ahora = () => new Date().toISOString();
const hoy = () => new Date().toLocaleDateString("en-CA");

const leer = (page, clave) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "[]"), clave);
const poner = (page, clave, valor) => page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [clave, valor]);

async function sinSenal(page, activo) {
  await page.context().setOffline(activo);
  await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(!activo);
}

const aviso = (page) => page.getByRole("region", { name: "Estado de la conexión" });

async function llenarCita(page, titulo) {
  await page.selectOption("#cita-advisor", { index: 1 });
  await page.fill("#cita-titulo", titulo);
  await page.fill("#cita-fecha", isoDate(3));
  await page.fill("#cita-hora", "12:00");
  await page.fill("#cita-contact-name", "Pedro Contacto QA");
  await page.fill("#cita-contact-phone", "871 111 2222");
}

test.describe("Visitas y citas sin señal", () => {
  test.beforeEach(async ({ seedAdminSession }) => {
    await seedAdminSession();
  });

  test("agendar una cita sin señal: queda en el dispositivo, se avisa y se envía sola al volver la señal", async ({ page, go, press }) => {
    const titulo = `Cita Sin Senal QA ${Date.now() % 100000}`;
    await go("/admin/agenda/nueva");
    await sinSenal(page, true);
    await llenarCita(page, titulo);
    await press(page.locator("main form button[type=submit]").last());

    await test.step("en vez de abrir una cita que todavía no existe, avisa que quedó en este dispositivo", async () => {
      const panel = page.locator(".offline-saved");
      await expect(panel).toContainText("Guardada en este dispositivo");
      await expect(panel).toContainText(`La cita «${titulo}» se enviará sola cuando haya señal.`);
      await expect(aviso(page)).toContainText("1 cambio por enviar");
      await press(aviso(page).getByRole("button", { name: "Ver" }));
      await expect(aviso(page)).toContainText(`Cita: ${titulo}`);
    });

    await test.step("está en la cola con su propio id y todavía no en la Agenda", async () => {
      const cola = await leer(page, COLA);
      expect(cola).toHaveLength(1);
      expect(cola[0]).toMatchObject({ type: "cita.add", label: titulo, failed: false });
      expect(cola[0].payload.fields).toMatchObject({ titulo, fecha: isoDate(3), hora: "12:00", contact_name: "Pedro Contacto QA" });
      expect(cola[0].payload.fields.id, "lleva su propio id para no duplicarse al reenviar").toBeTruthy();
      expect((await leer(page, CITAS)).some((c) => c.titulo === titulo)).toBe(false);
    });

    await test.step("al volver la señal se envía solo, con el mismo id y su enlace para el cliente", async () => {
      const id = (await leer(page, COLA))[0].payload.fields.id;
      await sinSenal(page, false);
      await expect(aviso(page)).toContainText("Se envió 1 cambio.");
      const guardadas = (await leer(page, CITAS)).filter((c) => c.titulo === titulo);
      expect(guardadas).toHaveLength(1);
      expect(guardadas[0]).toMatchObject({ id, status: "confirmada", source: "admin" });
      expect(guardadas[0].booking_token).toMatch(/^[0-9a-f]{32}$/);
      expect(await leer(page, COLA)).toEqual([]);
    });

    await test.step("y aparece en la Agenda", async () => {
      await go("/admin/agenda?vista=lista");
      await expect(page.locator("tbody tr", { hasText: titulo })).toBeVisible();
    });
  });

  test("una cita que sí había llegado (se perdió la respuesta) no se duplica al reenviarse", async ({ page, go, press }) => {
    const titulo = `Cita Duplicada QA ${Date.now() % 100000}`;
    await go("/admin/agenda/nueva");
    await sinSenal(page, true);
    await llenarCita(page, titulo);
    await press(page.locator("main form button[type=submit]").last());
    await expect(page.locator(".offline-saved")).toBeVisible();

    // Simula que la petición ya había llegado al servidor con ese mismo id.
    const [op] = await leer(page, COLA);
    await poner(page, CITAS, [
      ...(await leer(page, CITAS)),
      { ...op.payload.fields, status: "confirmada", source: "admin", booking_token: "a".repeat(32), created_at: ahora(), updated_at: ahora() },
    ]);

    await sinSenal(page, false);
    await expect(aviso(page)).toContainText("Se envió 1 cambio.");
    expect((await leer(page, CITAS)).filter((c) => c.titulo === titulo)).toHaveLength(1);
    expect(await leer(page, COLA)).toEqual([]);
  });

  test("registrar una visita (de una cita) sin señal: se guarda, y al enviarse cierra la cita como realizada", async ({ page, go, press }) => {
    await go("/admin/mi-dia");
    await poner(page, CITAS, [
      {
        id: "cita-visita-qa",
        advisor_id: "advisor-1",
        client_id: null,
        property_id: "prop-1",
        prospecto_id: null,
        titulo: "Visita: Casa en Residencial Senderos",
        fecha: hoy(),
        hora: "00:01",
        actividades: null,
        lugar: null,
        contact_name: "Cliente Visita QA",
        contact_phone: "8715550199",
        contact_email: null,
        status: "confirmada",
        source: "admin",
        booking_token: "b".repeat(32),
        created_at: ahora(),
        updated_at: ahora(),
      },
    ]);
    await go("/admin/mi-dia");
    const cita = page.locator(".my-day__item", { hasText: "Visita: Casa en Residencial Senderos" });
    await expect(cita).toBeVisible();

    await press(cita.getByRole("link", { name: "Registrar visita" }));
    await page.waitForURL("**/admin/visitas/nueva");
    await expect(page.locator("#visit-prospect")).toHaveValue("Cliente Visita QA"); // viene de la cita

    await sinSenal(page, true);
    await press(page.locator("[role=radiogroup] .visit-pill").first()); // «Interés» es obligatorio
    await press(page.locator("form button[type=submit]").last());

    await test.step("avisa que quedó en este dispositivo, con la cita todavía abierta", async () => {
      await expect(page.locator(".offline-saved")).toContainText("La visita «Casa en Residencial Senderos» se enviará sola cuando haya señal.");
      await expect(aviso(page)).toContainText("1 cambio por enviar");
      const [op] = await leer(page, COLA);
      expect(op).toMatchObject({ type: "visit.add", label: "Casa en Residencial Senderos" });
      expect(op.payload).toMatchObject({ citaId: "cita-visita-qa", can: { agenda: true } });
      expect(op.payload.fields).toMatchObject({ property_id: "prop-1", cita_id: "cita-visita-qa", prospect_name: "Cliente Visita QA" });
      expect(op.payload.fields.id).toBeTruthy();
      expect((await leer(page, CITAS))[0].status).toBe("confirmada");
    });

    await test.step("al volver la señal se envía solo y la cita queda realizada", async () => {
      const id = (await leer(page, COLA))[0].payload.fields.id;
      await sinSenal(page, false);
      await expect(aviso(page)).toContainText("Se envió 1 cambio.");
      const visitas = (await leer(page, VISITAS)).filter((v) => v.id === id);
      expect(visitas).toHaveLength(1);
      expect(visitas[0]).toMatchObject({ property_id: "prop-1", cita_id: "cita-visita-qa", prospect_name: "Cliente Visita QA" });
      await expect.poll(async () => (await leer(page, CITAS))[0].status).toBe("realizada");
      expect(await leer(page, COLA)).toEqual([]);
    });

    await test.step("y la visita aparece en el listado", async () => {
      await go("/admin/visitas");
      await expect(page.locator("main")).toContainText("Cliente Visita QA");
    });
  });

  test("una visita suelta sin señal también se guarda; y una futura sigue sin admitirse", async ({ page, go, press }) => {
    await go("/admin/visitas/nueva");
    await sinSenal(page, true);
    await page.selectOption("#visit-property", { index: 1 });
    await page.fill("#visit-when", `${isoDate(30)}T09:00`);
    await page.fill("#visit-prospect", "Futura QA");
    await press(page.locator("form button[type=submit]").last());
    await expect(page.locator(".form-error").first()).toContainText("futuro"); // la validación sigue igual sin señal
    expect(await leer(page, COLA)).toEqual([]);

    await page.fill("#visit-when", `${isoDate(-1)}T09:00`);
    await page.selectOption("#visit-advisor", { index: 1 });
    await page.fill("#visit-prospect", "Suelta Sin Senal QA");
    await press(page.locator("[role=radiogroup] .visit-pill").first());
    await press(page.locator("form button[type=submit]").last());
    await expect(page.locator(".offline-saved")).toBeVisible();
    const [op] = await leer(page, COLA);
    expect(op).toMatchObject({ type: "visit.add", payload: { citaId: null } });

    await sinSenal(page, false);
    await expect(aviso(page)).toContainText("Se envió 1 cambio.");
    expect((await leer(page, VISITAS)).some((v) => v.prospect_name === "Suelta Sin Senal QA")).toBe(true);
  });
});
