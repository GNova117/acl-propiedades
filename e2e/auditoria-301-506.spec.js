import { test, expect } from "./fixtures.js";

// Octava tanda de la auditoría (301–506, lo que se pudo hacer sin decisiones de negocio).

test.describe("Auditoría 301–506", () => {
  test("la ficha dice hace cuánto se publicó", async ({ page, go }) => {
    await go("/propiedades/prop-1");
    await expect(page.locator(".property-detail__code")).toContainText(/Publicada (hoy|hace \d+ días?)/);
  });

  test("la dirección de Contacto es un enlace a «Cómo llegar»", async ({ page, go }) => {
    await go("/contacto");
    await expect(page.locator(".contact-page__address a")).toHaveAttribute("href", /google\.com\/maps\/search/);
  });

  test("el buscador del inicio recuerda la última búsqueda", async ({ page, go, press }) => {
    await go("/");
    await page.locator("input[name=zone]").first().fill("Torreón");
    await page.locator("input[name=maxPrice]").first().fill("2000000");
    await press(page.locator(".search-bar__submit").first());
    await page.waitForURL("**/propiedades?**");
    await go("/");
    await expect(page.locator("input[name=zone]").first()).toHaveValue("Torreón");
    await expect(page.locator("input[name=maxPrice]").first()).toHaveValue("2000000");
  });

  test("«Vistos recientemente» se puede borrar", async ({ page, go, press }) => {
    await go("/propiedades/prop-1");
    await expect(page.locator("h1").first()).toBeVisible();
    await go("/propiedades/prop-2");
    await expect(page.locator("h1").first()).toBeVisible();
    const borrar = page.getByRole("button", { name: "Borrar historial" });
    await expect(borrar).toBeVisible();
    await press(borrar);
    await expect(borrar).toHaveCount(0);
  });

  test("el botón «Limpiar» del listado está deshabilitado sin filtros", async ({ page, go, press }) => {
    await go("/propiedades");
    if (await page.locator(".property-filters__toggle").isVisible()) await press(page.locator(".property-filters__toggle"));
    await expect(page.getByRole("button", { name: "Limpiar" }).first()).toBeDisabled();
  });
});
