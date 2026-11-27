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
    await press(page.locator(".chat-widget__toggle"));
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
});
