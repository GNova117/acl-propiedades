import { test, expect, llenarDatosBasicosCliente } from "./fixtures.js";

// El formulario de cliente exige siempre los datos básicos (nombre, teléfono, correo y todos los «Datos personales»).
// Con financiamiento INFONAVIT exige además el expediente de crédito: NSS y contraseña del portal (comprador) y número
// de crédito (vendedor). Sin INFONAVIT no se piden esos datos de crédito.

const DATOS_PERSONALES = ["fecha_nacimiento", "estado_civil", "domicilio", "rfc", "curp", "identificacion_oficial"];

test.beforeEach(async ({ seedAdminSession }) => {
  await seedAdminSession();
});

test("un formulario vacío señala todos los datos básicos y lleva el foco al primero", async ({ page, go, press }) => {
  await go("/admin/clientes/nuevo");
  await press(page.getByRole("button", { name: "Guardar" }));
  await expect(page).toHaveURL(/\/admin\/clientes\/nuevo$/);
  for (const clave of ["name", "phone", "email", ...DATOS_PERSONALES]) {
    await expect(page.locator(`#c-${clave}-error`), clave).toHaveText("Este campo es obligatorio");
  }
  await expect(page.locator("#c-name")).toBeFocused();
  await expect(page.locator('label[for="c-curp"]')).toContainText("*");
});

test("con todos los datos básicos guarda, sin pedir nada de crédito si no es INFONAVIT", async ({ page, go, press }) => {
  await go("/admin/clientes/nuevo");
  await page.fill("#c-name", "Cliente contado QA");
  await page.selectOption("#c-financiamiento", "contado");
  await expect(page.locator("#c-nss")).toHaveCount(0);

  await llenarDatosBasicosCliente(page);
  await page.fill("#c-rfc", "   "); // los espacios no cuentan como dato
  await press(page.getByRole("button", { name: "Guardar" }));
  await expect(page.locator("#c-rfc-error")).toBeVisible();
  await expect(page.locator("#c-rfc")).toBeFocused();

  await page.fill("#c-rfc", "XAXX010101000");
  await press(page.getByRole("button", { name: "Guardar" }));
  await expect(page).toHaveURL(/\/admin\/clientes$/);
});

test("comprador con INFONAVIT: sin NSS y contraseña no guarda; con ellos sí", async ({ page, go, press }) => {
  await go("/admin/clientes/nuevo");
  await page.fill("#c-name", "Cliente Infonavit QA");
  await llenarDatosBasicosCliente(page);
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
  await expect(page.locator("#c-contrasena_portal-error")).toBeVisible();

  await page.fill("#c-contrasena_portal", "Clave-QA-1");
  await press(page.getByRole("button", { name: "Guardar" }));
  await expect(page).toHaveURL(/\/admin\/clientes$/);
});

test("vendedor con INFONAVIT: el número de crédito es obligatorio", async ({ page, go, press }) => {
  await go("/admin/clientes/nuevo");
  await page.fill("#c-name", "Vendedor Infonavit QA");
  await page.selectOption("#c-type", "vendedor");
  await llenarDatosBasicosCliente(page);
  await page.selectOption("#c-financiamiento", "infonavit");
  await expect(page.locator("#c-nss")).toHaveCount(0);

  await press(page.getByRole("button", { name: "Guardar" }));
  await expect(page.locator("#c-numero_credito-error")).toBeVisible();
  await expect(page.locator("#c-numero_credito")).toBeFocused();

  await page.fill("#c-numero_credito", "1234567890");
  await press(page.getByRole("button", { name: "Guardar" }));
  await expect(page).toHaveURL(/\/admin\/clientes$/);
});
