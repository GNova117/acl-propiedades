import { test, expect } from "./fixtures.js";

// Punto 99: app pública instalable. El manifiesto depende de la zona (pública / panel) y se ofrece instalar sin estorbar.
test.describe("App pública instalable", () => {
  test("el sitio público enlaza su manifiesto y el panel el suyo (al cargar la página)", async ({ page, go }) => {
    await go("/nosotros");
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest-public.webmanifest");
    await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute("content", "ACL Propiedades");
    await go("/admin/login");
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");
    await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute("content", "ACL Panel");
  });

  test("los dos manifiestos se sirven y son válidos", async ({ page, request, baseURL }) => {
    for (const [path, shortName] of [["/manifest-public.webmanifest", "ACL"], ["/manifest.webmanifest", "ACL Panel"]]) {
      const res = await request.get(`${baseURL}${path}`);
      expect(res.ok(), path).toBe(true);
      expect((await res.json()).short_name).toBe(shortName);
    }
    expect(page).toBeTruthy();
  });

  test("iPhone: tras la segunda página se invita a instalar con la guía de «Compartir», y «Ahora no» lo recuerda", async ({ page, go, press, isMobile }) => {
    test.skip(!isMobile, "el teléfono de la prueba es un iPhone; en escritorio el aviso depende del navegador");
    await go("/");
    await expect(page.locator(".install-banner")).toHaveCount(0); // primera página: todavía no
    await press(page.locator(".public-tab-bar").getByRole("link", { name: "Buscar" }));
    const banner = page.locator(".install-banner");
    await expect(banner).toBeVisible();
    await press(banner.getByRole("button", { name: "Instalar" }));
    await expect(banner).toContainText("Añadir a pantalla de inicio");
    await press(banner.getByRole("button", { name: "Ahora no" }));
    await expect(banner).toHaveCount(0);
    await go("/propiedades");
    await press(page.locator(".public-tab-bar").getByRole("link", { name: "Contacto" }));
    await expect(page.locator(".install-banner")).toHaveCount(0); // quedó pospuesto
  });

  test("en el panel nunca aparece la invitación pública", async ({ page, go, seedAdminSession }) => {
    await seedAdminSession();
    await go("/admin/propiedades");
    await expect(page.locator(".install-banner")).toHaveCount(0);
  });
});
