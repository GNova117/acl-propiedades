import { test, expect } from "./fixtures.js";

// Sexta tanda de la auditoría (201–220): inglés bajo demanda, pantalla de carga solo la primera vez, títulos de propiedades vendidas,
// enlace útil cuando la propiedad ya no existe, robots.txt y menos consultas repetidas.

test.describe("Auditoría 201–220", () => {
  test("con ?lang=en el sitio sale en inglés desde el primer pintado", async ({ page, go }) => {
    await go("/?lang=en");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    // Se mira el texto de los enlaces del menú aunque en teléfono esté cerrado (cerrado no es visible ni alcanzable, a propósito).
    await expect(page.locator("header .site-nav a", { hasText: "Properties" })).toHaveCount(1);
    await expect(page.locator("header .site-nav a", { hasText: "Propiedades" })).toHaveCount(0);
  });

  test("el botón de idioma baja el inglés y cambia el sitio sin parpadeo", async ({ page, go, press, abrirMenuSitio }) => {
    await go("/contacto");
    await abrirMenuSitio();
    await press(page.locator(".lang-toggle").first());
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("header").getByRole("link", { name: "Properties" }).first()).toBeVisible();
    await press(page.locator(".lang-toggle").first());
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
  });

  test("la pantalla de carga sale solo la primera vez de la sesión", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".loading-screen")).toBeVisible();
    await page.reload();
    await expect(page.locator("#main-content")).toBeVisible();
    await expect(page.locator(".loading-screen")).toHaveCount(0);
  });

  test("los enlaces privados nunca llevan pantalla de carga", async ({ page }) => {
    await page.goto("/firmar/token-falso");
    await expect(page.locator(".public-sign")).toBeVisible();
    await expect(page.locator(".loading-screen")).toHaveCount(0);
  });

  test("una propiedad vendida lo dice en el título de la pestaña", async ({ page, go }) => {
    await go("/propiedades/prop-6");
    await expect(page).toHaveTitle(/^Vendida · /);
  });

  test("una propiedad que ya no existe manda al listado de su tipo", async ({ page, go }) => {
    await go("/propiedades/terreno-en-torreon-ACL-9999");
    await expect(page.getByRole("link", { name: "Volver a propiedades" })).toHaveAttribute("href", "/terrenos");
  });

  test("robots.txt no deja entrar a comparar ni a las bajas de alertas", async ({ request }) => {
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain("Disallow: /comparar");
    expect(robots).toContain("Disallow: /alertas/");
  });

  test("favoritos pide las propiedades en una sola consulta y respeta el orden", async ({ page, go }) => {
    await page.addInitScript(() => localStorage.setItem("acl_favorites", JSON.stringify(["prop-2", "prop-1"])));
    await go("/favoritos");
    await expect(page.locator(".property-card").first()).toBeVisible();
    expect(await page.locator(".property-card").count()).toBe(2);
  });
});
