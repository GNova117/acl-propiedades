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

  test("Contacto: «¿Qué buscas?» llega preseleccionado desde el enlace de rentar mi propiedad", async ({ page, go }) => {
    await go("/vende-tu-casa");
    await expect(page.getByRole("link", { name: /rentarla en lugar de venderla/i })).toHaveAttribute("href", "/contacto?motivo=rentar_mia");
    await go("/contacto?motivo=rentar_mia");
    await expect(page.locator("#contact-topic")).toHaveValue("rentar_mia");
  });

  test("Contacto recuerda nombre, correo y teléfono después de enviar", async ({ page, go, press }) => {
    await go("/contacto");
    await page.fill("#contact-name", "María Recordada");
    await page.fill("#contact-email", "maria@example.com");
    await page.fill("#contact-phone", "8715550123");
    await page.fill("#contact-message", "Hola, quiero información.");
    await press(page.locator("form.contact-form button[type=submit]"));
    await expect(page.locator(".contact-success")).toBeVisible();
    await go("/contacto");
    await expect(page.locator("#contact-name")).toHaveValue("María Recordada");
    await expect(page.locator("#contact-phone")).toHaveValue("8715550123");
  });

  test("el chat manda el código de la ficha que se está viendo", async ({ page, go, press }) => {
    let enviado = null;
    await page.route("**/api/chat", async (route) => {
      enviado = route.request().postDataJSON();
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ configured: true, reply: "Claro.", leadCaptured: false, handoff: false, visitBooked: false }) });
    });
    await go("/propiedades/prop-1");
    const codigo = (await page.locator(".property-detail__code strong").first().textContent())?.trim();
    // La dirección canónica lleva el código al final; el chat lo toma de ahí.
    await expect(page).toHaveURL(new RegExp(`${codigo}$`, "i"));
    // En teléfono el chat de la ficha se abre desde su botón en la barra de contacto; en pantalla grande, con el flotante.
    const desdeLaBarra = page.locator(".mobile-contact-bar__chat");
    await press((await desdeLaBarra.isVisible()) ? desdeLaBarra : page.locator(".chat-widget__toggle"));
    await page.locator(".chat-widget__form input").fill("¿Cuánto cuesta esta casa?");
    await press(page.locator(".chat-widget__form button[type=submit]"));
    await expect(page.locator(".chat-widget__bubble--assistant", { hasText: "Claro." })).toBeVisible();
    expect(enviado.page.propertyCode).toBe(codigo);
  });

  test("modo presentación: la ficha sin encabezado, pie ni formularios, con botón para salir", async ({ page, go, press }) => {
    await go("/propiedades/prop-1");
    await press(page.locator(".property-detail__present"));
    await expect(page).toHaveURL(/presentacion=1/);
    await expect(page.locator(".site-header")).toBeHidden();
    await expect(page.locator(".property-detail__sidebar")).toBeHidden();
    await press(page.locator(".presentation-exit"));
    await expect(page).not.toHaveURL(/presentacion=1/);
    await expect(page.locator(".site-header")).toBeVisible();
  });

  test("Clientes se exporta a Excel de verdad (.xlsx)", async ({ page, seedAdminSession, go, press }) => {
    await seedAdminSession();
    await go("/admin/clientes/nuevo");
    await page.fill("#c-name", "Cliente Excel QA");
    await page.selectOption("#c-financiamiento", "contado");
    await llenarDatosBasicosCliente(page);
    await press(page.getByRole("button", { name: "Guardar" }));
    await expect(page).toHaveURL(/\/admin\/clientes$/);
    const [descarga] = await Promise.all([page.waitForEvent("download"), press(page.getByRole("button", { name: "Exportar Excel" }))]);
    expect(descarga.suggestedFilename()).toBe("clientes.xlsx");
    const stream = await descarga.createReadStream();
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const bytes = Buffer.concat(chunks);
    expect(bytes.subarray(0, 2).toString()).toBe("PK"); // un .xlsx es un ZIP
    expect(bytes.includes(Buffer.from("Cliente Excel QA"))).toBe(true);
  });

  test("al subir fotos oscuras y repetidas el formulario de propiedad avisa", async ({ page, seedAdminSession, go, press }) => {
    await seedAdminSession();
    await go("/admin/propiedades/prop-1");
    await expect(page.locator("#p-title")).toBeVisible();
    const siguiente = () => press(page.getByRole("button", { name: "Siguiente", exact: true }));
    const subir = page.locator(".image-uploader input[type=file]").first();
    for (let i = 0; i < 5 && !(await subir.isVisible().catch(() => false)) && !(await page.getByRole("button", { name: "Mover foto a la derecha" }).first().isVisible()); i++) await siguiente();
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
    await subir.setInputFiles([
      { name: "oscura-1.png", mimeType: "image/png", buffer: png },
      { name: "oscura-2.png", mimeType: "image/png", buffer: png },
    ]);
    await expect(page.locator(".photo-warnings")).toContainText("parece muy oscura");
    await expect(page.locator(".photo-warnings")).toContainText("parece repetida");
  });

  test("el listado del panel muestra el inventario en un mapa", async ({ page, seedAdminSession, go, press }) => {
    await seedAdminSession();
    await go("/admin/propiedades");
    await press(page.getByRole("button", { name: "Ver en mapa" }));
    await expect(page.locator(".leaflet-container")).toBeVisible();
    await expect(page.locator(".leaflet-marker-icon").first()).toBeVisible();
    await press(page.getByRole("button", { name: "Ocultar mapa" }));
    await expect(page.locator(".leaflet-container")).toHaveCount(0);
  });

  test("Zonas abre sin errores con las sugerencias de precio por m²", async ({ page, seedAdminSession, go }) => {
    await seedAdminSession();
    await go("/admin/zonas");
    await expect(page.locator(".admin-zone-card").first()).toBeVisible();
  });

  test("las páginas con enlace secreto no se indexan ni mandan la dirección como «referrer»", async ({ page, go }) => {
    await go(`/firmar/${"a".repeat(32)}`);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.locator('meta[name="referrer"]')).toHaveAttribute("content", "no-referrer");
    await go(`/visita/${"b".repeat(32)}`);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex.*noarchive/);
    await expect(page.locator('meta[name="referrer"]')).toHaveAttribute("content", "no-referrer");
  });

  test("material: subir un precio más de 15 % pide confirmar y dice cuánto subió", async ({ page, seedAdminSession, go, press }) => {
    await seedAdminSession();
    await go("/admin/materiales");
    await page.evaluate(() =>
      localStorage.setItem("acl_local_materials_catalog", JSON.stringify([{ id: "mat-qa", name: "Cemento QA", category: "Obra", unit: "saco", unit_price_internal: 100, unit_price_external: 150, active: true, consumption_rate: null, consumption_basis: null }])),
    );
    await go("/admin/materiales/mat-qa");
    await page.fill("#m-price-internal", "130");
    await page.evaluate(() => { window.__ACL_AUTO_CONFIRM__ = false; }); // la recarga la vuelve a encender: se apaga ya en la pantalla
    await press(page.getByRole("button", { name: "Guardar" }));
    const dialogo = page.getByRole("alertdialog");
    await expect(dialogo).toContainText("+30 %");
    await expect(dialogo).toContainText("aumento fuerte");
  });

  test("Comparar inspecciones abre con sus selectores", async ({ page, seedAdminSession, go }) => {
    await seedAdminSession();
    await go("/admin/inspecciones/comparar");
    await expect(page.getByRole("heading", { name: "Comparar inspecciones" })).toBeVisible();
    await expect(page.locator("#cmp-a")).toBeVisible();
    await expect(page.locator("#cmp-b")).toBeVisible();
  });

  test("la tipografía Inter variable se carga y sirve todos los pesos con un solo archivo", async ({ page, go }) => {
    const fontRequests = [];
    page.on("request", (r) => /\.woff2/.test(r.url()) && fontRequests.push(r.url()));
    await go("/");
    await page.evaluate(() => document.fonts.ready);
    for (const weight of [400, 500, 600, 700]) {
      expect(await page.evaluate((w) => document.fonts.check(`${w} 16px Inter`), weight)).toBe(true);
    }
    expect(fontRequests.filter((u) => /inter/i.test(u)).length, "Inter se pide en un solo archivo").toBeLessThanOrEqual(1);
  });

  test("accesibilidad: chat anunciado, pie con títulos h2, login con <main> y grupos con fieldset", async ({ page, go, press }) => {
    await go("/");
    await press(page.locator(".chat-widget__toggle"));
    await expect(page.locator(".chat-widget__list")).toHaveAttribute("role", "log");
    await expect(page.locator(".chat-widget__list")).toHaveAttribute("aria-live", "polite");
    expect(await page.locator(".site-footer h4").count(), "el pie ya no usa h4").toBe(0);
    expect(await page.locator(".site-footer h2.site-footer__title").count()).toBeGreaterThan(0);
    await go("/propiedades");
    const abrir = page.locator(".property-filters__toggle");
    if (await abrir.isVisible()) await press(abrir);
    // Las amenidades viven dentro de «Más filtros» (arranca cerrado): se abre para ver el grupo y su leyenda.
    await press(page.locator("details.property-filters__more summary"));
    await expect(page.locator("fieldset.form-field legend").first()).toBeVisible();
    await go("/admin/login");
    await expect(page.locator("main.admin-login")).toBeVisible();
  });

  test("Contacto: con errores el foco va al primer campo y cada error queda ligado a su campo", async ({ page, go, press }) => {
    await go("/contacto");
    await press(page.locator("form.contact-form button[type=submit]"));
    await expect(page.locator("#contact-name")).toBeFocused();
    await expect(page.locator("#contact-name")).toHaveAttribute("aria-describedby", "contact-name-error");
    await expect(page.locator("#contact-name-error")).toBeVisible();
  });

  test("Contacto trae botones grandes de Llamar y WhatsApp", async ({ page, go }) => {
    await go("/contacto");
    await expect(page.getByRole("link", { name: "Llamar" })).toHaveAttribute("href", /^tel:/);
    await expect(page.getByRole("link", { name: /Escribir por WhatsApp/ })).toHaveAttribute("href", /wa\.me/);
  });

  test("«Más filtros» arranca cerrado y el menú de compartir se cierra al tocar fuera", async ({ page, go, press, isMobile }) => {
    await go("/propiedades");
    if (isMobile) {
      const abrir = page.locator(".property-filters__toggle");
      if (await abrir.isVisible()) await press(abrir);
    }
    await expect(page.locator("details.property-filters__more")).not.toHaveAttribute("open", /.*/);
    await go("/propiedades/prop-1");
    const resumen = page.locator("details.share-button summary").first();
    if (await resumen.isVisible().catch(() => false)) {
      await press(resumen);
      await expect(page.locator("details.share-button").first()).toHaveAttribute("open", /.*/);
      await page.locator("h1").first().click({ position: { x: 5, y: 5 } });
      await expect(page.locator("details.share-button").first()).not.toHaveAttribute("open", /.*/);
    }
  });

  test("el aviso «avísame» del listado va al final con pocos resultados (una sola vez)", async ({ page, go }) => {
    await go("/propiedades");
    await expect(page.locator(".properties-grid .property-card").first()).toBeVisible();
    // El seed trae 5 propiedades en este listado (≤ 6): el aviso va después de la rejilla, no dentro. Con más de 6 va dentro (ver listingAlert.test.js).
    await expect(page.locator(".alert-signup")).toHaveCount(1);
    await expect(page.locator(".properties-grid .alert-signup")).toHaveCount(0);
  });

  test("la ficha: la aclaración del pago mensual va tras un ícono de información y el comparador de créditos se ofrece una sola vez", async ({ page, go, press }) => {
    await go("/propiedades/prop-1");
    const info = page.locator("details.property-detail__monthly-info");
    if (await info.count()) {
      await expect(info).not.toHaveAttribute("open", /.*/);
      await press(info.locator("summary"));
      await expect(info).toContainText("enganche");
    }
    const enlaces = page.locator('.property-detail a[href^="/comparar-creditos"]');
    expect(await enlaces.count(), "un solo llamado al comparador de créditos en la ficha").toBeLessThanOrEqual(1);
  });
  test("panel: el menú lateral muestra el correo y el rol, y la carpeta «Sitio web» agrupa blog, testimonios y novedades", async ({ page, seedAdminSession, go, press, isMobile }) => {
    await seedAdminSession();
    await go("/admin");
    if (isMobile) await press(page.locator(".admin-layout__menu-btn"));
    await expect(page.locator(".admin-layout__user-email")).toBeVisible();
    await expect(page.locator(".admin-layout__user-role")).not.toHaveText("");
    const carpeta = page.locator(".admin-layout__group-toggle", { hasText: "Sitio web" });
    await expect(carpeta).toBeVisible();
    await press(carpeta);
    await expect(page.locator(".admin-layout__sidebar a[href='/admin/blog']")).toBeVisible();
    // La carpeta de Clientes ya no trae el blog.
    const clientes = page.locator(".admin-layout__group-toggle", { hasText: "Clientes" });
    if ((await clientes.getAttribute("aria-expanded")) !== "true") await press(clientes);
    await expect(page.locator(".admin-layout__group", { has: clientes }).locator("a[href='/admin/blog']")).toHaveCount(0);
  });

  test("panel: el buscador global usa un placeholder corto pero conserva el nombre accesible completo", async ({ page, seedAdminSession, go }) => {
    await seedAdminSession();
    await go("/admin");
    const caja = page.locator(".admin-search__input");
    await expect(caja).toHaveAttribute("placeholder", /^Buscar…/);
    await expect(caja).toHaveAttribute("aria-label", /cliente, propiedad/);
  });
  test("panel: «Activo/Inactivo» de la tabla de propiedades es un interruptor que cambia de estado", async ({ page, seedAdminSession, go, press }) => {
    await seedAdminSession();
    await go("/admin/propiedades");
    const interruptor = page.locator("button.badge--switch").first();
    await expect(interruptor).toBeVisible();
    const antes = await interruptor.getAttribute("aria-checked");
    await press(interruptor);
    await expect(page.locator("button.badge--switch").first()).not.toHaveAttribute("aria-checked", antes);
  });
  test("Prospectos: en teléfono pegar/importar y exportar van tras «⋯ Más»; en pantalla grande siguen a la vista", async ({ page, seedAdminSession, go, press, isMobile }) => {
    await seedAdminSession();
    await go("/admin/prospectos");
    const pegar = page.getByRole("button", { name: "Pegar o importar lista" });
    if (isMobile) {
      await expect(pegar).toBeHidden();
      await expect(page.getByRole("button", { name: "Exportar CSV" })).toBeHidden();
      await press(page.locator("summary.btn", { hasText: "⋯ Más" }));
      await expect(pegar).toBeVisible();
    } else {
      await expect(pegar).toBeVisible();
      await expect(page.locator("summary.btn", { hasText: "⋯ Más" })).toHaveCount(0);
    }
    await expect(page.getByRole("link", { name: "Nuevo prospecto" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Seleccionar", exact: true })).toBeVisible();
  });
  test("el respaldo tiene su propio apartado en el menú y «Roles y accesos» ya no lo trae", async ({ page, seedAdminSession, go }) => {
    await seedAdminSession();
    await go("/admin/respaldo");
    await expect(page.getByRole("heading", { level: 1, name: "Respaldo" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Respaldo de datos" })).toBeVisible();
    await go("/admin/roles");
    await expect(page.getByRole("heading", { name: "Respaldo de datos" })).toHaveCount(0);
    await expect(page.getByRole("main").getByRole("link", { name: "Respaldo" })).toBeVisible();
  });
  test("Prospectos: la búsqueda lleva el mismo borde y radio que los demás campos del sitio", async ({ page, seedAdminSession, go }) => {
    await seedAdminSession();
    await go("/admin/prospectos");
    const caja = page.locator(".prospect-filters input[type=search]");
    await expect(caja).toBeVisible();
    const estilo = await caja.evaluate((el) => {
      const c = getComputedStyle(el);
      return { borde: c.borderTopWidth, radio: c.borderTopLeftRadius, fuente: c.fontFamily };
    });
    expect(estilo.borde).toBe("1px");
    expect(parseFloat(estilo.radio)).toBeGreaterThan(0);
    expect(estilo.fuente).not.toMatch(/^(system-ui|-apple-system)$/);
  });
  test("inicio del panel: las cifras enlazan a su lista y muestran las altas de este mes", async ({ page, seedAdminSession, go, press }) => {
    await seedAdminSession();
    await go("/admin");
    const propiedades = page.locator("a.admin-stat-card[href='/admin/propiedades']").first();
    await expect(propiedades).toBeVisible();
    // Las propiedades de demostración se dan de alta ahora: el renglón de tendencia dice «+N este mes».
    await expect(propiedades.locator(".admin-stat-card__trend")).toContainText("este mes");
    await press(propiedades);
    await expect(page).toHaveURL(/\/admin\/propiedades$/);
  });
  test("panel: las pantallas internas traen «Volver a …» a su lista y las listas no", async ({ page, seedAdminSession, go, press }) => {
    await seedAdminSession();
    await go("/admin/propiedades");
    await expect(page.locator(".admin-breadcrumb")).toHaveCount(0);
    await go("/admin/propiedades/nueva");
    const volver = page.locator(".admin-breadcrumb a");
    await expect(volver).toHaveText(/Volver a Propiedades/);
    await press(volver);
    await expect(page).toHaveURL(/\/admin\/propiedades$/);
    await go("/admin");
    await expect(page.locator(".admin-breadcrumb")).toHaveCount(0);
  });
  test("áreas táctiles: pie, títulos de tarjeta, datos de contacto y enlaces de la ficha miden al menos 32 px (258)", async ({ page, go }) => {
    const alto = (loc) => loc.first().evaluate((el) => el.getBoundingClientRect().height);
    await go("/propiedades");
    await expect(page.locator(".property-card").first()).toBeVisible();
    expect(await alto(page.locator(".property-card__title a"))).toBeGreaterThanOrEqual(31.5);
    expect(await alto(page.locator(".site-footer__bottom-row a"))).toBeGreaterThanOrEqual(31.5);
    await go("/contacto");
    expect(await alto(page.locator(".contact-page__info-list a"))).toBeGreaterThanOrEqual(31.5);
    await go("/propiedades/prop-1");
    expect(await alto(page.locator(".property-detail__back"))).toBeGreaterThanOrEqual(31.5);
  });

  test("«Comparar» en la tarjeta trae su palabra y el botón sigue marcándose (259)", async ({ page, go, press }) => {
    await go("/propiedades");
    const boton = page.locator(".property-card .compare-button").first();
    await expect(boton).toContainText("Comparar");
    await expect(boton).toHaveAttribute("aria-pressed", "false");
    await press(boton);
    await expect(boton).toHaveAttribute("aria-pressed", "true");
  });
  test("panel: la tabla que se desborda en teléfono se puede enfocar con teclado y tiene nombre; los encabezados vacíos dicen «Acciones» (254)", async ({ page, seedAdminSession, go, isMobile }) => {
    test.skip(!isMobile, "el desborde horizontal solo se da en teléfono");
    await seedAdminSession();
    await go("/admin/propiedades");
    const zona = page.locator(".admin-table-wrapper").first();
    await expect(zona).toBeVisible();
    const desborda = await zona.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
    if (desborda) {
      await expect(zona).toHaveAttribute("tabindex", "0");
      await expect(zona).toHaveAttribute("role", "region");
      await expect(zona).toHaveAttribute("aria-label", /desplazamiento/i);
    }
    await expect(page.locator(".admin-table thead th", { hasText: "Acciones" }).first()).toBeAttached();
    // Un <th> con solo un campo (la casilla «Seleccionar todo») vale si el campo tiene nombre.
    const vacios = await page
      .locator(".admin-table thead th")
      .evaluateAll((ths) => ths.filter((th) => !th.textContent.trim() && !th.querySelector("[aria-label]")).length);
    expect(vacios, "encabezados <th> sin texto").toBe(0);
  });
  test("textos largos (descripción de la propiedad y aviso de privacidad) se leen en el color normal, no en gris de apoyo (281)", async ({ page, go }) => {
    const color = (loc) => loc.first().evaluate((el) => getComputedStyle(el).color);
    await go("/propiedades/prop-1");
    const normal = await color(page.locator(".property-detail h1"));
    const apoyo = await color(page.locator(".property-detail__address"));
    expect(apoyo, "el gris de apoyo sigue siendo distinto del texto normal").not.toBe(normal);
    await expect(page.locator(".rich-description p").first()).toBeVisible();
    expect(await color(page.locator(".rich-description p"))).toBe(normal);
    await go("/aviso-de-privacidad");
    expect(await color(page.locator(".privacy-page__block p"))).toBe(normal);
  });
  test("selector de zona con búsqueda: lista visible al enfocar, filtra sin acentos, se maneja con teclado y toca para elegir (322)", async ({ page, go, press }) => {
    await go("/propiedades");
    if (await page.locator(".property-filters__toggle").isVisible()) await press(page.locator(".property-filters__toggle"));
    const campo = page.locator("#filter-zone");
    await expect(campo).toHaveAttribute("role", "combobox");
    await campo.focus();
    const lista = page.getByRole("listbox", { name: "Zonas" });
    await expect(lista).toBeVisible();
    const todas = await lista.getByRole("option").count();
    expect(todas).toBeGreaterThan(1);
    // Filtra mientras se escribe (sin importar mayúsculas ni acentos): se teclea una zona concreta en mayúsculas y sin acentos.
    const objetivo = (await lista.getByRole("option").nth(todas - 1).textContent()).trim();
    const sinAcentos = objetivo.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    await campo.fill(sinAcentos);
    const filtradas = await lista.getByRole("option").count();
    expect(filtradas).toBeGreaterThan(0);
    expect(filtradas).toBeLessThan(todas);
    await expect(lista.getByRole("option", { name: objetivo, exact: true })).toHaveCount(1);
    // Teclado: ↓ marca la primera, Enter la elige y cierra la lista.
    await campo.press("ArrowDown");
    await expect(lista.getByRole("option").first()).toHaveAttribute("aria-selected", "true");
    const nombre = (await lista.getByRole("option").first().textContent()).trim();
    await campo.press("Enter");
    await expect(campo).toHaveValue(nombre);
    await expect(lista).toHaveCount(0);
    // Tocar (o hacer clic) en una opción también la elige.
    await campo.fill("");
    await expect(lista).toBeVisible();
    const segunda = lista.getByRole("option").nth(1);
    const segundoNombre = (await segunda.textContent()).trim();
    await segunda.dispatchEvent("pointerdown");
    await expect(campo).toHaveValue(segundoNombre);
    // Esc cierra.
    await campo.fill("a");
    await expect(lista).toBeVisible();
    await campo.press("Escape");
    await expect(lista).toHaveCount(0);
    // Al pasar el foco a otro campo la lista también se cierra (no queda tapando lo de abajo).
    await campo.fill("e");
    await expect(lista).toBeVisible();
    await campo.press("Tab");
    await expect(lista).toHaveCount(0);
  });
  test("formularios de visita: al enviar con errores el foco va al primer campo y cada error queda ligado a su campo (261)", async ({ page, go, press }) => {
    await go("/propiedades/prop-1");
    await press(page.locator("#agendar-visita").getByRole("button", { name: "Agendar visita" }));
    await expect(page.locator("#visit-date")).toBeVisible();
    await press(page.locator("#agendar-visita").getByRole("button", { name: /Solicitar|Enviar|Confirmar/ }).last());
    await expect(page.locator("#visit-name")).toBeFocused();
    await expect(page.locator("#visit-name")).toHaveAttribute("aria-invalid", "true");
    const describedby = await page.locator("#visit-name").getAttribute("aria-describedby");
    expect(describedby).toBe("visit-name-error");
    await expect(page.locator("#visit-name-error")).toContainText("obligatorio");
  });

  test("alerta «avísame»: con errores el foco va al primer campo y el error queda ligado (261)", async ({ page, go, press }) => {
    await go("/propiedades");
    const tarjeta = page.locator(".alert-signup").first();
    await expect(tarjeta).toBeVisible();
    await press(tarjeta.locator("button[type=submit]").first());
    const nombre = tarjeta.locator("input[name=name]");
    await expect(nombre).toBeFocused();
    await expect(nombre).toHaveAttribute("aria-invalid", "true");
    const id = await nombre.getAttribute("id");
    await expect(nombre).toHaveAttribute("aria-describedby", `${id}-error`);
    await expect(page.locator(`#${id}-error`)).toBeVisible();
  });
  test("encabezado: logotipo más grande, teléfono a la vista en pantalla grande y, en teléfono, tema e idioma dentro del menú (268, 269, 270, 318)", async ({ page, go, isMobile, abrirMenuSitio }) => {
    await go("/");
    const logo = await page.locator(".site-header__logo .acl-logo").evaluate((el) => el.getBoundingClientRect().height);
    expect(logo, "alto del logotipo del encabezado (px)").toBeGreaterThanOrEqual(44);
    if (isMobile) {
      // Menú cerrado: sus enlaces no deben ser alcanzables con Tab ni por lectores de pantalla.
      await expect(page.locator(".site-nav")).toHaveCSS("visibility", "hidden");
      await expect(page.locator(".site-nav__call")).toBeHidden();
      await expect(page.locator(".site-header__actions .lang-toggle")).toHaveCount(0);
      await expect(page.locator(".site-header__actions .theme-toggle, .site-header__actions .icon-toggle:not(.favorites-link)")).toHaveCount(0);
      await abrirMenuSitio();
      await expect(page.locator(".site-nav .lang-toggle")).toBeVisible();
      await expect(page.locator(".site-nav").getByRole("link", { name: "Favoritos" })).toBeVisible();
      await expect(page.locator(".site-nav__call")).toHaveAttribute("href", /^tel:\+52871/);
    } else {
      await expect(page.locator(".site-header__phone")).toBeVisible();
      await expect(page.locator(".site-header__phone")).toHaveAttribute("href", /^tel:\+52871/);
      await expect(page.locator(".site-header__actions .lang-toggle")).toBeVisible();
      await expect(page.locator(".site-nav").getByRole("link", { name: "Favoritos" })).toHaveCount(0);
    }
  });
  test("ficha: migas de pan visibles que coinciden con los datos estructurados (297)", async ({ page, go }) => {
    await go("/propiedades/prop-1");
    const migas = page.getByRole("navigation", { name: "Migas de pan" });
    await expect(migas).toBeVisible();
    const items = migas.locator("li");
    expect(await items.count()).toBe(3);
    await expect(items.first().getByRole("link", { name: "Inicio" })).toHaveAttribute("href", "/");
    await expect(items.nth(1).getByRole("link")).toHaveAttribute("href", /^\/propiedades/);
    await expect(items.last().locator("[aria-current=page]")).toBeVisible();
    // Lo que se ve y lo que se manda a Google dicen lo mismo.
    const visibles = await items.allTextContents();
    const data = await page.locator("script#seo-jsonld").evaluate((el) => JSON.parse(el.textContent));
    const lista = data.find((item) => item["@type"] === "BreadcrumbList").itemListElement.map((item) => item.name);
    expect(lista).toEqual(visibles.map((texto) => texto.trim()));
  });

  test("ficha en laptop: título y precio se ven en la primera pantalla sin bajar (298)", async ({ page, go, isMobile }) => {
    test.skip(isMobile, "solo aplica a pantalla de laptop");
    await page.setViewportSize({ width: 1366, height: 800 });
    await go("/propiedades/prop-1");
    const h1 = await page.locator(".property-detail h1").evaluate((el) => el.getBoundingClientRect().bottom);
    const precio = await page.locator(".property-detail__price").evaluate((el) => el.getBoundingClientRect().bottom);
    expect(h1, "el título termina dentro de los 800 px de la primera pantalla").toBeLessThanOrEqual(800);
    expect(precio, "el precio termina dentro de los 800 px de la primera pantalla").toBeLessThanOrEqual(800);
  });

  test("ficha en teléfono: el botón flotante del chat no tapa el texto y el chat se abre desde la barra de contacto (271)", async ({ page, go, press, isMobile }) => {
    test.skip(!isMobile, "solo aplica a teléfono");
    await go("/");
    await expect(page.locator(".chat-widget__toggle")).toBeVisible();
    await go("/propiedades/prop-1");
    await expect(page.locator(".property-detail h1").first()).toBeVisible();
    await expect(page.locator(".chat-widget__toggle")).toBeHidden();
    // El chat sigue al alcance desde la barra de contacto de la ficha (junto a «Agendar visita» y «WhatsApp»).
    await expect(page.locator(".mobile-contact-bar")).toBeVisible();
    await press(page.locator(".mobile-contact-bar__chat"));
    await expect(page.locator(".chat-widget__panel")).toBeVisible();
    // Con el chat abierto, el botón flotante reaparece (como «×») para poder cerrarlo.
    await expect(page.locator(".chat-widget__toggle")).toBeVisible();
    await press(page.locator(".chat-widget__toggle"));
    await expect(page.locator(".chat-widget__panel")).toHaveCount(0);
  });

  test("ficha: al imprimir no salen menú, chat, formularios ni mapa, pero sí el título y el precio (285)", async ({ page, go }) => {
    await go("/propiedades/prop-1");
    await expect(page.locator(".property-detail h1").first()).toBeVisible();
    await page.emulateMedia({ media: "print" });
    for (const selector of [".site-header", ".site-footer", ".chat-widget__toggle", ".contact-request-card", ".alert-signup", ".property-detail__sidebar", ".breadcrumbs", ".property-detail__back"]) {
      const visibles = await page.locator(selector).evaluateAll((els) => els.filter((el) => getComputedStyle(el).display !== "none").length);
      expect(visibles, `${selector} no debe imprimirse`).toBe(0);
    }
    await expect(page.locator(".property-detail h1").first()).toBeVisible();
    await expect(page.locator(".property-detail__price")).toBeVisible();
    const color = await page.locator(".property-detail__address").evaluate((el) => getComputedStyle(el).color);
    expect(color, "texto negro al imprimir").toBe("rgb(0, 0, 0)");
  });

  test("ficha: lo escrito en un formulario rellena los campos vacíos de los otros y no se guarda hasta enviar (308)", async ({ page, go }) => {
    await go("/propiedades/prop-1");
    const contacto = page.locator(".contact-request-card");
    const alerta = page.locator(".alert-signup").first();
    await expect(contacto).toBeVisible();
    await expect(alerta).toBeVisible();
    await contacto.locator("input[name=name]").fill("Ana Compartida QA");
    await contacto.locator("input[name=phone]").fill("871 555 0101");
    await contacto.locator("input[name=phone]").blur();
    await expect(alerta.locator("input[name=name]")).toHaveValue("Ana Compartida QA");
    await expect(alerta.locator("input[name=phone]")).toHaveValue("871 555 0101");
    // Lo que alguien ya escribió en un campo no se pisa.
    await alerta.locator("input[name=name]").fill("Otro Nombre");
    await contacto.locator("input[name=name]").fill("Ana Compartida QA 2");
    await contacto.locator("input[name=name]").blur();
    await expect(alerta.locator("input[name=name]")).toHaveValue("Otro Nombre");
    // Sin enviar, nada se guarda en el navegador.
    expect(await page.evaluate(() => localStorage.getItem("acl_remembered_contact"))).toBeNull();
  });
  test("inicio: el buscador se ve en la primera pantalla, con teléfono de contacto y un solo héroe (264, 265, 320)", async ({ page, go }) => {
    await go("/");
    await expect(page.locator(".split-hero")).toHaveCount(0);
    await expect(page.locator("h1")).toHaveCount(1);
    const alto = page.viewportSize().height;
    const boton = await page.locator(".search-bar__submit").first().evaluate((el) => el.getBoundingClientRect().bottom);
    expect(boton, "el botón «Buscar propiedades» termina dentro de la primera pantalla").toBeLessThanOrEqual(alto);
    await expect(page.locator(".hero__call a[href^='tel:']")).toBeVisible();
  });

  test("inicio: bloque para quien quiere vender y categorías con imágenes diferidas (315, 222)", async ({ page, go, press }) => {
    await go("/");
    const vender = page.locator(".home-sell");
    await expect(vender).toBeVisible();
    await expect(vender.getByRole("link", { name: "Quiero vender mi propiedad" })).toHaveAttribute("href", "/vende-tu-casa");
    const imagenes = page.locator(".category-card__image");
    expect(await imagenes.count()).toBeGreaterThan(0);
    for (const loading of await imagenes.evaluateAll((els) => els.map((el) => el.tagName + ":" + el.getAttribute("loading")))) expect(loading).toBe("IMG:lazy");
    const srcset = await imagenes.first().getAttribute("srcset");
    if (srcset) expect(srcset).toMatch(/480w.*900w/);
    await press(vender.getByRole("link", { name: "Quiero vender mi propiedad" }));
    await expect(page).toHaveURL(/\/vende-tu-casa$/);
  });

  test("inicio en teléfono: más corto, las destacadas se deslizan de lado y no hay desborde (266)", async ({ page, go, isMobile }) => {
    test.skip(!isMobile, "solo aplica a teléfono");
    await go("/");
    await expect(page.locator(".featured-properties__grid")).toBeVisible();
    const carrusel = await page.locator(".featured-properties__grid").evaluate((el) => ({ ancho: el.scrollWidth, visible: el.clientWidth, flex: getComputedStyle(el).display }));
    expect(carrusel.flex).toBe("flex");
    expect(carrusel.ancho, "hay más tarjetas fuera de pantalla").toBeGreaterThan(carrusel.visible);
    const medidas = await page.evaluate(() => ({ alto: document.documentElement.scrollHeight, desborde: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
    expect(medidas.desborde).toBeLessThanOrEqual(1);
    expect(medidas.alto, "alto del inicio en teléfono (px)").toBeLessThanOrEqual(6500);
  });
  test("desarrollos: página con la lista, enlace en el menú y tira en el inicio (270, 316)", async ({ page, go, press, isMobile, abrirMenuSitio }) => {
    await go("/");
    // Tira de desarrollos y herramientas del comprador en el inicio.
    const tira = page.locator(".home-developments__grid");
    await expect(tira).toBeVisible();
    expect(await tira.locator(".development-card").count()).toBeGreaterThan(0);
    const herramientas = page.locator(".home-tools__card");
    expect(await herramientas.count()).toBe(3);
    for (const href of ["/comparar-creditos", "/guia-del-comprador", "/calculadora"]) await expect(page.locator(`.home-tools__card[href='${href}']`)).toHaveCount(1);
    // El menú trae «Desarrollos» (en teléfono, dentro del menú abierto).
    if (isMobile) await abrirMenuSitio();
    const enlace = page.locator(".site-nav").getByRole("link", { name: "Desarrollos" });
    await expect(enlace).toBeVisible();
    await press(enlace);
    await expect(page).toHaveURL(/\/desarrollos$/);
    await expect(page.getByRole("heading", { level: 1, name: "Torres y desarrollos" })).toBeVisible();
    expect(await page.locator(".developments-page__grid .development-card").count()).toBeGreaterThan(0);
    // «Ver todos los desarrollos» del inicio lleva ahí.
    await go("/");
    await press(page.getByRole("link", { name: "Ver todos los desarrollos" }));
    await expect(page).toHaveURL(/\/desarrollos$/);
  });

  test("testimonios: página con todos y enlace «Ver todos» desde el inicio (302)", async ({ page, go, press }) => {
    const hoy = new Date().toISOString();
    await page.addInitScript((creado) => {
      const lista = Array.from({ length: 4 }, (_, i) => ({ id: `t-qa-${i}`, name: `Cliente QA ${i + 1}`, role: "Compró en Torreón", quote: `Excelente servicio ${i + 1}`, rating: 5, active: true, created_at: creado }));
      localStorage.setItem("acl_local_testimonials", JSON.stringify(lista));
    }, hoy);
    await go("/");
    const todos = page.getByRole("link", { name: "Ver todos los testimonios" });
    await expect(todos).toBeVisible();
    await press(todos);
    await expect(page).toHaveURL(/\/testimonios$/);
    await expect(page.getByRole("heading", { level: 1, name: "Lo que dicen nuestros clientes" })).toBeVisible();
    // La página trae todos (el inicio en teléfono solo los primeros tres).
    expect(await page.locator(".testimonials-page__grid .testimonial-card").count()).toBe(4);
  });

  test("listado de propiedades: filtros y resultados van antes que la tira de desarrollos (267)", async ({ page, go }) => {
    await go("/propiedades");
    const resultados = page.locator(".properties-page__layout");
    const tira = page.locator(".properties-page__developments");
    await expect(resultados).toBeVisible();
    await expect(tira).toBeVisible();
    const arribaResultados = await resultados.evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
    const arribaTira = await tira.evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
    expect(arribaTira, "la tira de desarrollos queda debajo de los resultados").toBeGreaterThan(arribaResultados);
    // Y los resultados empiezan dentro de la primera pantalla.
    const alto = page.viewportSize().height;
    expect(arribaResultados, "los filtros/resultados empiezan en la primera pantalla").toBeLessThan(alto);
  });
  test("el mapa de propiedades tiene rol y nombre que explican cómo usarlo con teclado (249)", async ({ page, go }) => {
    await go("/propiedades?vista=mapa");
    const mapa = page.locator(".leaflet-container").first();
    await expect(mapa).toHaveAttribute("role", "region");
    await expect(mapa).toHaveAttribute("aria-label", /Mapa de propiedades.*flechas/);
    // Los marcadores son botones con el nombre de la propiedad.
    const marcador = page.locator(".leaflet-marker-icon[role=button]").first();
    await expect(marcador).toHaveAttribute("title", /\S+/);
  });

  test("panel: al enviar un formulario con errores el foco va al primer campo con error y cada error queda ligado a su campo (261)", async ({ page, seedAdminSession, go, press }) => {
    await seedAdminSession();
    await go("/admin/propiedades/nueva");
    await press(page.locator("main form button[type=submit]").first());
    const enfocado = page.locator(":focus");
    await expect(enfocado).toHaveAttribute("aria-invalid", "true");
    const ids = ((await enfocado.getAttribute("aria-describedby")) || "").split(/\s+/).filter(Boolean);
    expect(ids.length).toBeGreaterThan(0);
    const mensajes = await page.evaluate((lista) => lista.map((id) => document.getElementById(id)?.textContent?.trim()), ids);
    expect(mensajes.some((m) => m && m.length > 0), "el campo apunta a un mensaje de error con texto").toBe(true);
    // Los errores sueltos se anuncian solos.
    const sueltosSinAlerta = await page.evaluate(() => [...document.querySelectorAll("p.form-error")].filter((el) => el.getAttribute("role") !== "alert").length);
    expect(sueltosSinAlerta).toBe(0);
  });
  test("marcar una propiedad como vendida pide la fecha y el asesor en el mismo paso y registra la venta (459)", async ({ page, seedAdminSession, go, press }) => {
    await seedAdminSession();
    const ventas = () => page.evaluate(() => JSON.parse(localStorage.getItem("acl_local_ventas") || "[]"));
    await go("/admin/propiedades/prop-2");
    // (Sin nada guardado todavía, la lista de ventas es la de demostración: se cuenta solo la de esta propiedad.)
    expect((await ventas()).some((v) => v.property_id === "prop-2")).toBe(false);
    // El estatus está en el segundo paso del formulario (ubicación).
    await press(page.getByRole("button", { name: "Siguiente", exact: true }));
    await expect(page.locator("#p-status")).toBeVisible();
    await page.selectOption("#p-status", "vendida");
    await press(page.locator("form.admin-form button[type=submit]").last());
    const modal = page.getByRole("dialog", { name: "Datos de la venta" });
    await expect(modal).toBeVisible();
    // La fecha ya viene con hoy y no puede ser futura.
    const hoy = new Date().toISOString().slice(0, 10);
    await expect(modal.getByLabel("Fecha de la venta")).toHaveValue(hoy);
    await modal.getByLabel("Fecha de la venta").fill("2999-01-01");
    await press(modal.getByRole("button", { name: "Guardar venta" }));
    await expect(modal.locator(".form-error")).toContainText("futura");
    await modal.getByLabel("Fecha de la venta").fill(hoy);
    await press(modal.getByRole("button", { name: "Guardar venta" }));
    await page.waitForURL((u) => u.pathname === "/admin/propiedades");
    const registradas = (await ventas()).filter((v) => v.property_id === "prop-2");
    expect(registradas).toHaveLength(1);
    expect(registradas[0].fecha_venta).toBe(hoy);
  });

  test("al omitir los datos de la venta la propiedad queda vendida y aparece pendiente en Reportes (459)", async ({ page, seedAdminSession, go, press }) => {
    await seedAdminSession();
    await go("/admin/propiedades/prop-3");
    await press(page.getByRole("button", { name: "Siguiente", exact: true }));
    await expect(page.locator("#p-status")).toBeVisible();
    await page.selectOption("#p-status", "vendida");
    await press(page.locator("form.admin-form button[type=submit]").last());
    const modal = page.getByRole("dialog", { name: "Datos de la venta" });
    await expect(modal).toBeVisible();
    await press(modal.getByRole("button", { name: "Omitir por ahora" }));
    await page.waitForURL((u) => u.pathname === "/admin/propiedades");
    const props = await page.evaluate(() => JSON.parse(localStorage.getItem("acl_local_properties") || "[]"));
    expect(props.find((p) => p.id === "prop-3")?.status).toBe("vendida");
    const ventas = await page.evaluate(() => JSON.parse(localStorage.getItem("acl_local_ventas") || "[]"));
    expect(ventas.some((v) => v.property_id === "prop-3")).toBe(false);
  });
  test("«Avisar al dueño» arma un mensaje según el estatus, editable, para copiar o abrir en WhatsApp (460)", async ({ page, seedAdminSession, go, press }) => {
    await seedAdminSession();
    await go("/admin/propiedades");
    const fila = page.locator(".admin-table tbody tr").first();
    await fila.scrollIntoViewIfNeeded();
    const titulo = (await fila.locator(".cell-name__text, .cell-name, td").nth(2).textContent())?.trim();
    await press(fila.locator("details.row-more summary"));
    await press(fila.getByRole("button", { name: "Avisar al dueño" }));
    const modal = page.getByRole("dialog", { name: "Avisar al dueño" });
    await expect(modal).toBeVisible();
    const texto = modal.getByLabel("Mensaje");
    await expect(texto).toHaveValue(/Hola/);
    await expect(texto).toHaveValue(/ACL-\d+/);
    await modal.getByLabel("Estatus que se le avisa").selectOption("vendida");
    await expect(texto).toHaveValue(/felicidades/);
    await texto.fill("Mensaje editado a mano");
    await expect(modal.getByRole("link", { name: "Abrir en WhatsApp" })).toHaveAttribute("href", "https://wa.me/?text=Mensaje%20editado%20a%20mano");
    expect(titulo).toBeTruthy();
  });
  test("al bajar el precio se avisa a cuántas personas con alerta de baja les llegará un mensaje y se confirma (458)", async ({ page, seedAdminSession, go, press }) => {
    await seedAdminSession();
    await go("/admin/propiedades/prop-1");
    await page.evaluate(() => {
      const alerta = (id, active) => ({ id, kind: "price", name: `Interesado ${id}`, phone: "8710000000", email: null, contact_method: "whatsapp", criteria: {}, property_id: "prop-1", price_at_subscribe: 2450000, active, unsubscribe_token: `tok-${id}`, created_at: new Date().toISOString() });
      localStorage.setItem("acl_local_property_alerts", JSON.stringify([alerta("a1", true), alerta("a2", true), alerta("a3", false)]));
    });
    const precio = page.locator("#p-price");
    await expect(precio).toBeVisible();
    const original = Number((await precio.inputValue()).replace(/\D/g, ""));
    // Subir el precio no avisa a nadie: guarda directo.
    await precio.fill(String(original + 50000));
    await press(page.locator("form.admin-form button[type=submit]").last());
    await page.waitForURL((u) => u.pathname === "/admin/propiedades");
    // Bajarlo sí: dice a cuántas personas (2 activas; la inactiva no cuenta) y pide confirmar.
    await go("/admin/propiedades/prop-1");
    await page.evaluate(() => { window.__ACL_AUTO_CONFIRM__ = false; }); // las pruebas aceptan los avisos solas; aquí se quiere ver el diálogo
    await page.locator("#p-price").fill(String(original - 100000));
    await press(page.locator("form.admin-form button[type=submit]").last());
    const aviso = page.getByRole("alertdialog");
    await expect(aviso).toContainText("2 personas");
    await expect(aviso).toContainText("próxima hora");
    // Cancelar deja todo como estaba (sigue en el formulario).
    await press(aviso.getByRole("button", { name: "Cancelar" }));
    await expect(page).toHaveURL(/\/admin\/propiedades\/prop-1$/);
    await press(page.locator("form.admin-form button[type=submit]").last());
    await press(page.getByRole("alertdialog").getByRole("button", { name: "Aceptar" }));
    await page.waitForURL((u) => u.pathname === "/admin/propiedades");
  });
});
