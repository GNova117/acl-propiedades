import { test, expect, llenarCreditoInfonavit, llenarDatosObligatoriosCliente } from "./fixtures.js";

// Datos obligatorios del cliente (ver requiredClientKeys):
//  - Cualquiera: nombre completo, fecha de nacimiento, domicilio, estado civil (casado o soltero) y 2 referencias personales
//    (nombre y teléfono).
//  - Comprador: además teléfono, CURP, RFC y teléfono de su empresa.
//  - Con financiamiento INFONAVIT, comprador y vendedor: número de crédito, NSS y contraseña de Mi Cuenta Infonavit.

const COMUNES = ["name", "fecha_nacimiento", "estado_civil", "domicilio", "referencia1_nombre", "referencia1_telefono", "referencia2_nombre", "referencia2_telefono"];
const SOLO_COMPRADOR = ["phone", "rfc", "curp", "tel_empresa"];
const CREDITO = ["numero_credito", "nss", "contrasena_portal"];

test.beforeEach(async ({ seedAdminSession }) => {
  await seedAdminSession();
});

const guardar = (page, press) => press(page.getByRole("button", { name: "Guardar" }));

test("comprador: un formulario vacío señala todo lo obligatorio, con * y el foco en el primero", async ({ page, go, press }) => {
  await go("/admin/clientes/nuevo");
  await guardar(page, press);
  await expect(page).toHaveURL(/\/admin\/clientes\/nuevo$/);
  for (const clave of [...COMUNES, ...SOLO_COMPRADOR]) {
    await expect(page.locator(`#c-${clave}-error`), clave).toHaveText("Este campo es obligatorio");
    await expect(page.locator(`label[for="c-${clave}"]`), clave).toContainText("*");
  }
  await expect(page.locator("#c-email-error")).toHaveCount(0); // el correo ya no es obligatorio
  await expect(page.locator("#c-name")).toBeFocused();
  await expect(page.locator("#c-numero_credito")).toHaveCount(0); // el crédito solo se pide con Infonavit
});

test("estado civil: solo casado o soltero", async ({ page, go }) => {
  await go("/admin/clientes/nuevo");
  const opciones = await page.locator("#c-estado_civil option").allTextContents();
  expect(opciones).toEqual(["—", "Soltero", "Casado"]);
});

test("comprador completo, sin Infonavit: guarda (los espacios no cuentan como dato)", async ({ page, go, press }) => {
  await go("/admin/clientes/nuevo");
  await page.fill("#c-name", "Comprador contado QA");
  await page.selectOption("#c-financiamiento", "contado");
  await llenarDatosObligatoriosCliente(page, "comprador");
  await page.fill("#c-tel_empresa", "   ");
  await guardar(page, press);
  await expect(page.locator("#c-tel_empresa-error")).toBeVisible();
  await expect(page.locator("#c-tel_empresa")).toBeFocused();

  await page.fill("#c-tel_empresa", "8713333333");
  await guardar(page, press);
  await expect(page).toHaveURL(/\/admin\/clientes$/);
});

test("vendedor: pide lo común pero no teléfono, RFC, CURP ni empresa", async ({ page, go, press }) => {
  await go("/admin/clientes/nuevo");
  await page.selectOption("#c-type", "vendedor");
  await expect(page.locator("#c-tel_empresa")).toHaveCount(0);
  await guardar(page, press);
  for (const clave of COMUNES) await expect(page.locator(`#c-${clave}-error`), clave).toBeVisible();
  for (const clave of SOLO_COMPRADOR) await expect(page.locator(`#c-${clave}-error`), clave).toHaveCount(0);

  await page.fill("#c-name", "Vendedor contado QA");
  await llenarDatosObligatoriosCliente(page, "vendedor");
  await guardar(page, press);
  await expect(page).toHaveURL(/\/admin\/clientes$/);
});

for (const tipo of ["comprador", "vendedor"]) {
  test(`${tipo} con INFONAVIT: sin número de crédito, NSS y contraseña no guarda; con ellos sí`, async ({ page, go, press }) => {
    await go("/admin/clientes/nuevo");
    await page.fill("#c-name", `${tipo} Infonavit QA`);
    await page.selectOption("#c-type", tipo);
    await llenarDatosObligatoriosCliente(page, tipo);
    await page.selectOption("#c-financiamiento", "infonavit");

    await guardar(page, press);
    await expect(page).toHaveURL(/\/admin\/clientes\/nuevo$/);
    for (const clave of CREDITO) {
      await expect(page.locator(`#c-${clave}-error`), clave).toHaveText("Este campo es obligatorio");
      await expect(page.locator(`label[for="c-${clave}"]`), clave).toContainText("*");
    }
    await expect(page.locator("#c-numero_credito")).toBeFocused();
    await expect(page.locator('label[for="c-contrasena_portal"]')).toContainText("Mi Cuenta Infonavit");

    await llenarCreditoInfonavit(page);
    await guardar(page, press);
    await expect(page).toHaveURL(/\/admin\/clientes$/);
  });
}
