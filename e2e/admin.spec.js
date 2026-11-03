import { test, expect } from "./fixtures.js";

// Panel de administración, en PC y en móvil. Entra por el login demo
// (admin@aclpropiedades.com / Admin123!); las pruebas que no son del login usan
// la sesión ya sembrada para no repetir el formulario.

test.describe("Acceso", () => {
  test("una ruta del panel sin sesión redirige al login", async ({ page, go }) => {
    await go("/admin/propiedades");
    await page.waitForURL("**/admin/login");
    await expect(page.locator("#admin-email")).toBeVisible();
  });

  test("login con contraseña incorrecta muestra el error y no entra", async ({ page, go, press }) => {
    await go("/admin/login");
    await page.fill("#admin-email", "admin@aclpropiedades.com");
    await page.fill("#admin-password", "mal-password");
    await press(page.locator("button[type=submit]"));
    await expect(page.locator(".form-error, [role=alert], .admin-login__error").first()).toContainText("incorrectos");
    expect(page.url()).toContain("/admin/login");
  });

  test("login correcto lleva al Panel principal", async ({ page, loginAdmin }) => {
    await loginAdmin();
    await expect(page.locator("h1").first()).toHaveText("Panel principal");
  });

  test("cerrar sesión vuelve al login y deja el panel protegido", async ({ page, go, press, isMobile, loginAdmin }) => {
    await loginAdmin(); // por el formulario real: no deja sesión sembrada que se reaplique al navegar
    if (isMobile) await press(page.locator(".admin-layout__menu-btn"));
    await press(page.locator(".admin-layout__logout"));
    await page.waitForURL("**/admin/login");
    await go("/admin/clientes");
    await page.waitForURL("**/admin/login");
  });
});

test.describe("Menú y búsqueda", () => {
  test.beforeEach(async ({ seedAdminSession }) => {
    await seedAdminSession();
  });

  test("el menú lateral lleva a todos los apartados", async ({ page, go, press, isMobile }) => {
    test.setTimeout(120_000);
    await go("/admin");

    const abrirMenu = async () => {
      if (!isMobile) return;
      const boton = page.locator(".admin-layout__menu-btn");
      if ((await boton.getAttribute("aria-expanded")) !== "true") await press(boton);
      await expect(page.locator(".admin-layout__backdrop")).toBeVisible();
    };
    const expandirCarpetas = async () => {
      const carpetas = page.locator(".admin-layout__group-toggle");
      for (let i = 0; i < (await carpetas.count()); i++) {
        if ((await carpetas.nth(i).getAttribute("aria-expanded")) !== "true") await press(carpetas.nth(i));
      }
    };

    await abrirMenu();
    await expandirCarpetas();
    const destinos = await page.locator(".admin-layout__sidebar a[href^='/admin']").evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute("href")))]);
    expect(destinos.length, "enlaces en el menú lateral").toBeGreaterThanOrEqual(30);

    for (const href of destinos) {
      await abrirMenu();
      await expandirCarpetas();
      const enlace = page.locator(`.admin-layout__sidebar a[href='${href}']`).first();
      await enlace.scrollIntoViewIfNeeded();
      await press(enlace);
      await page.waitForURL((u) => u.pathname === href);
      if (isMobile) await expect(page.locator(".admin-layout__backdrop"), `el cajón sigue abierto en ${href}`).toHaveCount(0);
    }
  });

  test("la búsqueda global encuentra una propiedad y la abre", async ({ page, go, press }) => {
    await go("/admin");
    const campo = page.locator(".admin-search__input");
    await press(campo);
    await campo.fill("Senderos");
    const resultado = page.locator(".admin-search__item").first();
    await expect(resultado).toContainText("Casa en Residencial Senderos");
    await press(resultado);
    await page.waitForURL(/\/admin\/propiedades\/.+/);
  });
});

test.describe("Propiedades", () => {
  test.beforeEach(async ({ seedAdminSession }) => {
    await seedAdminSession();
  });

  test("el formulario vacío muestra los errores de validación", async ({ page, go, press }) => {
    await go("/admin/propiedades/nueva");
    await press(page.locator("form.admin-form button[type=submit]").last());
    expect(await page.locator("form .form-error").count()).toBeGreaterThanOrEqual(4);
  });

  test("ciclo completo: crear, publicar, editar, filtrar, exportar y eliminar", async ({ page, go, press }) => {
    test.setTimeout(60_000);
    const titulo = `Casa de prueba ${Date.now() % 100000}`;
    const fila = () => page.locator(".admin-table tbody tr", { hasText: titulo });

    await test.step("crear", async () => {
      await go("/admin/propiedades/nueva");
      await page.fill("#p-title", titulo);
      await page.fill("#p-description", "Descripción generada por prueba automática.");
      await page.fill("#p-price", "1234567");
      await page.fill("#p-area", "180");
      await page.fill("#p-bedrooms", "3");
      await page.fill("#p-bathrooms", "2");
      await page.selectOption("#p-zone", { index: 1 });
      await page.fill("#p-address", "Calle Falsa 123");
      await page.fill("#p-lat", "25.54");
      await page.fill("#p-lng", "-103.41");
      await press(page.locator("form.admin-form button[type=submit]").last());
      await page.waitForURL((u) => u.pathname === "/admin/propiedades");
      await expect(fila()).toHaveCount(1);
    });

    await test.step("aparece en el sitio público", async () => {
      await go("/propiedades");
      await expect(page.locator("main")).toContainText(titulo);
    });

    await test.step("editar el precio", async () => {
      await go("/admin/propiedades");
      await fila().scrollIntoViewIfNeeded();
      await press(fila().locator("a.btn", { hasText: /Editar|Edit/ }).first());
      await expect(page.locator("#p-title")).toHaveValue(titulo);
      await page.fill("#p-price", "999000");
      await press(page.locator("form.admin-form button[type=submit]").last());
      await page.waitForURL((u) => u.pathname === "/admin/propiedades");
      await expect(fila()).toContainText("999,000");
    });

    await test.step("filtrar el listado por texto", async () => {
      const total = await page.locator(".admin-table tbody tr").count();
      await page.locator("main input:not([type=checkbox])").first().fill(titulo);
      await expect(page.locator(".admin-table tbody tr")).toHaveCount(1);
      expect(total).toBeGreaterThan(1);
    });

    await test.step("exportar CSV", async () => {
      const [descarga] = await Promise.all([page.waitForEvent("download"), press(page.getByRole("button", { name: /Exportar CSV/ }))]);
      expect(descarga.suggestedFilename()).toMatch(/\.csv$/);
    });

    await test.step("eliminar y desaparece del sitio", async () => {
      await go("/admin/propiedades");
      await fila().scrollIntoViewIfNeeded();
      await press(fila().locator("button.btn-danger"));
      await expect(fila()).toHaveCount(0);
      await go("/propiedades");
      await expect(page.locator(".property-card").first()).toBeVisible();
      await expect(page.locator("main")).not.toContainText(titulo);
    });
  });
});

test.describe("Mensajes de contacto", () => {
  test("un mensaje enviado en el sitio llega al panel y se puede eliminar", async ({ page, go, press, seedAdminSession }) => {
    const marca = `Mensaje QA ${Date.now() % 100000}`;
    await go("/contacto");
    await page.fill("#contact-name", marca);
    await page.fill("#contact-email", "qa@example.com");
    await page.fill("#contact-message", "hola desde la prueba");
    await press(page.locator(".contact-form button[type=submit]"));
    await expect(page.locator(".contact-form")).toContainText(/gracias|enviado|recibimos|pronto/i);

    await seedAdminSession();
    await go("/admin/mensajes");
    const fila = page.locator("tr", { hasText: marca });
    await expect(fila).toHaveCount(1);
    await fila.scrollIntoViewIfNeeded();
    await press(fila.locator("button.btn-danger"));
    await expect(page.locator("tr", { hasText: marca })).toHaveCount(0);
  });
});
