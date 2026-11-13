import { test, expect, ADMIN, expectHealthyPage } from "./fixtures.js";

// «Mis ventas y comisiones»: el asesor ve sus ventas por año y mes y la comisión que la oficina le publicó de cada casa; mientras no
// se publique, «Pendiente» (nunca $0). La oficina publica desde Reportes → Ganancias. En modo demo, un login se vuelve «de un
// asesor» enlazando su correo en los accesos guardados (acl_local_admin_access).

const poner = (page, clave, valor) => page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [clave, valor]);
const ANIO = new Date().getFullYear();

const propiedad = (id, title, price) => ({
  id,
  code: id.toUpperCase(),
  title,
  type: "casa",
  description: "Casa de prueba",
  price,
  area_m2: 120,
  bedrooms: 3,
  bathrooms: 2,
  parking: 1,
  zone: "Torreón",
  address: "Calle de prueba 1",
  lat: 25.54,
  lng: -103.4,
  status: "vendida",
  operation_type: "compra",
  active: true,
  main_image: "",
  images: [],
  advisor_ids: ["advisor-1"],
  created_at: `${ANIO - 1}-06-01T00:00:00.000Z`,
  updated_at: `${ANIO - 1}-06-01T00:00:00.000Z`,
});

const venta = (id, property_id, advisor_id, fecha_venta) => ({ id, property_id, advisor_id, fecha_venta, usuario_registro: ADMIN.email, created_at: `${fecha_venta}T12:00:00.000Z` });
const comision = (id, property_id, advisor_id, role, amount, fecha_venta) => ({ id, property_id, advisor_id, role, amount, fecha_venta, published_by: ADMIN.email, published_at: `${fecha_venta}T18:00:00.000Z` });
const ACCESO_ASESOR = [{ id: "access-qa", email: ADMIN.email, role_id: "role-admin", advisor_id: "advisor-1" }];

const PROPS = [propiedad("prop-a", "Casa Uno QA", 1000000), propiedad("prop-b", "Casa Dos QA", 2000000), propiedad("prop-c", "Casa Tres QA", 500000), propiedad("prop-d", "Casa Cuatro QA", 800000)];

test.describe("Mis ventas y comisiones (asesor)", () => {
  test.beforeEach(async ({ seedAdminSession }) => {
    await seedAdminSession();
  });

  test("ventas por año y mes, comisión publicada, «Pendiente» donde falta y lo que solo captó", async ({ page, go }) => {
    await go("/admin/mi-dia");
    await poner(page, "acl_local_admin_access", ACCESO_ASESOR);
    await poner(page, "acl_local_properties", PROPS);
    await poner(page, "acl_local_ventas", [
      venta("v1", "prop-a", "advisor-1", `${ANIO}-02-10`),
      venta("v2", "prop-b", "advisor-1", `${ANIO}-03-05`),
      venta("v3", "prop-c", "advisor-2", `${ANIO}-04-01`), // la vendió otra persona; advisor-1 solo la captó
      venta("v4", "prop-d", "advisor-1", `${ANIO - 1}-12-20`),
    ]);
    await poner(page, "acl_local_advisor_commissions", [
      comision("k1", "prop-a", "advisor-1", "venta", 120000, `${ANIO}-02-10`),
      comision("k2", "prop-c", "advisor-1", "captacion", 40000, `${ANIO}-04-01`),
      comision("k3", "prop-c", "advisor-2", "venta", 15000, `${ANIO}-04-01`), // de otra persona: no se ve
    ]);
    await go("/admin/mis-ventas");

    await expect(page.getByRole("heading", { name: "Mis ventas y comisiones" })).toBeVisible();
    const tarjeta = (etiqueta) => page.locator(".admin-stat-card", { hasText: etiqueta });
    await expect(tarjeta("Ventas cerradas").locator(".admin-stat-card__value")).toHaveText("2");
    await expect(tarjeta("Volumen vendido").locator(".admin-stat-card__value")).toHaveText("$3,000,000");
    await expect(tarjeta("Comisiones publicadas").locator(".admin-stat-card__value")).toHaveText("$160,000");
    await expect(page.getByText(`1 de tus ventas de ${ANIO} aún no tiene comisión publicada`)).toBeVisible();

    const fila = (titulo) => page.locator(".my-sales__row", { hasText: titulo });
    await expect(fila("Casa Uno QA")).toContainText("$120,000");
    await expect(fila("Casa Uno QA")).toContainText("Vendiste");
    await expect(fila("Casa Dos QA").locator(".my-sales__pending-chip")).toHaveText("Pendiente");
    await expect(fila("Casa Dos QA")).not.toContainText("$0");
    await expect(fila("Casa Tres QA")).toContainText("Captaste");
    await expect(fila("Casa Tres QA")).toContainText("$40,000");
    await expect(fila("Casa Tres QA")).not.toContainText("Vendiste");
    await expect(page.getByText("15,000")).toHaveCount(0);
    await expect(page.getByText("Casa Cuatro QA")).toHaveCount(0); // del año pasado

    await expect(page.locator(".my-sales__months li")).toHaveCount(3); // febrero, marzo y abril
    await expect(page.locator(".my-sales__months li", { hasText: "Marzo" })).toContainText("comisión pendiente"); // venta sin comisión publicada: nunca «$0»
    await expect(page.locator(".my-sales__months li", { hasText: "Febrero" })).toContainText("$120,000");
    await expect(page.locator(".my-sales__months li", { hasText: "Abril" })).toContainText("$40,000");
    await expectHealthyPage(page);

    await page.selectOption("#ms-year", String(ANIO - 1));
    await expect(fila("Casa Cuatro QA")).toBeVisible();
    await expect(tarjeta("Ventas cerradas").locator(".admin-stat-card__value")).toHaveText("1");
    await expect(page.getByText("Casa Uno QA")).toHaveCount(0);
  });

  test("sin ventas ni comisiones en el año lo dice; un login sin asesor no ve la pantalla", async ({ page, go }) => {
    await go("/admin/mi-dia");
    await poner(page, "acl_local_properties", PROPS);
    await poner(page, "acl_local_ventas", []);
    await poner(page, "acl_local_admin_access", ACCESO_ASESOR);
    await go("/admin/mis-ventas");
    await expect(page.getByText(`Todavía no hay ventas ni comisiones en ${ANIO}.`)).toBeVisible();

    await poner(page, "acl_local_admin_access", []);
    await go("/admin/mis-ventas");
    await expect(page.locator(".empty-state")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Mis ventas y comisiones" })).toHaveCount(0);
  });

  test("el menú y el Panel principal llevan a la pantalla", async ({ page, go, press, isMobile }) => {
    await go("/admin/mi-dia");
    await poner(page, "acl_local_admin_access", ACCESO_ASESOR);
    await poner(page, "acl_local_properties", PROPS);
    await poner(page, "acl_local_ventas", [venta("v1", "prop-a", "advisor-1", `${ANIO}-02-10`)]);
    await go("/admin/panel");
    await press(page.getByRole("link", { name: "Ver mis ventas y comisiones" }));
    await expect(page).toHaveURL(/\/admin\/mis-ventas$/);
    if (isMobile) await press(page.getByRole("button", { name: "Más" }));
    await expect(page.locator("#admin-sidebar").getByRole("link", { name: "Mis ventas" })).toBeVisible();
  });
});

test.describe("Publicar comisiones (oficina)", () => {
  test.beforeEach(async ({ seedAdminSession }) => {
    await seedAdminSession();
  });

  test("la oficina publica desde Reportes → Ganancias y el asesor ve su monto; al deshacer la venta se retira", async ({ page, go, press }) => {
    await go("/admin/mi-dia");
    await poner(page, "acl_local_properties", [propiedad("prop-a", "Casa Uno QA", 1000000)]);
    await poner(page, "acl_local_ventas", [venta("v1", "prop-a", "advisor-2", `${ANIO}-02-10`)]);
    // Captó advisor-1 y vendió advisor-2: 40 % de comisión de captación sobre $1,000,000 = $400,000, y el vendedor se queda con el 30 %.
    await poner(page, "acl_local_liquidaciones", [
      {
        id: "liq-1",
        property_id: "prop-a",
        captador_id: "advisor-1",
        vendedor_id: "advisor-2",
        costo_total: 0,
        devolucion_vendedor: 0,
        inversion_servicios: 0,
        tasa_comision_captacion: 40,
        tasa_comision_venta: 30,
        tasa_gastos_admin: 10,
      },
    ]);

    await go("/admin/reportes");
    await press(page.getByRole("tab", { name: "Ganancias" }));
    const panel = page.locator(".sr-panel", { has: page.getByRole("heading", { name: "Comisiones para los asesores" }) });
    await expect(panel).toContainText("Aún no has publicado comisiones.");
    await press(panel.getByRole("button", { name: "Publicar comisiones" }));
    await expect(panel).toContainText("Listo: 2 publicadas, 0 retiradas.");
    await expect(panel).toContainText("2 comisiones vigentes");

    const guardadas = await page.evaluate(() => JSON.parse(localStorage.getItem("acl_local_advisor_commissions")));
    expect(guardadas.map((c) => [c.advisor_id, c.role, c.amount]).sort()).toEqual([
      ["advisor-1", "captacion", 280000],
      ["advisor-2", "venta", 120000],
    ]);

    // El asesor 1 (que solo captó) ve su comisión, y no la del otro.
    await poner(page, "acl_local_admin_access", ACCESO_ASESOR);
    await go("/admin/mis-ventas");
    await expect(page.locator(".my-sales__row", { hasText: "Casa Uno QA" })).toContainText("$280,000");
    await expect(page.locator(".my-sales__row", { hasText: "Casa Uno QA" })).toContainText("Captaste");
    await expect(page.getByText("120,000")).toHaveCount(0);

    // La venta se deshace: la publicación se retira al volver a publicar.
    await poner(page, "acl_local_admin_access", []);
    await poner(page, "acl_local_ventas", []);
    await go("/admin/reportes");
    await press(page.getByRole("tab", { name: "Ganancias" }));
    await press(panel.getByRole("button", { name: "Publicar comisiones" }));
    await expect(panel).toContainText("Listo: 0 publicadas, 2 retiradas.");
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("acl_local_advisor_commissions")))).toEqual([]);
  });
});
