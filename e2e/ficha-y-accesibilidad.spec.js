import { test, expect, abrirMas } from "./fixtures.js";

// Mejoras 61–70 (diseño): mosaico de fotos, barra de precio fija, iconos de datos, descripción con párrafos y listas,
// pantallas vacías con ilustración, textos que cambian de idioma, foco del teclado en ventanas emergentes. (La revisión
// automática de accesibilidad con axe está en e2e/accesibilidad.spec.js; la de contraste de colores, en src/lib/contrast.test.js.)

const poner = (page, clave, valor) => page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [clave, valor]);
const ahora = () => new Date().toISOString();
const propiedad = (extra = {}) => ({
  id: "rich-1",
  code: "ACL-R1",
  title: "Casa Descripción QA",
  type: "casa",
  operation_type: "compra",
  status: "disponible",
  active: true,
  price: 1800000,
  area_m2: 150,
  bedrooms: 3,
  bathrooms: 2,
  parking: 2,
  zone: "Torreón",
  address: "Calle QA 1",
  lat: 25.54,
  lng: -103.4,
  advisor_ids: [],
  images: ["https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1000&q=80"],
  created_at: ahora(),
  updated_at: ahora(),
  ...extra,
});

test.describe("Ficha de propiedad", () => {
  test("en computadora, con 3 fotos o más, la galería es un mosaico y tocar una chica abre el visor en esa foto; en el teléfono sigue la tira", async ({ page, go, press, isMobile }) => {
    await go("/propiedades/prop-1");
    await expect(page.locator(".gallery__main")).toBeVisible();
    if (isMobile) {
      await expect(page.locator(".gallery--mosaic")).toHaveCount(0);
      await expect(page.locator(".gallery__thumbs")).toBeVisible();
      return;
    }
    await expect(page.locator(".gallery--mosaic")).toBeVisible();
    await expect(page.locator(".gallery__tile")).toHaveCount(2); // prop-1 tiene 3 fotos: la grande y dos chicas
    await press(page.locator(".gallery__tile").nth(1));
    await expect(page.locator(".gallery-lightbox__counter")).toContainText("3 / 3");
    await page.keyboard.press("Escape");
    await expect(page.locator(".gallery-lightbox")).toHaveCount(0);
  });

  test("los datos de la ficha y de las tarjetas llevan icono (y siguen diciéndose con texto)", async ({ page, go }) => {
    await go("/propiedades/prop-1");
    const datos = page.locator(".property-detail__features");
    await expect(datos.locator(".fact-icon")).toHaveCount(4); // superficie, recámaras, baños y estacionamiento
    await expect(datos).toContainText("Estacionamiento");
    await go("/propiedades");
    await expect(page.locator(".property-card__meta .fact-icon").first()).toBeVisible();
  });

  test("la descripción se ve con sus párrafos y listas (y el texto no se interpreta como HTML)", async ({ page, go }) => {
    await go("/propiedades");
    await poner(page, "acl_local_properties", [
      propiedad({ description: "Casa luminosa en Torreón.\nCerca de todo.\n\nIncluye:\n- Cocina integral\n- Cochera techada\n\nPasos:\n1. Visitar\n2. Apartar\n\n<b>no es negrita</b>" }),
    ]);
    await go("/propiedades/rich-1");
    const descripcion = page.locator(".rich-description");
    await expect(descripcion.locator("p")).toHaveCount(4);
    await expect(descripcion.locator("ul li")).toHaveText(["Cocina integral", "Cochera techada"]);
    await expect(descripcion.locator("ol li")).toHaveText(["Visitar", "Apartar"]);
    await expect(descripcion).toContainText("<b>no es negrita</b>");
    await expect(descripcion.locator("b")).toHaveCount(0);
  });

  test("en computadora el precio y los botones de contacto quedan a la vista al bajar; en el teléfono está la barra de abajo", async ({ page, go, press, isMobile }) => {
    await go("/propiedades/prop-1");
    const barra = page.locator(".sticky-price-bar");
    if (isMobile) {
      await expect(barra).toBeHidden();
      await expect(page.locator(".mobile-contact-bar")).toBeVisible();
      return;
    }
    await expect(barra).not.toHaveClass(/is-visible/);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(barra).toHaveClass(/is-visible/);
    await expect(barra).toContainText("$2,450,000");
    await press(barra.getByRole("button", { name: "Agendar visita" }));
    await expect.poll(() => page.evaluate(() => { const r = document.getElementById("agendar-visita")?.getBoundingClientRect(); return Boolean(r) && r.top < window.innerHeight && r.bottom > 0; })).toBe(true);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(barra).not.toHaveClass(/is-visible/);
  });
});

test.describe("Pantallas vacías", () => {
  test("sin favoritas hay ilustración, un título y la acción para empezar", async ({ page, go }) => {
    await go("/favoritos");
    const vacio = page.locator(".empty-state--illustrated");
    await expect(vacio.locator(".empty-state__art")).toBeVisible();
    await expect(vacio.getByRole("heading", { name: "Todavía no tienes favoritas" })).toBeVisible();
    await expect(vacio.getByRole("link", { name: /propiedades/i })).toBeVisible();
  });

  test("una búsqueda sin resultados ofrece limpiar los filtros y vuelve a mostrar propiedades", async ({ page, go, press }) => {
    await go("/propiedades?q=zzzzqqqq");
    const vacio = page.locator(".empty-state--illustrated");
    await expect(vacio.getByRole("heading", { name: "No encontramos propiedades con esos filtros" })).toBeVisible();
    await press(vacio.getByRole("button", { name: "Limpiar todo" }));
    await expect(page.locator(".property-card").first()).toBeVisible();
  });

  test("la página que no existe lleva a inicio y a las propiedades", async ({ page, go }) => {
    await go("/ruta-que-no-existe");
    await expect(page.getByRole("heading", { level: 1, name: /404.*Esta página no existe/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "Volver al inicio" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ver propiedades" })).toBeVisible();
  });
});

test.describe("Textos en inglés", () => {
  test("al cambiar de idioma cambian el enlace de saltar, los nombres accesibles y los datos de la ficha", async ({ page, go, press, isMobile }) => {
    await go("/propiedades/prop-1");
    await press(page.locator(".lang-toggle"));
    await expect(page.locator(".skip-link")).toHaveText("Skip to content");
    await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeAttached();
    if (isMobile) await expect(page.getByRole("button", { name: "Open menu" })).toBeVisible();
    await expect(page.locator(".property-detail__features")).toContainText("Parking");
    await expect(page.locator(".property-detail__features")).not.toContainText("Estacionamiento");
    // El nombre accesible del botón de idioma empieza con lo que se ve (ahora «EN»).
    await expect(page.locator(".lang-toggle")).toHaveAttribute("aria-label", /^EN ·/);
  });
});

test.describe("Foco del teclado en ventanas emergentes", () => {
  test.beforeEach(async ({ seedAdminSession }) => {
    await seedAdminSession();
  });

  test("al abrir una ventana el foco entra en ella, Tab no se sale y al cerrarla vuelve al botón que la abrió", async ({ page, go, press, isMobile }) => {
    test.skip(isMobile, "Se prueba con el teclado, en computadora.");
    await go("/admin/propiedades");
    const fila = page.locator(".admin-table tbody tr.admin-row").first();
    await abrirMas(fila, press);
    const abrir = fila.getByRole("button", { name: "Ofertas y apartado" });
    await abrir.focus();
    await page.keyboard.press("Enter");
    const dialogo = page.getByRole("dialog", { name: "Ofertas y apartado" });
    await expect(dialogo).toBeVisible();
    const dentro = () => page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')));
    await expect.poll(dentro).toBe(true);
    for (let i = 0; i < 25; i += 1) {
      await page.keyboard.press("Tab");
      expect(await dentro(), `el foco se salió de la ventana al pulsar Tab (vez ${i + 1})`).toBe(true);
    }
    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press("Shift+Tab");
      expect(await dentro(), `el foco se salió de la ventana al pulsar Shift+Tab (vez ${i + 1})`).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(dialogo).toHaveCount(0);
    // El botón estaba dentro de un «Más» que se cierra al elegir una acción: el foco vuelve a ese «Más».
    await expect(fila.locator("details.row-more > summary")).toBeFocused();
  });
});

const precios = async (page) =>
  (await page.locator(".admin-table tbody tr.admin-row .cell-price").allTextContents()).map((t) => Number(t.replace(/[^\d]/g, "")));

test.describe("Tablas del panel: ordenar, columnas y encabezado fijo", () => {
  test.beforeEach(async ({ seedAdminSession }) => {
    await seedAdminSession();
  });

  test("pulsar un encabezado ordena (ascendente, descendente, sin orden) y lo dice con aria-sort", async ({ page, go, press, isMobile }) => {
    test.skip(isMobile, "En el teléfono la tabla son tarjetas y no hay encabezados.");
    await go("/admin/propiedades");
    const original = await precios(page);
    expect(new Set(original).size).toBeGreaterThan(2);
    const encabezado = page.getByRole("columnheader", { name: /Precio/ });
    await press(encabezado.getByRole("button"));
    await expect(encabezado).toHaveAttribute("aria-sort", "ascending");
    expect(await precios(page)).toEqual([...original].sort((a, b) => a - b));
    await press(encabezado.getByRole("button"));
    await expect(encabezado).toHaveAttribute("aria-sort", "descending");
    expect(await precios(page)).toEqual([...original].sort((a, b) => b - a));
    await press(encabezado.getByRole("button"));
    await expect(encabezado).toHaveAttribute("aria-sort", "none");
    expect(await precios(page)).toEqual(original);
  });

  test("«Columnas» oculta y muestra columnas y lo recuerda al recargar", async ({ page, go, press, isMobile }) => {
    test.skip(isMobile, "En el teléfono la tabla son tarjetas.");
    await go("/admin/propiedades");
    await expect(page.getByRole("columnheader", { name: /Zona/ })).toBeVisible();
    await press(page.locator(".column-picker summary"));
    await page.locator(".column-picker").getByLabel("Zona").uncheck();
    await expect(page.getByRole("columnheader", { name: /Zona/ })).toBeHidden();
    await expect(page.locator(".admin-table tbody tr.admin-row .cell-zone").first()).toBeHidden();
    await go("/admin/propiedades");
    await expect(page.getByRole("columnheader", { name: /Zona/ })).toBeHidden();
    await press(page.locator(".column-picker summary"));
    await press(page.locator(".column-picker").getByRole("button", { name: "Mostrar todas" }));
    await expect(page.getByRole("columnheader", { name: /Zona/ })).toBeVisible();
  });

  test("el encabezado de la tabla se queda fijo arriba al bajar por la lista (la tabla hace su propio scroll)", async ({ page, go, isMobile }) => {
    test.skip(isMobile, "En el teléfono la tabla son tarjetas.");
    await go("/admin/propiedades");
    const th = page.getByRole("columnheader", { name: /Precio/ });
    await expect(th).toHaveCSS("position", "sticky");
    const envoltura = page.locator(".admin-table-wrapper").first();
    await expect(envoltura).toHaveCSS("overflow-y", "auto");
  });

  test("Clientes también ordena por columna", async ({ page, go, press, isMobile }) => {
    test.skip(isMobile, "En el teléfono la tabla son tarjetas.");
    await go("/admin/clientes");
    await page.evaluate(() =>
      localStorage.setItem(
        "acl_local_clients",
        JSON.stringify(["Zacarías", "álvaro", "Beatriz"].map((name, i) => ({ id: `k${i}`, name, type: "comprador", email: null, phone: null, notes: null, active: true, financiamiento: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }))),
      ),
    );
    await go("/admin/clientes");
    await press(page.getByRole("columnheader", { name: /Nombre/ }).getByRole("button"));
    await expect(page.locator(".admin-table tbody tr.admin-row .cell-name")).toHaveText(["álvaro", "Beatriz", "Zacarías"]);
  });
});

test.describe("Dashboard: gráficas", () => {
  test("embudo, fuentes y ventas por mes, con su resumen para lectores de pantalla y la tabla de datos", async ({ page, go, press, seedAdminSession }) => {
    await seedAdminSession();
    await go("/admin");
    const base = { phone: null, email: null, advisor_id: "advisor-1", property_id: null, looking_for: null, notes: null, last_contact_at: null, next_followup_at: null, lost_reason: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    await poner(page, "acl_local_prospectos", [
      { ...base, id: "g1", name: "A", stage: "nuevo", source: "chatbot" },
      { ...base, id: "g2", name: "B", stage: "nuevo", source: "chatbot" },
      { ...base, id: "g3", name: "C", stage: "cerrado", source: "manual" },
    ]);
    await go("/admin");
    const graficas = page.getByRole("region", { name: "Gráficas" });
    await expect(graficas.locator(".bar-chart")).toHaveCount(3);
    const etapas = graficas.getByRole("img", { name: /Prospectos por etapa/ });
    await expect(etapas).toHaveAccessibleName(/Nuevo: 2/);
    await expect(etapas).toHaveAccessibleName(/Cerrado: 1/);
    await expect(graficas.getByRole("img", { name: /Prospectos por fuente: .*Chatbot.*: 2/ })).toBeVisible();
    await expect(graficas.getByRole("img", { name: /Ventas por mes/ })).toBeVisible();

    // Los mismos datos, en una tabla.
    const figura = graficas.locator(".bar-chart").first();
    await press(figura.locator("summary"));
    await expect(figura.getByRole("row", { name: /Nuevo\s*2/ })).toBeVisible();
  });
});
