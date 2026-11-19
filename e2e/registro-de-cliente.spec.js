import { test, expect } from "./fixtures.js";

// Enlace de registro del cliente: el asesor elige el tipo (comprador/vendedor/ambos) y genera un enlace (/registro/<token>); el
// cliente lo abre SIN iniciar sesión, llena sus datos y al enviar aparece en Clientes con el tipo que eligió el asesor. El enlace
// sirve una sola vez. Modo demo: la «base» es el localStorage de la prueba.

const leer = (page, clave) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "[]"), clave);

test.describe("Registro del cliente por enlace", () => {
  test.beforeEach(async ({ seedAdminSession }) => {
    await seedAdminSession();
  });

  test("el asesor genera el enlace de un vendedor, el cliente lo llena y queda en Clientes", async ({ page, go, press }) => {
    let url;
    await test.step("el asesor lo genera desde Clientes con el tipo ya elegido", async () => {
      await go("/admin/clientes");
      await press(page.getByRole("button", { name: "Enlace de registro" }));
      const panel = page.getByRole("region", { name: "Enlace para que el cliente capture sus datos" });
      await expect(panel).toContainText("Todavía no has generado enlaces.");
      await press(panel.getByText("Vendedor", { exact: true }));
      await panel.getByLabel("Nombre del cliente (opcional)").fill("Beto Ruiz");
      await press(panel.getByRole("button", { name: "Generar enlace" }));
      await expect(panel.getByText("Enlace de vendedor listo para mandar")).toBeVisible();
      url = await panel.getByLabel("Enlace de registro", { exact: true }).inputValue();
      expect(url).toMatch(/\/registro\/[0-9a-f]{32}$/);
      const wa = await panel.getByRole("link", { name: "Mandar por WhatsApp" }).first().getAttribute("href");
      expect(decodeURIComponent(wa.split("?text=")[1])).toContain(`Hola Beto,`);
      expect(decodeURIComponent(wa.split("?text=")[1])).toContain(url);
      await expect(panel.locator("li").first()).toContainText("Esperando al cliente");
    });

    await test.step("el cliente (sin sesión) ve el formulario de vendedor: sin campos de comprador ni preguntar el tipo", async () => {
      // (La página pública no mira la sesión: en demo la «base» es el localStorage de esta pestaña, por eso no se abre otra.)
      await go(new URL(url).pathname);
      await expect(page.getByText("Cerrar sesión")).toHaveCount(0);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Registra tus datos con ACL Propiedades");
      await expect(page.getByLabel("Número de crédito")).toBeVisible();
      await expect(page.getByLabel("Domicilio")).toBeVisible();
      await expect(page.getByLabel("Número de seguro social (NSS)")).toHaveCount(0);
      await expect(page.getByLabel("Contraseña del portal (INFONAVIT/FOVISSSTE/banco)")).toHaveCount(0);
      await expect(page.getByText("Tipo de cliente")).toHaveCount(0);
    });

    await test.step("pide lo obligatorio y el aviso de privacidad antes de enviar", async () => {
      await press(page.getByRole("button", { name: "Enviar mis datos" }));
      await expect(page.getByText("Escribe tu nombre completo.")).toBeVisible();
      await page.getByLabel("Nombre completo").fill("Beto Ruiz Soto");
      await press(page.getByRole("button", { name: "Enviar mis datos" }));
      await expect(page.getByText("Escribe un teléfono de 10 dígitos.")).toBeVisible();
      await page.getByLabel("Teléfono (WhatsApp)").fill("871 555 0199");
      await page.getByLabel("Correo electrónico (opcional)").fill("beto@correo");
      await press(page.getByRole("button", { name: "Enviar mis datos" }));
      await expect(page.getByText("Revisa tu correo: parece incompleto.")).toBeVisible();
      await page.getByLabel("Correo electrónico (opcional)").fill("Beto@Correo.mx");
      await page.getByLabel("RFC").fill("ruab800101ab1");
      await page.getByLabel("Número de crédito").fill("C-77");
      await press(page.getByRole("button", { name: "Enviar mis datos" }));
      await expect(page.getByText("Para enviar tus datos debes aceptar el aviso de privacidad.")).toBeVisible();
    });

    await test.step("al aceptar y enviar: agradecimiento y el cliente existe con el tipo del asesor", async () => {
      await page.getByLabel(/Acepto que ACL Propiedades/).check();
      await press(page.getByRole("button", { name: "Enviar mis datos" }));
      await expect(page.getByRole("heading", { name: "¡Listo, recibimos tus datos!" })).toBeVisible();
      const [cliente] = await leer(page, "acl_local_clients");
      expect(cliente).toMatchObject({ name: "Beto Ruiz Soto", type: "vendedor", phone: "871 555 0199", email: "beto@correo.mx", rfc: "RUAB800101AB1", numero_credito: "C-77", active: true });
      expect(cliente.nss).toBeNull();
      expect(cliente.notes).toContain("Beto Ruiz");
    });

    await test.step("el enlace ya no sirve una segunda vez", async () => {
      await go(new URL(url).pathname);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ya recibimos tus datos");
      await expect(page.getByLabel("Nombre completo")).toHaveCount(0);
    });

    await test.step("el asesor lo ve en Clientes y el enlace figura como «Ya lo llenó»", async () => {
      await go("/admin/clientes");
      await expect(page.getByRole("row", { name: /Beto Ruiz Soto/ })).toContainText("Vendedor");
      await press(page.getByRole("button", { name: "Enlace de registro" }));
      const panel = page.getByRole("region", { name: "Enlace para que el cliente capture sus datos" });
      await expect(panel.locator("li").first()).toContainText("Ya lo llenó");
      await expect(panel.getByRole("link", { name: "Ver cliente" })).toBeVisible();
    });
  });

  test("un comprador ve crédito, empresa y referencias; un enlace desactivado o inventado no abre el formulario", async ({ page, go, press }) => {
    await go("/admin/clientes");
    await press(page.getByRole("button", { name: "Enlace de registro" }));
    const panel = page.getByRole("region", { name: "Enlace para que el cliente capture sus datos" });
    await press(panel.getByRole("button", { name: "Generar enlace" }));
    await expect(panel.getByText("Enlace de comprador listo para mandar")).toBeVisible();
    const url = await panel.getByLabel("Enlace de registro", { exact: true }).inputValue();

    await test.step("el asesor lo desactiva", async () => {
      await press(panel.getByRole("button", { name: "Desactivar" }));
      await expect(panel.locator("li").first()).toContainText("Desactivado");
    });

    await test.step("el cliente ve que ya no está activo", async () => {
      await go(new URL(url).pathname);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Este enlace ya no está activo");
    });

    await test.step("uno inventado es inválido", async () => {
      await go(`/registro/${"0".repeat(32)}`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Este enlace no es válido");
    });

    await test.step("un comprador nuevo ve sus bloques", async () => {
      await go("/admin/clientes");
      await press(page.getByRole("button", { name: "Enlace de registro" }));
      const panel2 = page.getByRole("region", { name: "Enlace para que el cliente capture sus datos" });
      await press(panel2.getByRole("button", { name: "Generar enlace" }));
      const url2 = await panel2.getByLabel("Enlace de registro", { exact: true }).inputValue();
      await go(new URL(url2).pathname);
      await expect(page.getByRole("heading", { name: "Datos del crédito" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Datos de la empresa donde trabajas" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Referencias personales" })).toBeVisible();
      await expect(page.getByLabel("Número de seguro social (NSS)")).toBeVisible();
      await expect(page.getByLabel("Número de crédito")).toHaveCount(0);
    });
  });
});
