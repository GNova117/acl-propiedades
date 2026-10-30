import { test, expect, isoDate } from "./fixtures.js";

// Funciones del sitio público, en PC y en móvil (en móvil con toques reales).
// Cada prueba arranca con el localStorage limpio (datos de ejemplo del modo demo).

test.describe("Navegación y preferencias", () => {
  test("el menú lleva a cada apartado", async ({ page, go, press, isMobile }) => {
    await go("/");
    const destinos = [
      ["Propiedades", "/propiedades"],
      ["Vende tu casa", "/vende-tu-casa"],
      ["Blog", "/blog"],
      ["Nosotros", "/nosotros"],
      ["Contacto", "/contacto"],
      ["Inicio", "/"],
    ];
    for (const [etiqueta, url] of destinos) {
      if (isMobile) await press(page.getByRole("button", { name: "Abrir menú" }));
      await press(page.locator(".site-nav a", { hasText: new RegExp(`^${etiqueta}$`) }));
      await page.waitForURL((u) => u.pathname === url);
      if (isMobile) await expect(page.locator(".site-nav--open")).toHaveCount(0);
    }
  });

  test("móvil: el menú abre, no recorta enlaces y vuelve a cerrar", async ({ page, go, press, isMobile }) => {
    test.skip(!isMobile, "solo móvil");
    await go("/");
    const nav = page.locator(".site-nav");
    const alto = async () => (await nav.boundingBox())?.height ?? 0;
    expect(await alto(), "el menú debe estar colapsado al inicio").toBeLessThanOrEqual(2);

    await press(page.getByRole("button", { name: "Abrir menú" }));
    await expect(page.locator(".site-nav--open")).toBeVisible();
    await page.waitForTimeout(400); // fin de la transición
    const recortados = await page.evaluate(() => {
      const fondo = document.querySelector(".site-nav").getBoundingClientRect().bottom;
      return [...document.querySelectorAll(".site-nav a")].filter((a) => a.getBoundingClientRect().bottom > fondo + 0.5).map((a) => a.textContent);
    });
    expect(recortados).toEqual([]);

    await press(page.getByRole("button", { name: "Abrir menú" }));
    await expect.poll(alto).toBeLessThanOrEqual(2);
  });

  test("modo oscuro: cambia y se recuerda al recargar", async ({ page, go, press }) => {
    await go("/");
    const tema = () => page.evaluate(() => document.documentElement.getAttribute("data-theme"));
    const antes = await tema();
    await press(page.getByRole("button", { name: /Activar modo (oscuro|claro)/ }));
    const despues = await tema();
    expect(despues).not.toBe(antes);
    await page.reload();
    await expect.poll(tema).toBe(despues);
  });

  test("idioma: alterna entre español e inglés", async ({ page, go, press }) => {
    await go("/contacto");
    const titulo = page.locator("h2").first();
    const es = await titulo.textContent();
    await press(page.getByRole("button", { name: /Cambiar idioma/ }));
    await expect(titulo).not.toHaveText(es);
    await press(page.getByRole("button", { name: /Cambiar idioma/ }));
    await expect(titulo).toHaveText(es);
  });

  test("404: ofrece volver al inicio", async ({ page, go, press }) => {
    await go("/esto-no-existe");
    await expect(page.locator("h1")).toContainText("404");
    await press(page.locator("main a").first());
    await page.waitForURL((u) => u.pathname === "/");
  });

  test("pie de página: todos sus enlaces internos cargan", async ({ page, go }) => {
    await go("/");
    const enlaces = await page.locator("footer a").evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute("href")).filter((h) => h?.startsWith("/")))]);
    expect(enlaces.length).toBeGreaterThan(5);
    for (const href of enlaces) {
      await go(href);
      expect((await page.locator("main").innerText()).length, `${href} casi vacío`).toBeGreaterThan(40);
    }
  });
});

test.describe("Búsqueda y listado de propiedades", () => {
  test("la búsqueda del inicio llega a Propiedades con el filtro aplicado", async ({ page, go, press }) => {
    await go("/");
    await page.locator("#search-max").fill("2000000");
    await press(page.locator(".search-bar__submit"));
    await page.waitForURL(/\/propiedades\?.*max=2000000/);
    await expect(page.locator(".property-card").first()).toBeVisible();
  });

  test("un código de propiedad inexistente no rompe la búsqueda", async ({ page, go, press }) => {
    await go("/");
    await page.locator("#search-code").fill("zzz-no-existe");
    await press(page.locator(".search-bar__code button[type=submit]"));
    await expect(page.locator(".search-bar")).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/");
  });

  test("una propiedad destacada abre su ficha", async ({ page, go, press }) => {
    await go("/");
    await press(page.locator(".featured-properties__grid .property-card__title a").first());
    await page.waitForURL(/\/propiedades\/.+/);
    await expect(page.locator(".gallery__main")).toBeVisible();
  });

  test("filtrar por tipo reduce la lista y «Limpiar» la restaura", async ({ page, go, press, isMobile }) => {
    await go("/propiedades");
    await expect(page.locator(".property-card").first()).toBeVisible();
    const total = await page.locator(".property-card").count();
    if (isMobile) await press(page.locator(".property-filters__toggle"));
    await page.selectOption("#filter-type", { index: 1 });
    await expect.poll(() => page.locator(".property-card").count()).toBeLessThan(total);
    await press(page.locator(".property-filters__header button", { hasText: /Limpiar|Clear/ }));
    await expect.poll(() => page.locator(".property-card").count()).toBe(total);
  });

  test("el precio máximo filtra los resultados", async ({ page, go, press, isMobile }) => {
    await go("/propiedades");
    await expect(page.locator(".property-card").first()).toBeVisible();
    const total = await page.locator(".property-card").count();
    if (isMobile) await press(page.locator(".property-filters__toggle"));
    await page.locator("input[id*=max]").first().fill("1500000");
    await expect.poll(() => page.locator(".property-card").count()).toBeLessThan(total);
    expect(await page.locator(".property-card").count()).toBeGreaterThan(0);
  });

  test("vista de mapa con marcadores y regreso al listado", async ({ page, go, press }) => {
    await go("/propiedades");
    await expect(page.locator(".property-card").first()).toBeVisible();
    await press(page.locator(".properties-page__view-toggle button", { hasText: /mapa/i }));
    const mapa = page.locator(".leaflet-container");
    await expect(mapa).toBeVisible();
    const caja = await mapa.boundingBox();
    expect(caja.width).toBeGreaterThan(200);
    expect(caja.height).toBeGreaterThan(200);
    await expect(page.locator(".leaflet-marker-icon").first()).toBeVisible();
    await press(page.locator(".properties-page__view-toggle button", { hasText: /listado/i }));
    await expect(page.locator(".property-card").first()).toBeVisible();
  });
});

test.describe("Favoritos y comparador", () => {
  test("favoritos: agregar, ver en /favoritos, persistir y quitar", async ({ page, go, press }) => {
    await go("/propiedades");
    await expect(page.locator(".property-card").first()).toBeVisible();
    await press(page.locator(".property-card .favorite-button").nth(0));
    await expect(page.locator(".favorites-link__count")).toHaveText("1");
    await press(page.locator(".property-card .favorite-button").nth(1));
    await expect(page.locator(".favorites-link__count")).toHaveText("2");

    await press(page.locator("a.favorites-link"));
    await page.waitForURL("**/favoritos");
    await expect(page.locator(".properties-grid .property-card")).toHaveCount(2);

    await page.reload();
    await expect(page.locator(".properties-grid .property-card")).toHaveCount(2);

    await press(page.locator(".property-card .favorite-button").first());
    await expect(page.locator(".property-card")).toHaveCount(1);
  });

  test("comparador: dos propiedades aparecen en /comparar", async ({ page, go, press }) => {
    await go("/propiedades");
    await expect(page.locator(".property-card").first()).toBeVisible();
    const titulos = await page.locator(".property-card__title").allTextContents();
    await press(page.locator(".property-card .compare-button").nth(0));
    await press(page.locator(".property-card .compare-button").nth(1));
    await expect(page.locator(".compare-link__count")).toHaveText("2");
    await press(page.locator("a.compare-link"));
    await page.waitForURL("**/comparar");
    await expect(page.locator("main")).toContainText(titulos[0].trim());
    await expect(page.locator("main")).toContainText(titulos[1].trim());
  });
});

test.describe("Ficha de propiedad", () => {
  test("galería: ampliar, pasar a la siguiente imagen y cerrar", async ({ page, go, press }) => {
    await go("/propiedades/prop-1");
    await press(page.locator(".gallery__main"));
    const contador = page.locator(".gallery-lightbox__counter");
    await expect(contador).toBeVisible();
    const antes = await contador.textContent();
    await press(page.locator(".gallery-lightbox__nav--next"));
    await expect(contador).not.toHaveText(antes);
    await press(page.locator(".gallery-lightbox__close"));
    await expect(page.locator(".gallery-lightbox")).toHaveCount(0);
  });

  test("compartir abre su menú y hay enlaces de WhatsApp y teléfono", async ({ page, go, press }) => {
    await go("/propiedades/prop-1");
    await expect(page.locator("h1").first()).toBeVisible();
    expect(await page.locator("a[href*='wa.me']").count()).toBeGreaterThan(0);
    expect(await page.locator("a[href^='tel:']").count()).toBeGreaterThan(0);
    await press(page.locator("summary", { hasText: /Compartir|Share/ }).first());
    await expect(page.locator(".share-button__menu").first()).toBeVisible();
  });

  test("«Agendar visita» lleva al formulario y la solicitud se envía", async ({ page, go, press }) => {
    await go("/propiedades/prop-1");
    await expect(page.locator("h1").first()).toBeVisible();
    // En móvil hay dos botones (barra fija y tarjeta): se toca el que está a la vista.
    const botones = page.locator("a, button").filter({ hasText: /^Agendar visita$/ });
    for (let i = 0; i < (await botones.count()); i++) {
      if (await botones.nth(i).isVisible()) {
        await press(botones.nth(i));
        break;
      }
    }
    const form = page.locator("form").filter({ has: page.locator("input[name=date]") });
    await expect(form).toBeVisible();
    const caja = await form.boundingBox();
    expect(caja.y, "el formulario debe quedar a la vista").toBeLessThan(page.viewportSize().height);

    await form.locator("input[name=name]").fill("QA Visita");
    await form.locator("input[name=email]").fill("qa@example.com");
    await form.locator("input[name=phone]").fill("8711112222");
    await form.locator("input[name=date]").fill(isoDate(3));
    await form.locator("input[name=time]").fill("11:00");
    await press(form.locator("button[type=submit]"));
    await expect(page.locator("main")).toContainText(/¡Listo!|gracias|recibimos/i);
  });
});

test.describe("Calculadoras", () => {
  test("valor estimado: cambia con los m² y con la zona", async ({ page, go }) => {
    await go("/calculadora");
    const resultado = page.locator(".calculator-card__result, main").first();
    const inicial = await page.locator("main").innerText();
    await page.locator("input[type=number][aria-label]").first().fill("300");
    await expect.poll(() => page.locator("main").innerText()).not.toBe(inicial);
    const conArea = await page.locator("main").innerText();
    await page.selectOption("#calc-zone", { index: 2 });
    await expect.poll(() => page.locator("main").innerText()).not.toBe(conArea);
    await expect(resultado).toContainText(/\$[\d,]+/);
  });

  test("comparador de créditos: cambiar el monto recalcula", async ({ page, go }) => {
    await go("/comparar-creditos");
    const antes = await page.locator("main").innerText();
    await page.locator("main input[type=number]").first().fill("2500000");
    await expect.poll(() => page.locator("main").innerText()).not.toBe(antes);
  });
});

test.describe("Formularios de contacto", () => {
  test("contacto: valida campos vacíos y correo inválido", async ({ page, go, press }) => {
    await go("/contacto");
    await press(page.locator(".contact-form button[type=submit]"));
    await expect(page.locator(".contact-form .form-error")).toHaveCount(3);
    await page.fill("#contact-name", "Prueba");
    await page.fill("#contact-email", "no-es-correo");
    await page.fill("#contact-message", "Hola");
    await press(page.locator(".contact-form button[type=submit]"));
    await expect(page.locator("#contact-email ~ .form-error")).toHaveText("Correo electrónico no válido");
  });

  test("contacto: envía el mensaje, limpia el formulario y frena el segundo envío seguido", async ({ page, go, press }) => {
    await go("/contacto");
    await page.fill("#contact-name", "QA Tester");
    await page.fill("#contact-email", "qa@example.com");
    await page.fill("#contact-phone", "8711234567");
    await page.fill("#contact-message", "Mensaje de prueba automatizada");
    await press(page.locator(".contact-form button[type=submit]"));
    await expect(page.locator(".contact-form")).toContainText(/gracias|enviado|recibimos|pronto/i);
    await expect(page.locator("#contact-name")).toHaveValue("");

    // Límite anti-spam: un envío por minuto por navegador.
    await page.fill("#contact-name", "Otro");
    await page.fill("#contact-email", "otro@example.com");
    await page.fill("#contact-message", "segundo mensaje inmediato");
    await press(page.locator(".contact-form button[type=submit]"));
    await expect(page.locator(".contact-form")).toContainText(/minuto|espera|demasiad/i);
  });

  test("vende tu casa: valida y envía la solicitud", async ({ page, go, press }) => {
    await go("/vende-tu-casa");
    const enviar = page.locator("form button[type=submit]").last();
    await press(enviar);
    expect(await page.locator("form .form-error").count()).toBeGreaterThanOrEqual(3);
    await page.fill("#sh-name", "Vendedor QA");
    await page.fill("#sh-phone", "8711234567");
    await page.fill("#sh-address", "Calle Prueba 123, Torreón");
    await page.fill("#sh-land", "200");
    await page.fill("#sh-built", "150");
    await page.fill("#sh-price", "1800000");
    await press(enviar);
    await expect(page.locator("main")).toContainText(/gracias|recibimos|contactar|enviad/i);
  });

  test("guía del comprador: dejar datos descarga el PDF", async ({ page, go, press }) => {
    await go("/guia-del-comprador");
    await page.fill("#bg-name", "QA Guía");
    await page.fill("#bg-phone", "8711234567");
    const [descarga] = await Promise.all([page.waitForEvent("download", { timeout: 20_000 }), press(page.locator("main form button[type=submit]"))]);
    expect(descarga.suggestedFilename()).toMatch(/\.pdf$/);
  });
});

test.describe("Contenido", () => {
  test("blog: lista de artículos y lectura de uno", async ({ page, go, press }) => {
    await go("/blog");
    const articulos = page.locator("main a[href^='/blog/']");
    await expect(articulos.first()).toBeVisible();
    await press(articulos.first());
    await page.waitForURL(/\/blog\/.+/);
    await expect(page.locator("h1").first()).toBeVisible();
  });

  test("torre: el plano de disponibilidad abre la ficha del departamento", async ({ page, go, press }) => {
    await go("/desarrollos/torre-aurora");
    const celdas = page.locator(".dev-map__cell");
    await expect(celdas.first()).toBeVisible();
    expect(await celdas.count()).toBe(38);
    const disponible = page.locator(".dev-map__cell--disponible, .dev-map__cell--available").first();
    const celda = (await disponible.count()) ? disponible : celdas.first();
    await celda.scrollIntoViewIfNeeded();
    await press(celda);
    const dialogo = page.locator("dialog[open], [role=dialog]").first();
    await expect(dialogo).toBeVisible();
    const caja = await dialogo.boundingBox();
    expect(caja.x, "el diálogo se sale por la izquierda").toBeGreaterThanOrEqual(-1);
    expect(caja.x + caja.width, "el diálogo se sale por la derecha").toBeLessThanOrEqual(page.viewportSize().width + 1);
    await expect(dialogo.locator("a[href*='wa.me']")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(page.locator("dialog[open], [role=dialog]")).toHaveCount(0);
  });

  test("torre: la lista se filtra", async ({ page, go }) => {
    await go("/desarrollos/torre-aurora");
    await expect(page.locator("h1")).toContainText("Torre Aurora");
    const antes = await page.locator("main").innerText();
    const filtro = page.locator("main select").nth(1);
    await filtro.selectOption({ index: 1 });
    await expect.poll(() => page.locator("main").innerText()).not.toBe(antes);
  });

  test("chat: el panel cabe en pantalla y ofrece WhatsApp como plan B", async ({ page, go, press }) => {
    await go("/");
    const boton = page.locator(".chat-widget__toggle, .chat-widget > button").first();
    await press(boton);
    const panel = page.locator(".chat-widget__panel");
    await expect(panel).toBeVisible();
    const caja = await panel.boundingBox();
    const vp = page.viewportSize();
    expect(caja.x).toBeGreaterThanOrEqual(-1);
    expect(caja.y).toBeGreaterThanOrEqual(-1);
    expect(caja.x + caja.width).toBeLessThanOrEqual(vp.width + 1);
    expect(caja.y + caja.height).toBeLessThanOrEqual(vp.height + 1);
    // Sin backend (modo demo) el chat avisa y deja WhatsApp a la mano.
    await expect(panel.locator("a[href*='wa.me']").first()).toBeVisible();
  });
});
