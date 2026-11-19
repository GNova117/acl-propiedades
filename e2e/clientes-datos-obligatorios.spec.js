import { test, expect } from "./fixtures.js";

// Con financiamiento INFONAVIT el expediente de crédito es obligatorio: NSS y contraseña del portal (comprador) y
// número de crédito (vendedor). Sin INFONAVIT no se exige nada de eso.

test.beforeEach(async ({ seedAdminSession }) => {
  await seedAdminSession();
});

test("comprador con INFONAVIT: sin NSS y contraseña no guarda; con ellos sí", async ({ page, go, press }) => {
  await go("/admin/clientes/nuevo");
  await page.fill("#c-name", "Cliente Infonavit QA");
  await page.selectOption("#c-financiamiento", "infonavit");

  await press(page.getByRole("button", { name: "Guardar" }));
  await expect(page).toHaveURL(/\/admin\/clientes\/nuevo$/);
  await expect(page.locator("#c-nss-error")).toHaveText("Este campo es obligatorio");
  await expect(page.locator("#c-contrasena_portal-error")).toHaveText("Este campo es obligatorio");
  await expect(page.locator("#c-nss")).toBeFocused();
  await expect(page.locator("#c-numero_credito")).toHaveCount(0); // el comprador no lo captura

  await page.fill("#c-nss", "12345678901");
  await page.fill("#c-contrasena_portal", "   ");
  await press(page.getByRole("button", { name: "Guardar" }));
  await expect(page.locator("#c-contrasena_portal-error")).toBeVisible(); // espacios no cuentan

  await page.fill("#c-contrasena_portal", "Clave-QA-1");
  await press(page.getByRole("button", { name: "Guardar" }));
  await expect(page).toHaveURL(/\/admin\/clientes$/);
});

test("vendedor con INFONAVIT: el número de crédito es obligatorio", async ({ page, go, press }) => {
  await go("/admin/clientes/nuevo");
  await page.fill("#c-name", "Vendedor Infonavit QA");
  await page.selectOption("#c-type", "vendedor");
  await page.selectOption("#c-financiamiento", "infonavit");
  await expect(page.locator("#c-nss")).toHaveCount(0);

  await press(page.getByRole("button", { name: "Guardar" }));
  await expect(page.locator("#c-numero_credito-error")).toBeVisible();
  await expect(page.locator("#c-numero_credito")).toBeFocused();

  await page.fill("#c-numero_credito", "1234567890");
  await press(page.getByRole("button", { name: "Guardar" }));
  await expect(page).toHaveURL(/\/admin\/clientes$/);
});

test("sin INFONAVIT no se exige el expediente de crédito", async ({ page, go, press }) => {
  await go("/admin/clientes/nuevo");
  await page.fill("#c-name", "Cliente contado QA");
  await page.selectOption("#c-financiamiento", "contado");
  await press(page.getByRole("button", { name: "Guardar" }));
  await expect(page).toHaveURL(/\/admin\/clientes$/);
});
