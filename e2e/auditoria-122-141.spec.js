import { test, expect } from "./fixtures.js";

// Segunda tanda de la auditoría (122–141): filtro de estatus del listado, aviso en la ficha de una propiedad vendida,
// página de términos y condiciones, aviso de IA en el chat y el visor de PDF por páginas.
const VENDIDA = "ACL-1006";

test.describe("Auditoría 122–141", () => {
  test("el listado oculta las vendidas por omisión y las muestra con «Incluir vendidas»", async ({ page, press }) => {
    await page.goto("/propiedades");
    await expect(page.locator(".property-card").first()).toBeVisible();
    await expect(page.locator(`a[href$="-${VENDIDA}"]`)).toHaveCount(0);

    if (await page.locator(".property-filters__toggle").isVisible()) await press(page.locator(".property-filters__toggle"));
    await page.locator("#filter-status").selectOption("todas");
    await expect(page.locator(`a[href$="-${VENDIDA}"]`).first()).toBeVisible();
  });

  test("la ficha de una propiedad vendida ofrece ver otras en vez de agendar visita", async ({ page }) => {
    await page.goto("/propiedades");
    await page.goto("/propiedades/prop-6");
    await expect(page.getByRole("heading", { name: "Esta propiedad ya se vendió" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ver propiedades disponibles" })).toBeVisible();
  });

  test("los términos y condiciones tienen su página y su enlace en el pie", async ({ page }) => {
    await page.goto("/");
    const enlace = page.locator("footer").getByRole("link", { name: "Términos y condiciones" });
    await expect(enlace).toHaveAttribute("href", "/terminos-y-condiciones");
    await page.goto("/terminos-y-condiciones");
    await expect(page.getByRole("heading", { level: 1, name: "Términos y condiciones" })).toBeVisible();
  });

  test("el chat avisa que es una IA antes de que la persona escriba", async ({ page, press }) => {
    await page.goto("/");
    await press(page.locator(".chat-widget__toggle"));
    await expect(page.locator(".chat-widget__notice")).toContainText("inteligencia artificial");
    await expect(page.locator(".chat-widget__notice a")).toHaveAttribute("href", "/aviso-de-privacidad");
  });
});
