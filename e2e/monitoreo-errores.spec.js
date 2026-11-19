import { test, expect } from "./fixtures.js";

// Punto 86: los errores del navegador se registran (agrupados, sin datos personales) y se ven en /admin/errores.

// Dispara el mismo camino que un error real de la página sin hacer fallar la prueba por «pageerror».
const lanzarError = (page, mensaje, ruta) =>
  page.evaluate(
    ([msg, path]) => {
      window.history.replaceState({}, "", path);
      window.dispatchEvent(new ErrorEvent("error", { error: new Error(msg), message: msg }));
    },
    [mensaje, ruta],
  );

test.describe("Monitoreo de errores", () => {
  test("un error del sitio queda agrupado, sin tokens en la ruta, y se puede resolver", async ({ page, go, press, seedAdminSession }) => {
    await seedAdminSession();
    await go("/nosotros"); // (no /contacto: su mapa embebido es un iframe externo y la sesión sembrada no puede leerse allí)
    await lanzarError(page, "No se pudo leer la propiedad 12", "/visita/TOKEN-SECRETO-123?nombre=Ana");
    await lanzarError(page, "No se pudo leer la propiedad 99", "/nosotros"); // misma huella (cambia solo el número) → no se manda otra vez desde esta página
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("acl_local_client_errors") || "[]").length)).toBe(1);

    await go("/admin/errores");
    const item = page.locator(".admin-errors__item");
    await expect(item).toHaveCount(1);
    await expect(item).toContainText("No se pudo leer la propiedad 12");
    await expect(item).toContainText("/visita/:token");
    await expect(item).not.toContainText("TOKEN-SECRETO");
    await expect(item).not.toContainText("Ana");
    await expect(item.locator(".admin-errors__count")).toHaveText("×1");

    await press(item.getByRole("button", { name: "Ver detalle" }));
    await expect(item.locator(".admin-errors__stack")).toBeVisible();

    await press(item.getByRole("button", { name: "Marcar resuelto" }));
    await expect(page.locator(".admin-errors__item")).toHaveCount(0);
    await expect(page.getByText("No hay errores nuevos")).toBeVisible();
    await press(page.getByRole("tab", { name: /Resueltos/ }));
    await expect(page.locator(".admin-errors__item")).toHaveCount(1);
    await press(page.locator(".admin-errors__item").getByRole("button", { name: "Reabrir" }));
    await press(page.getByRole("tab", { name: /Nuevos/ }));
    await expect(page.locator(".admin-errors__item")).toHaveCount(1);
  });

  test("el ruido conocido del navegador no se registra", async ({ page, go }) => {
    await go("/contacto");
    await lanzarError(page, "ResizeObserver loop completed with undelivered notifications.", "/contacto");
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => localStorage.getItem("acl_local_client_errors"))).toBeNull();
  });
});
