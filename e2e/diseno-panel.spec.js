import { test, expect } from "./fixtures.js";

// Mejoras 51–60 (diseño): menú del panel con iconos, fijados, recientes y modo compacto; avisos con «Deshacer» y
// confirmaciones propias en lugar de las ventanas del navegador; siluetas de carga. (Imágenes para compartir y portada:
// pruebas unitarias en server/ogProperty.test.js y src/lib/heroMedia.test.js.)

const ahora = () => new Date().toISOString();
const poner = (page, clave, valor) => page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [clave, valor]);
const leer = (page, clave) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "[]"), clave);
const prospecto = (id, name) => ({ id, name, phone: "8715550101", email: null, source: "manual", stage: "contactado", advisor_id: "advisor-1", property_id: null, looking_for: null, notes: null, last_contact_at: null, next_followup_at: null, lost_reason: null, created_at: ahora(), updated_at: ahora() });

const abrirMenu = async (page, press, isMobile) => {
  if (isMobile && !(await page.locator(".admin-layout__sidebar.is-open").count())) await press(page.locator(".admin-layout__menu-btn"));
};

test.describe("Menú del panel", () => {
  test.beforeEach(async ({ seedAdminSession }) => {
    await seedAdminSession();
  });

  test("cada apartado lleva su icono y fijar uno lo sube a «Fijados» (sin repetirlo), se recuerda al recargar y se puede quitar", async ({ page, go, press, isMobile }) => {
    await go("/admin/mi-dia");
    await abrirMenu(page, press, isMobile);
    const menu = page.locator(".admin-layout__sidebar nav");
    await expect(menu.locator("a svg.nav-icon").first()).toBeVisible();

    // Abre la carpeta de Clientes y fija «Prospectos».
    await press(menu.getByRole("button", { name: "Clientes", exact: true }));
    const fila = menu.locator(".admin-layout__nav-row", { has: page.getByRole("link", { name: "Prospectos", exact: true }) });
    await press(fila.getByRole("button", { name: "Fijar arriba" }));
    const fijados = menu.getByRole("group", { name: "Fijados" });
    await expect(fijados.getByRole("link", { name: "Prospectos", exact: true })).toBeVisible();
    // Ya no se repite en su carpeta.
    await expect(menu.getByRole("link", { name: "Prospectos", exact: true })).toHaveCount(1);

    await go("/admin/mi-dia");
    await abrirMenu(page, press, isMobile);
    await expect(page.locator(".admin-layout__sidebar nav").getByRole("group", { name: "Fijados" }).getByRole("link", { name: "Prospectos", exact: true })).toBeVisible();

    const fijado = page.locator(".admin-layout__sidebar nav").getByRole("group", { name: "Fijados" });
    await press(fijado.getByRole("button", { name: "Quitar de fijados" }));
    await expect(page.locator(".admin-layout__sidebar nav").getByRole("group", { name: "Fijados" })).toHaveCount(0);
  });

  test("los recientes muestran lo visitado que una carpeta cerrada esconde, sin repetir enlaces", async ({ page, go, press, isMobile }) => {
    await go("/admin/agenda");
    await go("/admin/mi-dia");
    await abrirMenu(page, press, isMobile);
    const recientes = page.locator(".admin-layout__sidebar nav").getByRole("group", { name: "Recientes" });
    await expect(recientes.getByRole("link", { name: "Agenda", exact: true })).toBeVisible();
    // Al abrir su carpeta ya se ve ahí: deja de salir en «Recientes» (nunca dos enlaces iguales).
    await press(page.locator(".admin-layout__sidebar nav").getByRole("button", { name: "Oficina", exact: true }));
    await expect(page.locator(".admin-layout__sidebar nav").getByRole("link", { name: "Agenda", exact: true })).toHaveCount(1);
  });

  test("el modo compacto deja solo iconos (los nombres siguen para lectores de pantalla) y se recuerda", async ({ page, go, press, isMobile }) => {
    test.skip(isMobile, "El modo compacto es del menú fijo de pantallas anchas; en el teléfono el menú es un cajón.");
    await go("/admin/mi-dia");
    const ancho = async () => (await page.locator(".admin-layout__sidebar").boundingBox()).width;
    expect(await ancho()).toBeGreaterThan(200);
    await press(page.getByRole("button", { name: "Compactar menú" }));
    await expect.poll(ancho).toBeLessThan(100);
    // El enlace conserva su nombre accesible aunque el texto no se vea.
    await expect(page.locator(".admin-layout__sidebar").getByRole("link", { name: "Mi día", exact: true })).toBeVisible();
    await go("/admin/mi-dia");
    await expect.poll(ancho).toBeLessThan(100);
    await press(page.getByRole("button", { name: "Expandir menú" }));
    await expect.poll(ancho).toBeGreaterThan(200);
  });
});

test.describe("Avisos y «Deshacer»", () => {
  test.beforeEach(async ({ seedAdminSession }) => {
    await seedAdminSession();
  });

  test("eliminar un prospecto lo quita al instante con un aviso «Deshacer»; con Deshacer vuelve y no se borra", async ({ page, go, press }) => {
    await go("/admin/prospectos");
    await poner(page, "acl_local_prospectos", [prospecto("u1", "Con Deshacer QA"), prospecto("u2", "Se Queda QA")]);
    await go("/admin/prospectos");
    const tarjeta = page.locator(".prospect-card", { hasText: "Con Deshacer QA" });
    await abrirMasTarjeta(page, tarjeta, press);
    await press(tarjeta.getByRole("button", { name: "Eliminar" }));
    await expect(page.locator(".prospect-card", { hasText: "Con Deshacer QA" })).toHaveCount(0);
    const aviso = page.getByRole("status").filter({ hasText: "Prospecto «Con Deshacer QA» eliminado." });
    await expect(aviso).toBeVisible();
    // Todavía no se borró de verdad.
    expect((await leer(page, "acl_local_prospectos")).map((p) => p.id)).toContain("u1");

    await press(aviso.getByRole("button", { name: "Deshacer" }));
    await expect(page.locator(".prospect-card", { hasText: "Con Deshacer QA" })).toBeVisible();
    await page.waitForTimeout(8000); // pasado el tiempo de «Deshacer», nada se borra
    expect((await leer(page, "acl_local_prospectos")).map((p) => p.id).sort()).toEqual(["u1", "u2"]);
  });

  test("sin «Deshacer», el borrado se hace solo al pasar el tiempo, y al salir de la página se hace de inmediato", async ({ page, go, press }) => {
    await go("/admin/prospectos");
    await poner(page, "acl_local_prospectos", [prospecto("d1", "Se Borra Solo QA"), prospecto("d2", "Se Borra Al Salir QA")]);
    await go("/admin/prospectos");
    for (const nombre of ["Se Borra Solo QA"]) {
      const tarjeta = page.locator(".prospect-card", { hasText: nombre });
      await abrirMasTarjeta(page, tarjeta, press);
      await press(tarjeta.getByRole("button", { name: "Eliminar" }));
    }
    await expect.poll(async () => (await leer(page, "acl_local_prospectos")).map((p) => p.id), { timeout: 12_000 }).toEqual(["d2"]);

    const otra = page.locator(".prospect-card", { hasText: "Se Borra Al Salir QA" });
    await abrirMasTarjeta(page, otra, press);
    await press(otra.getByRole("button", { name: "Eliminar" }));
    await expect(page.getByRole("status").filter({ hasText: "eliminado" })).toBeVisible();
    await go("/admin/prospectos"); // recargar = salir de la página: lo pendiente se borra de inmediato
    expect(await leer(page, "acl_local_prospectos")).toEqual([]);
  });

  test("los avisos son discretos (no bloquean la página) y se pueden cerrar", async ({ page, go, press }) => {
    await go("/admin/propiedades");
    await poner(page, "acl_local_properties", [
      { id: "t1", code: "ACL-T1", title: "Toast QA", type: "casa", operation_type: "compra", status: "disponible", active: true, price: 1000000, area_m2: 100, zone: "Torreón", images: [], created_at: ahora(), updated_at: ahora() },
    ]);
    await go("/admin/propiedades");
    await press(page.locator(".admin-table tbody tr.admin-row").first().getByLabel("Seleccionar fila"));
    await page.locator(".bulk-actions-bar").getByLabel("Cantidad").fill("80");
    await press(page.locator(".bulk-actions-bar").getByRole("button", { name: "Cambiar precio" }));
    const toast = page.locator(".toast", { hasText: "50 %" });
    await expect(toast).toBeVisible();
    // La página sigue usable con el aviso a la vista (una ventana del navegador no lo permitiría).
    await page.locator(".bulk-actions-bar").getByLabel("Cantidad").fill("10");
    await press(toast.getByRole("button", { name: "Cerrar aviso" }));
    await expect(toast).toHaveCount(0);
  });
});

async function abrirMasTarjeta(page, tarjeta, press) {
  const mas = tarjeta.locator("details.prospect-more");
  if (await mas.count()) {
    if (!(await mas.evaluate((el) => el.open))) await press(mas.locator("summary"));
  }
}
