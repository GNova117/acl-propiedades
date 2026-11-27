import { test, expect, llenarDatosBasicosCliente } from "./fixtures.js";

// Tanda «A y B» de la lista maestra (pendientes sin SQL).

test.describe("Tanda A y B", () => {
  test("Contacto dice si la oficina está abierta o cerrada", async ({ page, go }) => {
    await go("/contacto");
    await expect(page.locator(".contact-page__open")).toHaveText(/Abierto ahora|Cerrado ahora/);
  });

  test("un artículo del blog se puede compartir", async ({ page, go, press }) => {
    await go("/blog");
    await press(page.locator("main a[href^='/blog/']").first());
    await page.waitForURL(/\/blog\/.+/);
    await expect(page.locator(".blog-post__share")).toContainText("Compartir");
  });

  test("«Reportar un error» abre Contacto con el mensaje empezado", async ({ page, go, press }) => {
    await go("/propiedades/prop-1");
    await press(page.locator(".property-detail__report"));
    await page.waitForURL("**/contacto?mensaje=**");
    await expect(page.locator("textarea[name=message]")).toHaveValue(/Encontré un error en la publicación ACL-/);
  });

  test("una propiedad que no existe sugiere otras disponibles", async ({ page, go }) => {
    await go("/propiedades/no-existe-ACL-999999");
    await expect(page.locator(".property-card").first()).toBeVisible();
  });

  test("atajo «G» y luego «P» lleva a Prospectos en el panel", async ({ page, seedAdminSession, go }) => {
    await seedAdminSession();
    await go("/admin");
    await expect(page.locator(".admin-layout__content h1").first()).toBeVisible();
    await page.locator("body").press("g");
    await page.locator("body").press("p");
    await page.waitForURL("**/admin/prospectos");
  });

  test("la Ayuda del panel documenta los atajos", async ({ page, seedAdminSession, go }) => {
    await seedAdminSession();
    await go("/admin/ayuda");
    await expect(page.getByText("Atajos de teclado")).toBeVisible();
  });

  test("el mapa del listado deja elegir entre calles y satélite", async ({ page, go, press, isMobile }) => {
    test.skip(isMobile, "la vista dividida solo existe en pantallas anchas");
    await go("/propiedades");
    await press(page.locator(".properties-page__view-toggle button", { hasText: "Dividida" }));
    await expect(page.locator(".properties-split .leaflet-control-layers")).toBeVisible();
  });

  test("la página de un desarrollo trae el formulario para dejar datos", async ({ page, go }) => {
    await go("/desarrollos/torre-aurora");
    await expect(page.locator(".dev-cta__form textarea[name=message]")).toHaveValue(/Me interesa el desarrollo/);
  });

  test("la lista del panel dice cuántos días lleva publicada cada propiedad", async ({ page, seedAdminSession, go }) => {
    await seedAdminSession();
    await go("/admin/propiedades");
    await expect(page.locator(".property-meta-line").first()).toContainText(/Publicada/);
  });

  test("el formulario de propiedad trae buscar dirección en el mapa y mover fotos", async ({ page, seedAdminSession, go, press }) => {
    await seedAdminSession();
    await go("/admin/propiedades/prop-1");
    await expect(page.locator("#p-title")).toBeVisible();
    const siguiente = () => press(page.getByRole("button", { name: "Siguiente", exact: true }));
    await siguiente();
    await expect(page.getByRole("button", { name: "Buscar en el mapa" })).toBeEnabled();
    const mover = page.getByRole("button", { name: "Mover foto a la derecha" }).first();
    for (let i = 0; i < 5 && !(await mover.isVisible()); i++) await siguiente();
    await expect(mover).toBeVisible();
  });

  test("la lista de clientes trae el semáforo del expediente", async ({ page, seedAdminSession, go, press }) => {
    await seedAdminSession();
    await go("/admin/clientes/nuevo");
    await page.fill("#c-name", "Cliente semáforo QA");
    await page.selectOption("#c-financiamiento", "contado");
    await llenarDatosBasicosCliente(page);
    await press(page.getByRole("button", { name: "Guardar" }));
    await expect(page).toHaveURL(/\/admin\/clientes$/);
    await expect(page.locator(".admin-table tbody tr", { hasText: "Cliente semáforo QA" }).locator(".property-completeness")).toContainText("Expediente completo");
  });

  test("Mensajes: el filtro de alertas no estorba si no hay alertas", async ({ page, seedAdminSession, go }) => {
    await seedAdminSession();
    await go("/admin/mensajes");
    await expect(page.locator("#message-channel-filter")).toBeVisible();
  });
});
