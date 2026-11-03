import { chromium } from "@playwright/test";

// Freno de seguridad: estas pruebas crean y borran propiedades, clientes,
// mensajes, etc. Si por cualquier razón el build quedó apuntando a un
// Supabase real, abortar ANTES de que la primera prueba escriba algo.
// En modo demo, /admin/login muestra el aviso con las credenciales de prueba.
export default async function globalSetup(config) {
  const baseURL = config.projects[0].use.baseURL ?? config.use?.baseURL;
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(`${baseURL}/admin/login`);
    const demo = await page
      .locator(".admin-login__demo")
      .waitFor({ timeout: 15_000 })
      .then(() => true)
      .catch(() => false);
    if (!demo) {
      throw new Error(
        "La app NO está en modo demo (sin Supabase). Se cancelan las pruebas e2e para no escribir en una base real. " +
          "Revisa que VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY estén vacías en webServer.env de playwright.config.js.",
      );
    }
  } finally {
    await browser.close();
  }
}
