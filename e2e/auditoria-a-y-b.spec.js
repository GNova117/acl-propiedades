import { test, expect } from "./fixtures.js";

// Tanda «A y B» de la lista maestra (pendientes sin SQL).

test.describe("Tanda A y B", () => {
  test("Contacto dice si la oficina está abierta o cerrada", async ({ page, go }) => {
    await go("/contacto");
    await expect(page.locator(".contact-page__open")).toHaveText(/Abierto ahora|Cerrado ahora/);
  });

  test("un artículo del blog se puede compartir", async ({ page, go, press }) => {
    await go("/blog");
    await press(page.locator("main a[href^='/blog/']").first());
    await page.waitForURL(/\/blog\/.+/);
    await expect(page.locator(".blog-post__share")).toContainText("Compartir");
  });

  test("«Reportar un error» abre Contacto con el mensaje empezado", async ({ page, go, press }) => {
    await go("/propiedades/prop-1");
    await press(page.locator(".property-detail__report"));
    await page.waitForURL("**/contacto?mensaje=**");
    await expect(page.locator("textarea[name=message]")).toHaveValue(/Encontré un error en la publicación ACL-/);
  });

  test("una propiedad que no existe sugiere otras disponibles", async ({ page, go }) => {
    await go("/propiedades/no-existe-ACL-999999");
    await expect(page.locator(".property-card").first()).toBeVisible();
  });

  test("atajo «G» y luego «P» lleva a Prospectos en el panel", async ({ page, seedAdminSession, go }) => {
    await seedAdminSession();
    await go("/admin");
    await expect(page.locator(".admin-layout__content h1").first()).toBeVisible();
    await page.locator("body").press("g");
    await page.locator("body").press("p");
    await page.waitForURL("**/admin/prospectos");
  });

  test("la Ayuda del panel documenta los atajos", async ({ page, seedAdminSession, go }) => {
    await seedAdminSession();
    await go("/admin/ayuda");
    await expect(page.getByText("Atajos de teclado")).toBeVisible();
  });
});
