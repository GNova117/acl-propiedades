import { test, expect, abrirMas } from "./fixtures.js";

// Propiedades y Clientes del panel: lo de todos los días a la vista y lo demás tras «Más».
// En el teléfono cada fila es una tarjeta (sin deslizar de lado), los filtros van plegados
// tras «Filtros» y el teléfono y el correo de un cliente se pueden tocar. En PC sigue la tabla.

const cliente = (extra = {}) => ({
  id: "c-lista-qa",
  name: "Rosa Llamada QA",
  type: "comprador",
  email: "rosa.qa@example.com",
  phone: "871 555 0123",
  notes: null,
  active: true,
  financiamiento: "infonavit",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...extra,
});

// La página no se ensancha: nada de la lista se sale del ancho de la pantalla.
const sinDesborde = async (page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), "la página se desborda de lado").toBeLessThanOrEqual(1);

test.describe("Listas del panel: Propiedades y Clientes", () => {
  test.beforeEach(async ({ seedAdminSession }) => {
    await seedAdminSession();
  });

  test("Propiedades: «Enviar» y «Editar» a la vista, el resto tras «Más»; filtros plegados en el teléfono", async ({ page, go, press, isMobile }) => {
    await go("/admin/propiedades");
    const fila = page.locator(".admin-table tbody tr.admin-row").first();
    await expect(fila).toBeVisible();

    await test.step("lo de todos los días está a la vista", async () => {
      await expect(fila.getByRole("button", { name: /^Enviar/ })).toBeVisible();
      await expect(fila.getByRole("link", { name: "Editar" })).toBeVisible();
      await expect(fila.getByRole("button", { name: "Eliminar" })).toBeHidden();
      await expect(fila.getByRole("button", { name: /QR/ })).toBeHidden();
    });

    await test.step("«Más» trae el resto, Eliminar incluido, y se cierra al elegir una acción", async () => {
      await abrirMas(fila, press);
      for (const nombre of [/Historial/, /QR/, /Publicar en redes/, /Ficha técnica/, /Eliminar/]) await expect(fila.locator("button, a", { hasText: nombre }).first()).toBeVisible();
      await press(fila.getByRole("button", { name: /QR/ }));
      await expect(page.locator("[role=dialog]").first()).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(fila.locator("details.row-more")).toHaveJSProperty("open", false);
    });

    await test.step("los filtros: la búsqueda siempre a la vista; en el teléfono el resto tras «Filtros»", async () => {
      await expect(page.locator("#ap-search")).toBeVisible();
      const alternar = page.getByRole("button", { name: /^Filtros/ });
      if (!isMobile) {
        await expect(alternar).toBeHidden();
        await expect(page.locator("#ap-zone")).toBeVisible();
        return;
      }
      await expect(page.locator("#ap-zone")).toBeHidden();
      const filas = page.locator(".admin-table tbody tr.admin-row");
      const total = await filas.count();
      await press(alternar);
      await expect(page.locator("#ap-zone")).toBeVisible();
      await page.selectOption("#ap-status", "vendida");
      await expect(alternar).toHaveText("Filtros (1)");
      // Solo quedan las vendidas (menos que antes).
      await expect(filas.filter({ hasNot: page.locator(".cell-status", { hasText: "Vendida" }) })).toHaveCount(0);
      expect(await filas.count()).toBeLessThan(total);
    });

    await sinDesborde(page);
  });

  test("Propiedades en el teléfono: cada propiedad es una tarjeta con foto, precio y zona, sin deslizar de lado", async ({ page, go, isMobile }) => {
    test.skip(!isMobile, "solo aplica al teléfono");
    await go("/admin/propiedades");
    const fila = page.locator(".admin-table tbody tr.admin-row").first();
    await expect(fila).toBeVisible();
    // Tarjeta, no fila de tabla: ocupa el ancho de la pantalla y sus datos van apilados.
    const caja = await fila.boundingBox();
    expect(caja.width, "la tarjeta ocupa el ancho de la pantalla").toBeGreaterThan(page.viewportSize().width * 0.85);
    const precio = await fila.locator(".cell-price").boundingBox();
    const titulo = await fila.locator(".cell-title").boundingBox();
    expect(precio.y, "el precio va debajo del título").toBeGreaterThan(titulo.y);
    await expect(fila.locator(".cell-type")).toBeHidden();
    await sinDesborde(page);
  });

  test("Clientes: teléfono y correo tocables, «WhatsApp» a la vista y «Llamar» solo en el teléfono; Eliminar tras «Más»", async ({ page, go, press, isMobile }) => {
    await go("/admin/clientes");
    await page.evaluate((c) => localStorage.setItem("acl_local_clients", JSON.stringify([c])), cliente());
    await go("/admin/clientes");

    const fila = page.locator(".admin-table tbody tr.admin-row", { hasText: "Rosa Llamada QA" });
    await expect(fila).toBeVisible();

    await test.step("el teléfono y el correo son enlaces", async () => {
      await expect(fila.locator(".cell-phone a")).toHaveAttribute("href", "tel:+528715550123");
      await expect(fila.locator(".cell-email a")).toHaveAttribute("href", "mailto:rosa.qa@example.com");
    });

    await test.step("acciones: WhatsApp y Editar a la vista; «Llamar» solo en el teléfono; Eliminar oculto", async () => {
      await expect(fila.getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", "https://wa.me/528715550123");
      await expect(fila.getByRole("link", { name: "Editar" })).toBeVisible();
      const llamar = fila.getByRole("link", { name: "Llamar" });
      if (isMobile) await expect(llamar).toBeVisible();
      else await expect(llamar).toBeHidden();
      await expect(fila.getByRole("button", { name: "Eliminar" })).toBeHidden();
    });

    await test.step("en el teléfono es una tarjeta y los filtros van plegados", async () => {
      if (!isMobile) return;
      const caja = await fila.boundingBox();
      expect(caja.width).toBeGreaterThan(page.viewportSize().width * 0.85);
      await expect(page.locator("#client-search")).toBeVisible();
      await expect(page.locator("#client-type-filter")).toBeHidden();
      await press(page.getByRole("button", { name: /^Filtros/ }));
      await expect(page.locator("#client-type-filter")).toBeVisible();
      await sinDesborde(page);
    });

    await test.step("Eliminar está tras «Más» y borra al cliente", async () => {
      await abrirMas(fila, press);
      await press(fila.getByRole("button", { name: "Eliminar" }));
      await expect(page.locator(".admin-table tbody tr.admin-row", { hasText: "Rosa Llamada QA" })).toHaveCount(0);
    });
  });

  test("Clientes: «Seleccionar todos» sigue disponible y habilita el borrado en lote", async ({ page, go, press }) => {
    await go("/admin/clientes");
    await page.evaluate(
      (rows) => localStorage.setItem("acl_local_clients", JSON.stringify(rows)),
      [cliente({ id: "c-a", name: "Lote Uno QA" }), cliente({ id: "c-b", name: "Lote Dos QA", phone: "871 555 0124" })],
    );
    await go("/admin/clientes");
    await press(page.getByLabel("Seleccionar todos"));
    await expect(page.locator(".bulk-actions-bar")).toBeVisible();
    await expect(page.locator(".bulk-actions-bar")).toContainText("2");
  });
});

