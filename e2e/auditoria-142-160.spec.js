import { test, expect, ADMIN } from "./fixtures.js";

// Tercera tanda de la auditoría (142–160): zona escrita a medias, código en la ficha, tema que solo se guarda al elegirlo,
// título de pestaña en el panel y en /firmar, 404 dentro del panel y regreso al enlace profundo tras iniciar sesión.

test.describe("Auditoría 142–160", () => {
  test("la zona se busca por parte del nombre y sin importar mayúsculas", async ({ page, go, press }) => {
    await go("/propiedades?zona=Torreón");
    await expect(page.locator(".property-card").first()).toBeVisible();
    const exacta = await page.locator(".property-card").count();
    expect(exacta).toBeGreaterThan(0);

    await go("/propiedades");
    if (await page.locator(".property-filters__toggle").isVisible()) await press(page.locator(".property-filters__toggle"));
    await page.locator("#filter-zone").fill("torre");
    await expect.poll(() => page.locator(".property-card").count()).toBe(exacta);
  });

  test("el código de la propiedad se ve en la tarjeta y en la ficha", async ({ page, go }) => {
    await go("/propiedades");
    await expect(page.locator(".property-card__code").first()).toContainText("ACL-");
    await go("/propiedades/prop-1");
    await expect(page.locator(".property-detail__code")).toContainText("ACL-1001");
  });

  test("el tema solo se guarda cuando la persona lo elige", async ({ page, go, press }) => {
    await go("/");
    expect(await page.evaluate(() => localStorage.getItem("acl_theme"))).toBeNull();
    const boton = page.locator("button[aria-label^='Activar modo']").first();
    await press(boton);
    expect(await page.evaluate(() => localStorage.getItem("acl_theme"))).toMatch(/light|dark/);
  });

  test("/firmar pone su propio título de pestaña", async ({ page, go }) => {
    await go("/firmar/token-falso");
    await expect(page).toHaveTitle(/Firma de documento/);
  });

  test("el panel pone el nombre de la pantalla en la pestaña", async ({ page, loginAdmin, go }) => {
    await loginAdmin();
    await expect(page).toHaveTitle(/Panel ACL/);
    await go("/admin/prospectos");
    await expect(page).toHaveTitle(/Prospectos.*Panel ACL/);
  });

  test("una dirección que no existe dentro del panel se queda en el panel", async ({ page, loginAdmin, go }) => {
    await loginAdmin();
    await go("/admin/prospecto");
    await expect(page.getByRole("heading", { name: "Esta pantalla no existe" })).toBeVisible();
    await expect(page.locator(".admin-layout")).toBeVisible();
    await expect(page.getByRole("link", { name: "Ir al panel" })).toHaveAttribute("href", "/admin");
  });

  test("tras iniciar sesión se vuelve al enlace profundo que traía la persona", async ({ page, go, press }) => {
    await go("/admin/prospectos?etapa=nuevo");
    await page.waitForURL("**/admin/login");
    await expect(page.locator(".admin-login__demo")).toBeVisible();
    await page.fill("#admin-email", ADMIN.email);
    await page.fill("#admin-password", ADMIN.password);
    await press(page.locator("button[type=submit]"));
    await page.waitForURL("**/admin/prospectos?etapa=nuevo");
    await expect(page.locator(".admin-layout")).toBeVisible();
  });
});
