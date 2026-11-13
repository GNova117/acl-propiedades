import { test, expect, ADMIN } from "./fixtures.js";

// La app abre sin señal aunque se recargue: con señal, el panel se guarda en el dispositivo (service worker, ver
// public/sw.js y src/lib/offlineShell.js); sin señal, recargar o abrir cualquier pantalla del panel sigue funcionando y
// se puede capturar. Aquí el service worker está ACTIVO (el resto de las pruebas lo bloquean) y «sin señal» es de
// verdad: el navegador de pruebas se pone sin conexión.
//
// Límite que se prueba tal cual: lo que no está en memoria tras recargar (las listas) necesita señal; lo que se
// captura con «+» sí se guarda y se envía solo.

test.use({ serviceWorkers: "allow" });

const COLA = `acl_offline_queue_v1:${ADMIN.email}`;
const leer = (page, clave) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "[]"), clave);
const aviso = (page) => page.getByRole("region", { name: "Estado de la conexión" });

async function sinSenal(page, activo) {
  await page.context().setOffline(activo);
  await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(!activo);
}

// El panel ya quedó guardado: la huella del build y la app están anotadas.
const precacheListo = (page) =>
  page.evaluate(async () => {
    const guardado = await caches.open("acl-sw-v2-static");
    return Boolean(await guardado.match("/__precache-build")) && Boolean(await guardado.match("/index.html"));
  });

test.describe("Abrir sin señal", () => {
  test.beforeEach(async ({ seedAdminSession }) => {
    test.setTimeout(90_000);
    await seedAdminSession();
  });

  test("con señal el panel se guarda completo; sin señal recargar y abrir otras pantallas funciona, y se captura y se envía al volver", async ({
    page,
    go,
    press,
  }) => {
    await go("/admin/mi-dia");
    await expect(page.locator(".admin-layout__content h1").first()).toBeVisible();

    await test.step("el service worker toma el control y guarda el panel (toda la lista del build)", async () => {
      await page.evaluate(() => navigator.serviceWorker.ready);
      await expect.poll(() => precacheListo(page), { timeout: 45_000, intervals: [500] }).toBe(true);
      const faltan = await page.evaluate(async () => {
        const lista = await (await fetch("/precache.json", { cache: "no-store" })).json();
        const guardados = await caches.open("acl-sw-v2-assets");
        const faltantes = [];
        for (const archivo of lista.assets) if (!(await guardados.match(archivo, { ignoreVary: true }))) faltantes.push(archivo);
        return { faltantes, total: lista.assets.length, shell: lista.shell };
      });
      expect(faltan.faltantes, "todo lo de la lista debe estar guardado").toEqual([]);
      expect(faltan.total).toBeGreaterThan(20);
      expect(faltan.shell).toBe("/index.html");
    });

    await test.step("sin señal de verdad (también para el service worker)", async () => {
      await sinSenal(page, true);
      const llegaARed = await page.evaluate(() => fetch("/assets/no-existe-123.js").then(() => true, () => false));
      expect(llegaARed, "un archivo que no está guardado no debe poder bajarse").toBe(false);
    });

    await test.step("recargar el panel sin señal abre la app, con el aviso de «Sin conexión»", async () => {
      const respuesta = await page.reload({ waitUntil: "domcontentloaded" });
      expect(respuesta.fromServiceWorker()).toBe(true);
      await expect(page.locator(".admin-layout__content h1").first()).toBeVisible();
      await expect(aviso(page)).toContainText("Sin conexión");
    });

    await test.step("abrir otra pantalla del panel (escribiendo la dirección) también funciona, aunque nunca se hubiera visitado", async () => {
      await page.goto("/admin/prospectos", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "Prospectos", level: 1 })).toBeVisible();
      await page.goto("/admin/visitas", { waitUntil: "domcontentloaded" });
      await expect(page.locator(".admin-layout__content h1").first()).toBeVisible();
      await expect(page.getByText("Algo salió mal")).toHaveCount(0);
    });

    const nombre = `Recarga Sin Senal QA ${Date.now() % 100000}`;
    await test.step("después de recargar se captura un prospecto y queda en el dispositivo", async () => {
      await press(page.getByRole("button", { name: "Acciones rápidas" }));
      await press(page.getByRole("menuitem", { name: "Prospecto rápido" }));
      const panel = page.locator(".quick-capture__sheet");
      await panel.locator("#qc-name").fill(nombre);
      await panel.locator("#qc-phone").fill("8715550505");
      await press(panel.locator("button[type=submit]"));
      await expect(page.locator(".quick-capture__done")).toContainText(`Guardado en este dispositivo: ${nombre}`);
      expect(await leer(page, COLA)).toHaveLength(1);
    });

    await test.step("al volver la señal se envía solo", async () => {
      await sinSenal(page, false);
      await expect(aviso(page)).toContainText("Se envió 1 cambio.");
      expect(await leer(page, COLA)).toEqual([]);
      expect((await leer(page, "acl_local_prospectos")).map((p) => p.name)).toContain(nombre);
    });
  });

  test("el resto del sitio (público) sigue mostrando la página de «sin conexión» y no la app del panel", async ({ page, go }) => {
    await go("/admin/mi-dia");
    await page.evaluate(() => navigator.serviceWorker.ready);
    await expect.poll(() => precacheListo(page), { timeout: 45_000, intervals: [500] }).toBe(true);

    await sinSenal(page, true);
    await page.goto("/propiedades", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: /reintentar/i })).toBeVisible();
    await expect(page.locator(".admin-layout__content")).toHaveCount(0);
    await sinSenal(page, false);
  });

  test("sin haber abierto el panel con señal antes, no hay app guardada: se ve la página de «sin conexión»", async ({ page, go }) => {
    await go("/propiedades"); // el service worker se instala, pero nadie abrió el panel (no se pidió guardarlo)
    await page.evaluate(() => navigator.serviceWorker.ready);
    expect(await precacheListo(page)).toBe(false);

    await sinSenal(page, true);
    await page.goto("/admin/mi-dia", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: /reintentar/i })).toBeVisible();
    await sinSenal(page, false);
  });
});
