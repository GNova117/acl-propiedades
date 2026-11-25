import { test, expect } from "./fixtures.js";

// Ubicación aproximada: la ficha pública muestra un círculo y la zona (no el punto, ni la calle, ni «Cómo llegar» ni Street View).
// Una propiedad normal sigue mostrando todo. El formulario del panel trae la casilla.

async function marcarAproximada(page, go, valor) {
  await go("/");
  await page.evaluate((v) => {
    const clave = "acl_local_properties";
    const lista = JSON.parse(localStorage.getItem(clave));
    lista.find((p) => p.id === "prop-1").location_approximate = v;
    localStorage.setItem(clave, JSON.stringify(lista));
  }, valor);
}

test.describe("Ubicación aproximada", () => {
  test("con la casilla: círculo y zona, sin calle, sin «Cómo llegar» ni Street View", async ({ page, go }) => {
    await marcarAproximada(page, go, true);
    await go("/propiedades/prop-1");
    await expect(page.getByRole("heading", { level: 1, name: "Casa en Residencial Senderos" })).toBeVisible();

    await expect(page.getByText("Ubicación aproximada: el vendedor prefiere no publicar el punto exacto")).toBeVisible();
    await expect(page.locator(".property-detail__address")).toHaveText("Torreón"); // la zona, no «Residencial Senderos, Torreón, Coahuila»
    await expect(page.getByRole("link", { name: "Street View" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Cómo llegar" })).toHaveCount(0);

    // El mapa dibuja un círculo (SVG) y ningún marcador de esa propiedad.
    await expect(page.locator(".property-map .leaflet-overlay-pane path.leaflet-interactive")).toHaveCount(1);
    await expect(page.locator(".property-map .leaflet-marker-icon")).toHaveCount(0);

    // El JSON-LD no publica la calle.
    const jsonLd = await page.locator("script#seo-jsonld").textContent();
    expect(jsonLd).not.toContain("streetAddress");
  });

  test("sin la casilla todo sigue igual: marcador, calle y enlaces de mapa", async ({ page, go }) => {
    await marcarAproximada(page, go, false);
    await go("/propiedades/prop-1");
    await expect(page.locator(".property-detail__address")).toHaveText("Residencial Senderos, Torreón, Coahuila");
    await expect(page.getByRole("link", { name: "Street View" })).toBeVisible();
    await expect(page.locator(".property-map .leaflet-marker-icon")).toHaveCount(1);
    await expect(page.locator(".property-map .leaflet-overlay-pane path.leaflet-interactive")).toHaveCount(0);
    await expect(page.getByText("Ubicación aproximada: el vendedor prefiere")).toHaveCount(0);
  });

  test("el formulario del panel trae la casilla y la conserva al guardar", async ({ page, go, seedAdminSession }) => {
    await seedAdminSession();
    await go("/admin/propiedades/prop-1");
    const casilla = page.locator("#p-approx");
    await expect(casilla).toBeAttached();
    await casilla.evaluate((el) => el.click());
    await expect(casilla).toBeChecked();
  });
});
