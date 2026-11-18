import { test, expect } from "./fixtures.js";

// Punto 81: páginas por colonia (/propiedades/zona/<ciudad>/<colonia>), con enlaces desde la ciudad y desde la ficha.

async function crearPropiedadEnColonia(page, go, press, titulo) {
  await go("/admin/propiedades/nueva");
  const siguiente = () => press(page.getByRole("button", { name: "Siguiente", exact: true }));
  await page.fill("#p-title", titulo);
  await page.fill("#p-price", "1850000");
  await page.fill("#p-area", "160");
  await siguiente();
  await page.selectOption("#p-zone", { label: "Las Villas" });
  await page.fill("#p-address", "Calle de prueba 1");
  await page.fill("#p-lat", "25.54");
  await page.fill("#p-lng", "-103.41");
  await press(page.locator("form.admin-form button[type=submit]"));
  await page.waitForURL((u) => u.pathname === "/admin/propiedades");
}

test.describe("Páginas por colonia", () => {
  test("una colonia con propiedades tiene su página, se llega desde la ciudad y desde la ficha", async ({ page, go, press, seedAdminSession }) => {
    test.setTimeout(60_000);
    await seedAdminSession();
    const titulo = `Casa en la colonia ${Date.now() % 100000}`;
    await crearPropiedadEnColonia(page, go, press, titulo);

    // La ciudad lista sus colonias con propiedades.
    await go("/propiedades/zona/torreon");
    const colonias = page.getByRole("navigation", { name: /Colonias de Torreón/ });
    const enlace = colonias.getByRole("link", { name: /Las Villas/ });
    await expect(enlace).toBeVisible();
    await expect(enlace).toContainText("(1)");
    await press(enlace);
    await page.waitForURL((u) => u.pathname === "/propiedades/zona/torreon/las-villas");

    // La colonia: título propio, su propiedad, enlace de regreso a la ciudad y se puede indexar.
    await expect(page.locator("h2").first()).toContainText("Propiedades en Las Villas, Torreón");
    await expect(page.locator(".property-card", { hasText: titulo })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ver todo Torreón" })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/propiedades\/zona\/torreon\/las-villas$/);

    // Desde la ficha, la zona lleva a la colonia.
    await press(page.locator(".property-card", { hasText: titulo }).locator("a").first());
    await expect(page.locator(".property-card__type a", { hasText: "Torreón - Las Villas" })).toHaveAttribute("href", "/propiedades/zona/torreon/las-villas");
  });

  test("una colonia sin propiedades avisa y no se indexa; una que no existe es 404", async ({ page, go }) => {
    await go("/propiedades/zona/torreon/real-del-nogalar");
    await expect(page.locator("h2").first()).toContainText("Propiedades en Real del Nogalar, Torreón");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);

    await go("/propiedades/zona/torreon/colonia-que-no-existe");
    await expect(page.locator("h1")).toContainText("404");
    await go("/propiedades/zona/ciudad-que-no-existe/las-villas");
    await expect(page.locator("h1")).toContainText("404");
  });
});
