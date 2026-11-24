import { test, expect } from "./fixtures.js";

// Una propiedad desactivada (borrador) no se ve en el sitio público: para cualquier visitante es como si no existiera
// (en Supabase la base ya no la entrega; en modo demo la ficha lo respeta igual). El personal con sesión sí la abre
// para su vista previa, pero marcada como no indexable. Las páginas sin valor para Google también llevan noindex.

async function desactivarPrimeraPropiedad(page, go) {
  await go("/");
  await page.evaluate(() => {
    const clave = "acl_local_properties";
    const lista = JSON.parse(localStorage.getItem(clave));
    lista.find((p) => p.id === "prop-1").active = false;
    localStorage.setItem(clave, JSON.stringify(lista));
  });
}

const robots = (page) => page.locator('meta[name="robots"]').first().getAttribute("content");

test.describe("Ficha de una propiedad desactivada y noindex", () => {
  test("el visitante ve «no encontrada» y la página no se indexa", async ({ page, go }) => {
    await desactivarPrimeraPropiedad(page, go);
    await go("/propiedades/prop-1");
    await expect(page.getByText("Propiedad no encontrada")).toBeVisible();
    await expect(page.locator("h1")).toHaveCount(0);
    expect(await robots(page)).toContain("noindex");
  });

  test("el personal con sesión sí abre la ficha (vista previa) y sigue sin indexarse", async ({ page, go, seedAdminSession }) => {
    await desactivarPrimeraPropiedad(page, go);
    await seedAdminSession();
    await go("/propiedades/prop-1");
    await expect(page.getByRole("heading", { level: 1, name: "Casa en Residencial Senderos" })).toBeVisible();
    expect(await robots(page)).toContain("noindex");
  });

  test("una propiedad activa se indexa con normalidad y el 404 y Favoritos no", async ({ page, go }) => {
    await go("/propiedades/prop-1");
    await expect(page.getByRole("heading", { level: 1, name: "Casa en Residencial Senderos" })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);

    await go("/no-existe-esta-pagina");
    expect(await robots(page)).toContain("noindex");

    await go("/favoritos");
    expect(await robots(page)).toContain("noindex");

    // Al salir de una página noindex, la etiqueta se quita sola.
    await go("/contacto");
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  });
});
