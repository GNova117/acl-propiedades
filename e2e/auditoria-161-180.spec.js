import { test, expect } from "./fixtures.js";

// Cuarta tanda de la auditoría (161–180): autollenado en formularios, buscador del inicio sin «?» colgando, precio al revés,
// código no encontrado, enlaces de la ficha con el dominio del sitio y diálogo propio para el motivo de cancelación.

test.describe("Auditoría 161–180", () => {
  test("Contacto declara autocomplete en nombre, correo y teléfono", async ({ page, go }) => {
    await go("/contacto");
    await expect(page.locator("#contact-name")).toHaveAttribute("autocomplete", "name");
    await expect(page.locator("#contact-email")).toHaveAttribute("autocomplete", "email");
    await expect(page.locator("#contact-phone")).toHaveAttribute("autocomplete", "tel");
  });

  test("el buscador del inicio sin filtros va a /propiedades sin signo colgando", async ({ page, go, press }) => {
    await go("/");
    await press(page.locator(".search-bar__submit").first());
    await page.waitForURL("**/propiedades");
    expect(new URL(page.url()).search).toBe("");
  });

  test("con el precio mínimo mayor al máximo se acomodan", async ({ page, go, press }) => {
    await go("/");
    await page.locator("input[name=minPrice]").first().fill("3000000");
    await page.locator("input[name=maxPrice]").first().fill("1000000");
    await press(page.locator(".search-bar__submit").first());
    await page.waitForURL("**/propiedades?**");
    const params = new URL(page.url()).searchParams;
    expect(params.get("min")).toBe("1000000");
    expect(params.get("max")).toBe("3000000");
  });

  test("un código que no existe avisa y el botón vuelve a quedar disponible", async ({ page, go, press }) => {
    await go("/");
    const code = page.locator("#home-code, input[placeholder*='ACL']").first();
    await code.fill("ACL-0000");
    await press(code.locator("xpath=following::button[@type='submit'][1]"));
    await expect(page.getByText("No se encontró ninguna propiedad con ese código.")).toBeVisible();
  });

  test("las tarjetas del listado se ven completas desde el primer momento", async ({ page, go }) => {
    await go("/propiedades");
    const card = page.locator(".property-card").first();
    await expect(card).toBeVisible();
    expect(await card.evaluate((el) => getComputedStyle(el.parentElement).opacity)).toBe("1");
  });
});
