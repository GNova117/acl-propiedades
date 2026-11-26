import { test, expect } from "./fixtures.js";

// Quinta tanda de la auditoría (181–200): filtro renta/venta en naves, teléfono y hora en los formularios, código solo con número,
// un solo <h1> por página, título del inicio, datos estructurados de la ficha y preguntas frecuentes por ciudad.

test.describe("Auditoría 181–200", () => {
  test("Naves industriales ofrece el filtro de renta o venta", async ({ page, go, press }) => {
    await go("/naves-industriales");
    if (await page.locator(".property-filters__toggle").isVisible()) await press(page.locator(".property-filters__toggle"));
    await expect(page.locator("#filter-operation")).toBeVisible();
  });

  test("Terrenos no ofrece renta o venta", async ({ page, go, press }) => {
    await go("/terrenos");
    if (await page.locator(".property-filters__toggle").isVisible()) await press(page.locator(".property-filters__toggle"));
    await expect(page.locator("#filter-operation")).toHaveCount(0);
  });

  test("Contacto rechaza un teléfono que no lo es", async ({ page, go, press }) => {
    await go("/contacto");
    await page.fill("#contact-name", "Ana QA");
    await page.fill("#contact-email", "ana.qa@correo.com");
    await page.fill("#contact-phone", "abc");
    await page.fill("#contact-message", "Hola");
    await press(page.locator("form button[type=submit]").first());
    await expect(page.getByText("Escribe un teléfono de al menos 10 dígitos")).toBeVisible();
  });

  test("la hora de la visita se elige de una lista cada 30 minutos", async ({ page, go }) => {
    await go("/propiedades/prop-1");
    const select = page.locator("select#visit-time");
    await expect(select).toBeVisible();
    const values = await select.locator("option").evaluateAll((options) => options.map((o) => o.value).filter(Boolean));
    expect(values[0]).toBe("09:00");
    expect(values).toContain("13:30");
    expect(values).not.toContain("13:07");
    expect(values.at(-1)).toBe("20:00");
  });

  test("«Buscar por código» acepta solo el número", async ({ page, go, press }) => {
    await go("/propiedades");
    if (await page.locator(".property-filters__toggle").isVisible()) await press(page.locator(".property-filters__toggle"));
    await page.fill("#filter-code", "1001");
    await press(page.locator(".property-filters__code-row button[type=submit]"));
    await page.waitForURL("**/propiedades/**ACL-1001");
  });

  test("cada página pública tiene un solo <h1>", async ({ page, go }) => {
    for (const path of ["/", "/propiedades", "/terrenos", "/naves-industriales", "/contacto", "/calculadora", "/nosotros", "/favoritos", "/aviso-de-privacidad", "/carta-de-derechos", "/propiedades/zona/torreon"]) {
      await go(path);
      await expect(page.locator("h1").first(), path).toBeVisible();
      expect(await page.locator("h1").count(), `h1 en ${path}`).toBe(1);
    }
  });

  test("el inicio conserva el título que posiciona", async ({ page, go }) => {
    await go("/");
    await expect(page).toHaveTitle("ACL Propiedades | Inmobiliaria en La Comarca Lagunera");
  });

  test("la ficha trae sus datos estructurados completos", async ({ page, go }) => {
    await go("/propiedades/prop-1");
    await expect(page.locator("h1").first()).toBeVisible();
    const data = await page.locator("script#seo-jsonld").evaluate((el) => JSON.parse(el.textContent));
    const listing = data.find((item) => item["@type"] === "RealEstateListing");
    const breadcrumbs = data.find((item) => item["@type"] === "BreadcrumbList");
    expect(listing.address.addressRegion).toBeTruthy();
    expect(JSON.stringify(listing)).not.toContain("null");
    expect(breadcrumbs.itemListElement.map((item) => item.position)).toEqual([1, 2, 3]);
    expect(breadcrumbs.itemListElement[0].name).toBe("Inicio");
  });

  test("la página de una ciudad trae preguntas frecuentes y su dato estructurado", async ({ page, go }) => {
    await go("/propiedades/zona/torreon");
    await expect(page.getByRole("heading", { name: "Preguntas frecuentes sobre Torreón" })).toBeVisible();
    const data = await page.locator("script#seo-jsonld").evaluate((el) => JSON.parse(el.textContent));
    expect(data["@type"]).toBe("FAQPage");
    expect(data.mainEntity.length).toBe(4);
  });
});
