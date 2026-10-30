import { test as base, expect } from "@playwright/test";

export { expect };

export const ADMIN = { email: "admin@aclpropiedades.com", password: "Admin123!" };

// «Failed to load resource» es ruido de red (recursos externos bloqueados a
// propósito, /api/* simulado como no disponible): no es un fallo de la app.
const RESOURCE_NOISE = /Failed to load resource/;

// `test` de Playwright con lo común a todas las pruebas:
//  - sin red externa (Unsplash, mapas, fuentes, GA): rápido y sin depender de internet;
//  - /api/* responde 404, que es lo que ve el sitio en modo demo (no hay funciones de servidor);
//  - cualquier error de página/consola o respuesta ≥400 propia hace fallar la prueba;
//  - los confirm() de borrado se aceptan.
export const test = base.extend({
  page: async ({ page, baseURL }, use) => {
    const origin = new URL(baseURL).origin;
    const problems = [];

    await page.route(
      (url) => url.origin !== origin,
      (route) => route.abort(),
    );
    await page.route(
      (url) => url.origin === origin && url.pathname.startsWith("/api/"),
      (route) => route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "no disponible en e2e" }) }),
    );

    page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() === "error" && !RESOURCE_NOISE.test(m.text())) problems.push(`console: ${m.text().slice(0, 200)}`);
    });
    page.on("response", (r) => {
      const u = new URL(r.url());
      if (u.origin === origin && !u.pathname.startsWith("/api/") && r.status() >= 400) problems.push(`HTTP ${r.status()} ${u.pathname}`);
    });
    page.on("dialog", (d) => d.accept());

    await use(page);

    expect.soft(problems, "errores de página o consola durante la prueba").toEqual([]);
  },

  // Ir a una ruta y esperar a que la SPA termine de cargar sus datos.
  go: async ({ page }, use) => {
    await use(async (path) => {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
    });
  },

  // Tocar en móvil, hacer clic en escritorio: así las pruebas móviles usan eventos táctiles reales.
  press: async ({ hasTouch }, use) => {
    await use((locator) => (hasTouch ? locator.tap() : locator.click()));
  },

  // Entrar al panel por el formulario de login (modo demo).
  loginAdmin: async ({ page, go, press }, use) => {
    await use(async () => {
      await go("/admin/login");
      await expect(page.locator(".admin-login__demo"), "la app debe estar en modo demo").toBeVisible();
      await page.fill("#admin-email", ADMIN.email);
      await page.fill("#admin-password", ADMIN.password);
      await press(page.locator("button[type=submit]"));
      await page.waitForURL("**/admin");
      await expect(page.locator(".admin-layout__content h1").first()).toBeVisible();
    });
  },

  // Atajo para pruebas que no son del login: deja la sesión demo ya iniciada.
  seedAdminSession: async ({ page }, use) => {
    await use(() =>
      page.addInitScript((email) => localStorage.setItem("acl_local_session", JSON.stringify({ user: { email } })), ADMIN.email),
    );
  },
});

// Fecha ISO (YYYY-MM-DD) a `days` días de hoy; negativo = pasado.
export const isoDate = (days = 0) => new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);

// Revisión de salud común: la pantalla cargó de verdad y no está rota.
export async function expectHealthyPage(page) {
  await expect(page.locator(".error-boundary"), "la pantalla mostró el aviso de error").toHaveCount(0);
  const info = await page.evaluate(() => ({
    textLength: (document.body.innerText || "").trim().length,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    emptySrc: document.querySelectorAll('img[src=""]').length,
    brokenOwnImages: [...document.images]
      .filter((i) => i.complete && i.naturalWidth === 0 && i.getBoundingClientRect().width > 0)
      .filter((i) => i.src.startsWith(location.origin) || i.src.startsWith("data:") || i.src.startsWith("blob:"))
      .map((i) => i.src.slice(0, 80)),
  }));
  expect(info.textLength, "pantalla casi vacía").toBeGreaterThan(40);
  expect(info.overflow, "la página se desborda horizontalmente (px)").toBeLessThanOrEqual(1);
  expect(info.emptySrc, "hay <img src=\"\"> (propiedad o asesor sin foto)").toBe(0);
  expect(info.brokenOwnImages, "imágenes propias rotas").toEqual([]);
}
