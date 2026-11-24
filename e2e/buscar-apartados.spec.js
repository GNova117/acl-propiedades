import { test, expect, expectHealthyPage } from "./fixtures.js";

// Botón de la lupa en la barra superior (junto a notificaciones, tema e idioma): abre una ventana donde se escribe una
// palabra clave y salen todas las pantallas del panel relacionadas, aunque la palabra no esté en el nombre.

test.beforeEach(async ({ seedAdminSession }) => {
  await seedAdminSession();
});

test("la lupa está junto a tema e idioma y «crédito» muestra todo lo relacionado", async ({ page, go, press }) => {
  await go("/admin");
  const lupa = page.getByRole("button", { name: "Buscar apartados del panel" });
  await expect(lupa).toBeVisible();

  await press(lupa);
  const dialogo = page.getByRole("dialog", { name: "Buscar en el panel" });
  await expect(dialogo).toBeVisible();
  const campo = dialogo.getByRole("combobox");
  await expect(campo).toBeFocused();

  await campo.fill("crédito");
  const opciones = dialogo.getByRole("option");
  await expect(opciones.filter({ hasText: "Crédito Infonavit" })).toBeVisible();
  await expect(opciones.filter({ hasText: "Solicitud de crédito" })).toBeVisible();
  // También lo que solo tiene que ver con crédito por sus palabras clave (el avalúo se pide para el crédito).
  await expect(opciones.filter({ hasText: "Solicitud de avalúo" })).toBeVisible();
  await expectHealthyPage(page);
});

test("«gastos» lleva al desglose de gastos y al historial; Enter abre el primero", async ({ page, go, press }) => {
  await go("/admin");
  await press(page.getByRole("button", { name: "Buscar apartados del panel" }));
  const campo = page.getByRole("dialog").getByRole("combobox");
  await campo.fill("desglose de gastos");
  await expect(page.getByRole("option").first()).toContainText("Desglose de gastos");

  await campo.fill("gastos");
  await expect(page.getByRole("option", { name: /Historial de gastos/ })).toBeVisible();

  await campo.fill("desglose de gastos");
  await campo.press("Enter");
  await expect(page).toHaveURL(/\/admin\/gastos$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("sin resultados lo dice, y Escape cierra y devuelve el foco a la lupa", async ({ page, go, press }) => {
  await go("/admin");
  const lupa = page.getByRole("button", { name: "Buscar apartados del panel" });
  await press(lupa);
  const campo = page.getByRole("dialog").getByRole("combobox");
  await campo.fill("qwertyuiop");
  await expect(page.getByRole("dialog")).toContainText("No encontramos nada");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(lupa).toBeFocused();
});

test("recorre los resultados con flechas y al elegir uno cambia de pantalla", async ({ page, go, press }) => {
  await go("/admin");
  await press(page.getByRole("button", { name: "Buscar apartados del panel" }));
  const campo = page.getByRole("dialog").getByRole("combobox");
  await campo.fill("credito");
  await campo.press("ArrowDown");
  await expect(page.getByRole("option", { selected: true })).toContainText(/Solicitud de crédito|Crédito Infonavit/);
  await press(page.getByRole("option", { name: /Crédito Infonavit/ }));
  await expect(page).toHaveURL(/\/admin\/credito-infonavit$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("funciona en inglés", async ({ page, go, press }) => {
  await go("/admin");
  await press(page.getByRole("button", { name: /ES · / }));
  await press(page.getByRole("button", { name: "Search panel sections" }));
  const campo = page.getByRole("dialog", { name: "Search the panel" }).getByRole("combobox");
  await campo.fill("mortgage");
  await expect(page.getByRole("option").first()).toBeVisible();
  await expect(page.getByRole("option", { name: /Infonavit/ })).toBeVisible();
});
