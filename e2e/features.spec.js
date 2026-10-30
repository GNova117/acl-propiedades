import { statSync } from "node:fs";
import { test, expect, isoDate } from "./fixtures.js";

// Funciones puntuales del panel con reglas propias (cálculos, PDFs, modales,
// validaciones de negocio). En PC y en móvil.

test.describe("Panel: funciones", () => {
  test.beforeEach(async ({ seedAdminSession }) => {
    await seedAdminSession();
  });

  test("captura rápida (botón +): guarda un prospecto y aparece en Prospectos", async ({ page, go, press }) => {
    const marca = `RapidoQA ${Date.now() % 10000}`;
    await go("/admin");
    await press(page.getByRole("button", { name: /Prospecto rápido/ }));
    const panel = page.locator(".quick-capture__sheet");
    await expect(panel).toBeVisible();
    const caja = await panel.boundingBox();
    expect(caja.x).toBeGreaterThanOrEqual(-1);
    expect(caja.x + caja.width, "el panel se sale por la derecha").toBeLessThanOrEqual(page.viewportSize().width + 1);

    await panel.locator("#qc-name").fill(marca);
    await panel.locator("#qc-phone").fill("8715550000");
    await press(panel.locator("button[type=submit]"));
    await expect(page.locator(".quick-capture__done")).toBeVisible();

    await go("/admin/prospectos");
    await expect(page.locator("main")).toContainText(marca);
  });

  test("valuación: la zona y los m² dan un valor estimado", async ({ page, go }) => {
    await go("/admin/valuacion");
    await page.selectOption("#val-zone", { index: 1 });
    await page.fill("#val-land", "200");
    await page.fill("#val-built", "150");
    await expect(page.locator("main")).toContainText(/\$\s?[\d,]{7,}/);
  });

  test("valuación: el mapa para dibujar el terreno cabe en pantalla", async ({ page, go }) => {
    await go("/admin/valuacion");
    const mapa = page.locator(".leaflet-container").first();
    await expect(mapa).toBeVisible();
    const caja = await mapa.boundingBox();
    expect(caja.x).toBeGreaterThanOrEqual(-1);
    expect(caja.x + caja.width, "el mapa se sale por la derecha").toBeLessThanOrEqual(page.viewportSize().width + 1);
  });

  test("simulador Infonavit: calcula con edad y salario", async ({ page, go }) => {
    await go("/admin/credito-infonavit");
    const antes = await page.locator("main").innerText();
    await page.fill("#inf-edad", "35");
    await page.selectOption("#inf-sexo", { index: 1 });
    await page.fill("#inf-salario", "25000");
    await page.fill("#inf-ssv", "100000");
    await expect.poll(() => page.locator("main").innerText()).not.toBe(antes);
    await expect(page.locator("main")).toContainText(/\$\s?[\d,]{5,}/);
  });

  test("zonas: el precio por m² que se guarda lo usa la calculadora pública", async ({ page, go, press }) => {
    await go("/admin/zonas");
    const tarjeta = page.locator(".admin-zone-card", { has: page.locator("#zone-built-zone-torreon") });
    await tarjeta.locator("#zone-built-zone-torreon").fill("12345");
    await press(tarjeta.locator("button.btn-primary"));
    await expect(tarjeta.locator("button.btn-primary")).toHaveText("✓");

    await go("/calculadora");
    await page.selectOption("#calc-zone", "zone-torreon");
    await expect(page.locator("main")).toContainText("12,345");
  });

  test("visitas: registrar una visita (fecha pasada) y verla en el listado", async ({ page, go, press }) => {
    const marca = `VisitaQA${Date.now() % 10000}`;
    await go("/admin/visitas/nueva");
    await page.selectOption("#visit-property", { index: 1 });
    await page.fill("#visit-when", `${isoDate(-1)}T09:00`); // ayer: la app no admite visitas en el futuro
    await page.selectOption("#visit-advisor", { index: 1 });
    await page.fill("#visit-prospect", marca);
    await press(page.locator("[role=radiogroup] .visit-pill").first()); // «Interés» es obligatorio
    await press(page.locator("form button[type=submit]").last());
    await expect(page.locator(".form-error")).toHaveCount(0);
    await page.waitForURL((u) => u.pathname === "/admin/visitas");
    await expect(page.locator("main")).toContainText(marca);
  });

  test("visitas: no admite una visita en el futuro", async ({ page, go, press }) => {
    await go("/admin/visitas/nueva");
    await page.selectOption("#visit-property", { index: 1 });
    await page.fill("#visit-when", `${isoDate(30)}T09:00`);
    await page.fill("#visit-prospect", "Futuro QA");
    await press(page.locator("form button[type=submit]").last());
    await expect(page.locator(".form-error").first()).toContainText("futuro");
  });

  test("inspección: exige contestar todos los criterios y luego guarda", async ({ page, go, press }) => {
    await go("/admin/inspecciones/nueva");
    await page.fill("#insp-address", "Calle QA 1");
    await page.fill("#insp-inspector", "Inspector QA");
    const guardar = page.locator("form button[type=submit]").first();

    await press(guardar);
    await expect(page.locator(".form-error").first()).toContainText(/Sí\/No/);

    const grupos = page.locator("main [role=radiogroup]");
    const total = await grupos.count();
    expect(total).toBeGreaterThan(5);
    for (let i = 0; i < total; i++) {
      const si = grupos.nth(i).locator("label").first();
      await si.scrollIntoViewIfNeeded();
      await press(si);
    }
    await press(guardar);
    await expect(page.locator(".form-error")).toHaveCount(0);
    await page.waitForURL((u) => u.pathname === "/admin/inspecciones");
  });

  test("propiedades: los modales Enviar, QR y Redes abren dentro de la pantalla", async ({ page, go, press }) => {
    await go("/admin/propiedades");
    const fila = page.locator(".admin-table tbody tr").first();
    await expect(fila).toBeVisible();

    for (const etiqueta of [/^Enviar|Send/, /QR/, /Redes|Publicar|Social/]) {
      const boton = fila.locator("button", { hasText: etiqueta }).first();
      await boton.scrollIntoViewIfNeeded();
      await press(boton);
      const modal = page.locator("[role=dialog], dialog[open], [class*=modal]:not([class*=backdrop]):not([class*=overlay])").first();
      await expect(modal, `modal ${etiqueta}`).toBeVisible();
      const caja = await modal.boundingBox();
      expect(caja.x, `modal ${etiqueta} se sale por la izquierda`).toBeGreaterThanOrEqual(-1);
      expect(caja.x + caja.width, `modal ${etiqueta} se sale por la derecha`).toBeLessThanOrEqual(page.viewportSize().width + 1);
      await page.keyboard.press("Escape");
      if (await modal.isVisible().catch(() => false)) {
        await press(page.locator("[role=dialog] button, dialog button").filter({ hasText: /Cerrar|×|✕|Cancelar/ }).first());
      }
      await expect(modal).toBeHidden();
    }
  });

  test("propiedades: «Ficha» descarga un PDF", async ({ page, go, press }) => {
    await go("/admin/propiedades");
    const boton = page.locator(".admin-table tbody tr").first().locator("button", { hasText: /Ficha|PDF/ }).first();
    await boton.scrollIntoViewIfNeeded();
    const [descarga] = await Promise.all([page.waitForEvent("download", { timeout: 20_000 }), press(boton)]);
    expect(descarga.suggestedFilename()).toMatch(/\.pdf$/);
    expect(statSync(await descarga.path()).size, "el PDF está vacío").toBeGreaterThan(2000);
  });
});
