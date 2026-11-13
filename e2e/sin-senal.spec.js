import { test, expect, ADMIN } from "./fixtures.js";

// Captura sin señal: sin conexión, un «Prospecto rápido» o un «Registrar contacto» no se pierde ni hace esperar:
// queda en este dispositivo y se envía solo al volver la señal. Aquí «sin señal» es de verdad (el navegador de
// pruebas se pone sin conexión), no un truco de la app.

const ahora = () => new Date().toISOString();
const COLA = `acl_offline_queue_v1:${ADMIN.email}`;

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

const leer = (page, clave) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "[]"), clave);
const poner = (page, clave, valor) => page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [clave, valor]);

async function sinSenal(page, activo) {
  await page.context().setOffline(activo);
  await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(!activo);
}

const aviso = (page) => page.getByRole("region", { name: "Estado de la conexión" });

test.describe("Captura sin señal", () => {
  test.beforeEach(async ({ seedAdminSession }) => {
    await seedAdminSession();
  });

  test("«Prospecto rápido» sin señal se guarda en el dispositivo, se avisa y sale solo al volver la señal", async ({ page, go, press }) => {
    const nombre = `Sin Senal QA ${Date.now() % 100000}`;
    await go("/admin/mi-dia");
    await expect(aviso(page)).toHaveCount(0); // con señal y sin pendientes no hay aviso

    await sinSenal(page, true);
    await expect(aviso(page)).toContainText("Sin conexión");

    await test.step("se captura igual y queda guardado en este dispositivo", async () => {
      await press(page.getByRole("button", { name: "Acciones rápidas" }));
      await press(page.getByRole("menuitem", { name: "Prospecto rápido" }));
      const panel = page.locator(".quick-capture__sheet");
      await panel.locator("#qc-name").fill(nombre);
      await panel.locator("#qc-phone").fill("8715550404");
      await press(panel.locator("button[type=submit]"));
      const hecho = page.locator(".quick-capture__done");
      await expect(hecho).toContainText(`Guardado en este dispositivo: ${nombre}`);
      await expect(hecho.getByRole("link", { name: "Ver en prospectos" })).toHaveCount(0); // todavía no existe en el servidor
    });

    await test.step("avisa que hay un cambio por enviar y todavía no está en la base", async () => {
      await expect(aviso(page)).toContainText("1 cambio por enviar");
      expect(await leer(page, "acl_local_prospectos")).toEqual([]);
      const cola = await leer(page, COLA);
      expect(cola).toHaveLength(1);
      expect(cola[0]).toMatchObject({ type: "prospect.add", label: nombre, failed: false });
      expect(cola[0].payload.fields.id, "lleva su propio id para no duplicarse al reenviar").toBeTruthy();
    });

    await test.step("al volver la señal se envía solo, con el mismo id", async () => {
      const id = (await leer(page, COLA))[0].payload.fields.id;
      await sinSenal(page, false);
      await expect(aviso(page)).toContainText("Se envió 1 cambio.");
      const guardados = await leer(page, "acl_local_prospectos");
      expect(guardados).toHaveLength(1);
      expect(guardados[0]).toMatchObject({ id, name: nombre, stage: "nuevo" });
      expect(await leer(page, COLA)).toEqual([]);
    });

    await test.step("y aparece en Prospectos", async () => {
      await go("/admin/prospectos");
      await expect(page.locator(".prospect-card", { hasText: nombre })).toBeVisible();
    });
  });

  test("«Registrar contacto» sin señal: el tablero lo muestra de inmediato y se envía al volver la señal", async ({ page, go, press }) => {
    const p = prospecto("ss1", "Contacto Sin Senal QA");
    await go("/admin/prospectos");
    await poner(page, "acl_local_prospectos", [p]);
    await go(`/admin/prospectos/${p.id}`);
    const ficha = page.locator(".prospect-profile");
    await expect(ficha).toBeVisible();

    await sinSenal(page, true);
    await press(ficha.getByRole("button", { name: "Registrar contacto" }));
    await press(ficha.locator("form.contact-form").getByRole("button", { name: "No contestó" }));

    await test.step("la ficha ya muestra el avance (sin esperar al servidor)", async () => {
      await expect(ficha.locator("form.contact-form")).toHaveCount(0);
      await expect(ficha.locator("select[aria-label='Etapa']")).toHaveValue("contactado");
      await expect(aviso(page)).toContainText("1 cambio por enviar");
    });

    await test.step("en la base todavía no; en la cola sí, con lo que hay que enviar", async () => {
      const [enBase] = await leer(page, "acl_local_prospectos");
      expect(enBase.stage).toBe("nuevo");
      expect(await leer(page, "acl_local_prospect_contacts")).toEqual([]);
      const [op] = await leer(page, COLA);
      expect(op).toMatchObject({ type: "prospect.contact", label: p.name });
      expect(op.payload).toMatchObject({ prospectId: "ss1", channel: "llamada", note: "No contestó" });
    });

    await test.step("al volver la señal queda registrado: contacto, etapa y seguimiento", async () => {
      await sinSenal(page, false);
      await expect(aviso(page)).toContainText("Se envió 1 cambio.");
      const [enBase] = await leer(page, "acl_local_prospectos");
      expect(enBase).toMatchObject({ stage: "contactado" });
      expect(enBase.next_followup_at).toBeTruthy();
      expect(enBase.last_contact_at).toBeTruthy();
      const contactos = await leer(page, "acl_local_prospect_contacts");
      expect(contactos).toHaveLength(1);
      expect(contactos[0]).toMatchObject({ prospecto_id: "ss1", channel: "llamada", note: "No contestó" });
      expect(await leer(page, COLA)).toEqual([]);
    });
  });

  test("lo que no se pudo enviar por algo que no es la red (p. ej. el prospecto ya no existe) queda a la vista y se descarta", async ({ page, go, press }) => {
    await go("/admin/mi-dia");
    await poner(page, COLA, [
      { id: "op-x", type: "prospect.contact", label: "Ya No Existe QA", createdAt: ahora(), attempts: 0, failed: false, lastError: "", maybeSent: false, payload: { prospectId: "no-existe", channel: "llamada", note: "Hola", nextFollowup: "2030-01-01" } },
    ]);
    await go("/admin/mi-dia"); // al abrir la app con algo pendiente y señal, lo intenta

    await expect(aviso(page)).toContainText("1 no se pudo enviar.");
    await press(aviso(page).getByRole("button", { name: "Ver" }));
    await expect(aviso(page)).toContainText("Contacto con Ya No Existe QA (Llamada)");
    await expect(aviso(page)).toContainText("No se pudo enviar: El prospecto ya no existe.");

    await press(aviso(page).getByRole("button", { name: "Descartar" }));
    await expect(aviso(page)).toHaveCount(0);
    expect(await leer(page, COLA)).toEqual([]);
  });

  test("la cola es de la cuenta: lo guardado por otra cuenta no se ve ni se envía", async ({ page, go }) => {
    await go("/admin/mi-dia");
    const ajena = [{ id: "op-y", type: "prospect.add", label: "De Otra Cuenta QA", createdAt: ahora(), attempts: 0, failed: false, lastError: "", payload: { fields: prospecto("otra", "De Otra Cuenta QA") } }];
    await poner(page, "acl_offline_queue_v1:otra@acl.mx", ajena);
    await go("/admin/mi-dia");
    await expect(page.locator(".admin-layout__content h1").first()).toBeVisible();
    await expect(aviso(page)).toHaveCount(0);
    expect(await leer(page, "acl_local_prospectos")).toEqual([]);
    expect(await leer(page, "acl_offline_queue_v1:otra@acl.mx")).toHaveLength(1);
  });

  test("cerrar sesión con cambios sin enviar avisa que se quedan en este dispositivo", async ({ page, go, press, isMobile }) => {
    await go("/admin/mi-dia");
    // Un cambio que falló (con señal no se queda «por enviar»: se reintenta solo) para que siga en la cola.
    await poner(page, COLA, [
      { id: "op-z", type: "prospect.add", label: "Pendiente QA", createdAt: ahora(), attempts: 1, failed: true, lastError: "sin permiso", payload: { fields: prospecto("pend", "Pendiente QA") } },
    ]);
    await go("/admin/mi-dia");
    await expect(aviso(page)).toContainText("1 no se pudo enviar.");

    let mensaje = "";
    page.once("dialog", (d) => {
      mensaje = d.message();
    });
    if (isMobile) await press(page.locator(".admin-layout__menu-btn"));
    await press(page.locator(".admin-layout__logout"));
    await expect.poll(() => mensaje).toContain("1 cambio sin enviar");
    expect(mensaje).toContain("se queda en este dispositivo");
    // La prueba acepta los avisos sola: sale, y lo pendiente sigue guardado para cuando vuelva a entrar.
    await page.waitForURL("**/admin/login");
    expect(await leer(page, COLA)).toHaveLength(1);
  });
});
