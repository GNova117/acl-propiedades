import { test, expect } from "./fixtures.js";

// «Reportar un problema»: el equipo cuenta qué notó y queda en «Errores del sitio» con su correo como etiqueta.
test.describe("Reportar un problema", () => {
  test.beforeEach(async ({ seedAdminSession }) => {
    await seedAdminSession();
  });

  test("se escribe, se envía y aparece en Errores del sitio con quién lo mandó", async ({ page, go, press, isMobile }) => {
    await go("/admin/propiedades");
    if (isMobile) await press(page.locator(".admin-layout__menu-btn"));
    await press(page.getByRole("button", { name: "Reportar un problema" }));
    const ventana = page.getByRole("dialog", { name: "Reportar un problema" });
    await expect(ventana).toBeVisible();
    await expect(ventana).toContainText("admin@aclpropiedades.com"); // se ve con qué correo se manda
    await expect(ventana).toContainText("/admin/propiedades");

    // Muy corto: no se manda.
    await ventana.locator("#problem-text").fill("no carga");
    await press(ventana.getByRole("button", { name: "Enviar reporte" }));
    await expect(ventana.getByRole("alert")).toContainText("al menos 10 caracteres");

    await ventana.locator("#problem-text").fill("Al guardar la propiedad me sale un error raro");
    await press(ventana.getByRole("button", { name: "Enviar reporte" }));
    await expect(ventana.getByRole("status")).toContainText("Ya lo recibimos");
    await press(ventana.getByRole("button", { name: "Cerrar" }).last());
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await go("/admin/errores");
    const item = page.locator(".admin-errors__item", { hasText: "Al guardar la propiedad me sale un error raro" });
    await expect(item).toHaveCount(1);
    await expect(item.locator(".admin-errors__who")).toContainText("admin@aclpropiedades.com");
    await expect(item).toContainText("/admin/propiedades");
    await expect(item.locator(".admin-errors__count")).toHaveCount(0); // un reporte no lleva «×N»

    // El filtro por tipo los separa de los errores automáticos.
    await press(page.getByRole("button", { name: "Errores automáticos" }));
    await expect(page.locator(".admin-errors__item", { hasText: "Al guardar la propiedad" })).toHaveCount(0);
    await press(page.getByRole("button", { name: "Reportes del equipo" }));
    await expect(page.locator(".admin-errors__item", { hasText: "Al guardar la propiedad" })).toHaveCount(1);
  });

  test("Escape cierra la ventana sin mandar nada", async ({ page, go, press, isMobile }) => {
    await go("/admin/propiedades");
    if (isMobile) await press(page.locator(".admin-layout__menu-btn"));
    await press(page.getByRole("button", { name: "Reportar un problema" }));
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem("acl_local_client_errors"))).toBeNull();
  });
});
