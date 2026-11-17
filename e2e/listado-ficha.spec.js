import { test, expect } from "./fixtures.js";

// Listado y ficha pública: carrusel en la tarjeta, rangos de precio, chips de
// filtros, búsqueda de texto, vista dividida con «buscar en esta zona», página y
// «Volver» en la dirección, calculadora de mensualidad, plano, «Cómo llegar» y
// los gestos de la galería (deslizar, pellizcar, doble toque).

const card = (page, id) => page.locator(".property-card", { has: page.locator(`a[href="/propiedades/${id}"]`) }).first();

// En móvil los filtros arrancan plegados.
async function abrirFiltros(page, press, isMobile) {
  if (isMobile) await press(page.locator(".property-filters__toggle"));
}

// Gestos táctiles reales (CDP): deslizar con un dedo y pellizcar con dos. Una sola
// sesión por gesto: el protocolo exige que el toque empiece y termine en la misma.
async function gesto(page, pasos) {
  const cdp = await page.context().newCDPSession(page);
  for (const [tipo, puntos] of pasos) {
    await cdp.send("Input.dispatchTouchEvent", { type: tipo, touchPoints: puntos.map((p, i) => ({ x: p.x, y: p.y, id: i + 1 })) });
  }
  await cdp.detach();
}

async function deslizar(page, desde, hasta) {
  const pasos = [["touchStart", [desde]]];
  for (let i = 1; i <= 4; i += 1) {
    pasos.push(["touchMove", [{ x: desde.x + ((hasta.x - desde.x) * i) / 4, y: desde.y + ((hasta.y - desde.y) * i) / 4 }]]);
  }
  pasos.push(["touchEnd", []]);
  await gesto(page, pasos);
}

async function pellizcar(page, centro, separacionInicial, separacionFinal) {
  const dedos = (sep) => [
    { x: centro.x - sep / 2, y: centro.y },
    { x: centro.x + sep / 2, y: centro.y },
  ];
  const pasos = [["touchStart", dedos(separacionInicial)]];
  for (let i = 1; i <= 4; i += 1) pasos.push(["touchMove", dedos(separacionInicial + ((separacionFinal - separacionInicial) * i) / 4)]);
  pasos.push(["touchEnd", []]);
  await gesto(page, pasos);
}

test.describe("Tarjeta del listado", () => {
  test("varias fotos: se baja solo la primera hasta tocar, los puntos siguen el deslizamiento y no abre la ficha", async ({ page, go, isMobile }) => {
    await go("/propiedades");
    const tarjeta = card(page, "prop-1"); // tiene 3 fotos
    await expect(tarjeta).toBeVisible();
    await expect(tarjeta.locator(".card-carousel__dots span")).toHaveCount(3);
    await expect(tarjeta.locator(".card-carousel__slide"), "antes de tocar solo se baja la primera foto").toHaveCount(1);

    if (!isMobile) await tarjeta.hover();
    else await tarjeta.locator(".card-carousel").dispatchEvent("touchstart");
    await expect(tarjeta.locator(".card-carousel__slide")).toHaveCount(3);

    await tarjeta.locator(".card-carousel__track").evaluate((el) => el.scrollTo({ left: el.clientWidth, behavior: "instant" }));
    await expect(tarjeta.locator(".card-carousel__dots span").nth(1)).toHaveClass(/is-active/);
    expect(new URL(page.url()).pathname).toBe("/propiedades");
  });

  test("las flechas (computadora) cambian de foto sin abrir la ficha", async ({ page, go, isMobile }) => {
    test.skip(isMobile, "en pantallas táctiles se desliza con el dedo; las flechas no se muestran");
    await go("/propiedades");
    const tarjeta = card(page, "prop-1");
    await tarjeta.hover();
    await expect(tarjeta.locator(".card-carousel__nav--prev"), "en la primera foto no hay «anterior»").toHaveCount(0);
    await tarjeta.locator(".card-carousel__nav--next").click();
    await expect(tarjeta.locator(".card-carousel__dots span").nth(1)).toHaveClass(/is-active/);
    expect(new URL(page.url()).pathname, "la flecha no debe navegar a la ficha").toBe("/propiedades");
  });

  test("una propiedad con una sola foto no lleva carrusel", async ({ page, go }) => {
    await go("/propiedades");
    const tarjeta = card(page, "prop-5"); // 1 foto
    await expect(tarjeta).toBeVisible();
    await expect(tarjeta.locator(".card-carousel")).toHaveCount(0);
    await expect(tarjeta.locator(".property-card__image-link img")).toHaveCount(1);
  });
});

test.describe("Filtros: precio, chips y búsqueda", () => {
  test("rango de precio listo: filtra, el campo lleva comas, sale un chip y se quita tocándolo otra vez", async ({ page, go, press, isMobile }) => {
    await go("/propiedades");
    await expect(page.locator(".property-card").first()).toBeVisible();
    const total = await page.locator(".property-card").count();
    await abrirFiltros(page, press, isMobile);

    const rango = page.locator(".property-filters__range", { hasText: "Hasta $1 M" });
    await press(rango);
    await expect(rango).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#filter-max-price")).toHaveValue("1,000,000");
    await expect(page.locator(".filter-chip", { hasText: "Hasta $1 M" })).toBeVisible();
    await expect.poll(() => page.locator(".property-card").count()).toBe(3); // 980 mil, 890 mil y 620 mil
    expect(new URL(page.url()).searchParams.get("max")).toBe("1000000");

    await press(rango);
    await expect(rango).toHaveAttribute("aria-pressed", "false");
    await expect.poll(() => page.locator(".property-card").count()).toBe(total);
  });

  test("el campo de precio acepta teclear y guarda solo los dígitos", async ({ page, go, press, isMobile }) => {
    await go("/propiedades");
    await abrirFiltros(page, press, isMobile);
    await page.locator("#filter-min-price").fill("$1,200,000");
    await expect(page.locator("#filter-min-price")).toHaveValue("1,200,000");
    await expect.poll(() => new URL(page.url()).searchParams.get("min")).toBe("1200000");
    await expect(page.locator(".filter-chip", { hasText: /Desde \$1\.2 M/ })).toBeVisible();
  });

  test("búsqueda de texto: sin acentos ni mayúsculas, un chip para quitarla y «Limpiar todo»", async ({ page, go, press }) => {
    await go("/propiedades");
    await expect(page.locator(".property-card").first()).toBeVisible();
    const total = await page.locator(".property-card").count();

    await page.locator("#properties-search").fill("GOMEZ palacio");
    await expect.poll(() => page.locator(".property-card").count()).toBe(2); // las dos de Gómez Palacio (sin naves)
    for (const tarjeta of await page.locator(".property-card").all()) await expect(tarjeta).toContainText("Gómez Palacio");
    await expect(page.locator(".filter-chip", { hasText: "GOMEZ palacio" })).toBeVisible();
    expect(new URL(page.url()).searchParams.get("q")).toBe("GOMEZ palacio");

    // Con otro filtro hay dos chips y aparece «Limpiar todo».
    await page.selectOption(".properties-page__toolbar select", "price_desc");
    await press(page.locator(".filter-chip", { hasText: "GOMEZ palacio" }));
    await expect(page.locator("#properties-search")).toHaveValue("");
    await expect.poll(() => page.locator(".property-card").count()).toBe(total);

    await page.locator("#properties-search").fill("guadiana");
    await expect.poll(() => page.locator(".property-card").count()).toBe(1);
    await expect(page.locator(".property-card").first()).toContainText("Valle del Guadiana");
  });

  test("«Limpiar todo» quita todos los chips a la vez", async ({ page, go, press, isMobile }) => {
    await go("/propiedades");
    await expect(page.locator(".property-card").first()).toBeVisible();
    const total = await page.locator(".property-card").count();
    await abrirFiltros(page, press, isMobile);
    await press(page.locator(".property-filters__range", { hasText: "Hasta $1 M" }));
    await page.locator("#properties-search").fill("casa");
    await expect(page.locator(".filter-chip")).toHaveCount(3); // búsqueda + precio + «Limpiar todo»
    await press(page.locator(".filter-chip--clear"));
    await expect(page.locator(".filter-chip")).toHaveCount(0);
    await expect(page.locator("#properties-search")).toHaveValue("");
    await expect.poll(() => page.locator(".property-card").count()).toBe(total);
  });
});

test.describe("Mapa y vista dividida", () => {
  test("PC: lista y mapa a la vez, y la vista queda en la dirección", async ({ page, go, press, isMobile }) => {
    test.skip(isMobile, "la vista dividida solo existe en pantallas anchas");
    await go("/propiedades");
    await press(page.locator(".properties-page__view-toggle button", { hasText: "Dividida" }));
    await expect(page.locator(".properties-split")).toBeVisible();
    await expect(page.locator(".properties-split .leaflet-container")).toBeVisible();
    await expect(page.locator(".properties-split .property-card").first()).toBeVisible();
    const lista = await page.locator(".properties-split__list").boundingBox();
    const mapa = await page.locator(".properties-split__map").boundingBox();
    expect(lista.x, "la lista va a la izquierda del mapa").toBeLessThan(mapa.x);
    expect(new URL(page.url()).searchParams.get("vista")).toBe("dividida");

    await page.reload();
    await expect(page.locator(".properties-split")).toBeVisible();
  });

  test("móvil: no hay vista dividida; una dirección «dividida» se ve como lista", async ({ page, go, isMobile }) => {
    test.skip(!isMobile, "solo aplica a pantallas angostas");
    await go("/propiedades?vista=dividida");
    await expect(page.locator(".properties-page__view-toggle button", { hasText: "Dividida" })).toHaveCount(0);
    await expect(page.locator(".properties-split")).toHaveCount(0);
    await expect(page.locator(".property-card").first()).toBeVisible();
  });

  test("«Buscar en esta zona» aparece solo al mover el mapa y deja el listado con lo visible", async ({ page, go, press }) => {
    await go("/propiedades?vista=mapa");
    await expect(page.locator(".leaflet-container")).toBeVisible();
    await expect(page.locator(".leaflet-marker-icon").first()).toBeVisible();
    await expect(page.locator(".map-area-search"), "el ajuste automático del mapa no cuenta como moverlo").toHaveCount(0);

    // Acercar el mapa varias veces: lo visible se reduce a una parte de las propiedades.
    for (let i = 0; i < 3; i += 1) {
      await press(page.locator(".leaflet-control-zoom-in"));
      await page.waitForTimeout(350);
    }
    const buscar = page.locator(".map-area-search button");
    await expect(buscar).toBeVisible();
    await press(buscar);

    await expect(page.locator(".filter-chip", { hasText: "Zona del mapa" })).toBeVisible();
    expect(new URL(page.url()).searchParams.get("area")).toMatch(/^-?\d/);
    await expect(page.locator(".map-area-search")).toHaveCount(0);

    await press(page.locator(".filter-chip", { hasText: "Zona del mapa" }));
    await expect(page.locator(".filter-chip")).toHaveCount(0);
    expect(new URL(page.url()).searchParams.get("area")).toBeNull();
  });
});

test.describe("Página en la dirección y «Volver»", () => {
  // El modo demo solo trae 9 propiedades: se agregan 30 casas para tener 2 páginas (24 por página).
  async function sembrarCasas(page, go) {
    await go("/");
    await page.evaluate(() => {
      const props = JSON.parse(localStorage.getItem("acl_local_properties"));
      const base = props.find((p) => p.id === "prop-1");
      for (let i = 0; i < 30; i += 1) props.push({ ...base, id: `extra-${i}`, code: `EXTRA-${i}`, title: `Casa extra ${i}`, images: [], main_image: "" });
      localStorage.setItem("acl_local_properties", JSON.stringify(props));
    });
  }

  test("la página 2 viaja en la dirección, se restaura al recargar y una página inexistente cae en la última", async ({ page, go, press }) => {
    await sembrarCasas(page, go);
    await go("/propiedades");
    await expect(page.locator(".property-card").first()).toBeVisible();
    await press(page.locator(".properties-page__pagination button", { hasText: /Siguiente|Next/ }));
    await expect.poll(() => new URL(page.url()).searchParams.get("pagina")).toBe("2");
    const enPagina2 = await page.locator(".property-card").count();
    expect(enPagina2).toBeLessThan(24);

    await page.reload();
    await expect(page.locator(".property-card").first()).toBeVisible();
    await expect(page.locator(".property-card")).toHaveCount(enPagina2);

    await go("/propiedades?pagina=99");
    await expect.poll(() => new URL(page.url()).searchParams.get("pagina")).toBe("2");
    await expect(page.locator(".property-card")).toHaveCount(enPagina2);
  });

  test("abrir una ficha y tocar «Volver» regresa al mismo listado, página y posición", async ({ page, go, press }) => {
    await sembrarCasas(page, go);
    await go("/propiedades?pagina=2&orden=price_desc");
    await expect(page.locator(".property-card").first()).toBeVisible();

    // Se baja un poco y se abre una ficha con un clic desde el propio documento
    // (así la posición al salir es exactamente la que se fijó).
    await page.evaluate(() => window.scrollTo(0, 500));
    const antes = await page.evaluate(() => window.scrollY);
    expect(antes).toBeGreaterThan(300);
    await page.evaluate(() => document.querySelectorAll(".property-card__title a")[2].click());
    await page.waitForURL(/\/propiedades\/[^/?]+$/);
    await expect(page.locator(".property-detail__back")).toBeVisible();

    await press(page.locator(".property-detail__back"));
    await page.waitForURL((u) => u.pathname === "/propiedades");
    expect(new URL(page.url()).searchParams.get("pagina")).toBe("2");
    expect(new URL(page.url()).searchParams.get("orden")).toBe("price_desc");
    await expect(page.locator(".property-card").first()).toBeVisible();
    await expect.poll(() => page.evaluate(() => Math.abs(window.scrollY - 500)), { timeout: 4000 }).toBeLessThan(25);
  });

  test("sin haber venido de un listado, «Volver» lleva a Propiedades", async ({ page, go, press }) => {
    await go("/propiedades/prop-2");
    await press(page.locator(".property-detail__back"));
    await page.waitForURL((u) => u.pathname === "/propiedades");
  });
});

test.describe("Ficha: calculadora, cómo llegar y plano", () => {
  test("calculadora de mensualidad: arranca con los valores de referencia y responde a los controles", async ({ page, go, press }) => {
    await go("/propiedades/prop-1");
    const calc = page.locator(".mortgage-calc");
    await expect(calc).toBeVisible();
    const inicial = await calc.locator(".mortgage-calc__payment").innerText();
    await expect(calc.locator(".mortgage-calc__control strong").nth(0)).toContainText("20%");
    await expect(calc.getByRole("button", { name: "Valores de referencia" })).toHaveCount(0);

    await calc.locator('input[type="range"]').nth(0).fill("50"); // enganche
    await expect(calc.locator(".mortgage-calc__control strong").nth(0)).toContainText("50%");
    const conMasEnganche = await calc.locator(".mortgage-calc__payment").innerText();
    const numero = (texto) => Number(texto.replace(/[^\d]/g, ""));
    expect(numero(conMasEnganche), "con más enganche la mensualidad baja").toBeLessThan(numero(inicial));

    await calc.locator('input[type="range"]').nth(1).fill("10"); // plazo más corto: cuota más alta
    expect(numero(await calc.locator(".mortgage-calc__payment").innerText())).toBeGreaterThan(numero(conMasEnganche));

    await press(calc.getByRole("button", { name: "Valores de referencia" }));
    await expect(calc.locator(".mortgage-calc__payment")).toHaveText(inicial);
  });

  test("la calculadora no sale en rentas, terrenos, naves ni propiedades vendidas", async ({ page, go }) => {
    for (const id of ["prop-7", "prop-6"]) {
      await go(`/propiedades/${id}`);
      await expect(page.locator("h1").first()).toBeVisible();
      await expect(page.locator(".mortgage-calc"), id).toHaveCount(0);
    }
  });

  test("«Personalizar» salta a la calculadora", async ({ page, go, press }) => {
    await go("/propiedades/prop-1");
    await press(page.locator(".property-detail__monthly-adjust"));
    await expect(page.locator("#calculadora-credito")).toBeInViewport();
  });

  test("«Cómo llegar», Street View y Waze apuntan a las coordenadas de la propiedad", async ({ page, go }) => {
    await go("/propiedades/prop-1");
    const acciones = page.locator(".property-detail__map-actions");
    await expect(acciones).toBeVisible();
    const punto = "25.5719%2C-103.3859";
    await expect(acciones.getByRole("link", { name: "Cómo llegar" })).toHaveAttribute("href", new RegExp(`google\\.com/maps/dir/.*destination=${punto}`));
    await expect(acciones.getByRole("link", { name: "Ver en Street View" })).toHaveAttribute("href", new RegExp(`map_action=pano.*viewpoint=${punto}`));
    await expect(acciones.getByRole("link", { name: "Abrir en Waze" })).toHaveAttribute("href", new RegExp(`waze\\.com/ul\\?ll=${punto}`));
    for (const enlace of await acciones.getByRole("link").all()) {
      await expect(enlace).toHaveAttribute("target", "_blank");
      await expect(enlace).toHaveAttribute("rel", /noopener/);
    }
  });

  test("plano: se sube desde el formulario, se ve y se amplía en la ficha, y se puede quitar", async ({ page, go, press, seedAdminSession }) => {
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
    await seedAdminSession();

    await go("/propiedades/prop-1");
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page.locator(".property-detail__plan"), "sin plano no hay sección").toHaveCount(0);

    await go("/admin/propiedades/prop-1");
    await expect(page.locator("#p-title")).toHaveValue(/Senderos/);
    // Un archivo que no es PNG/JPG se rechaza con un aviso.
    await page.setInputFiles('[data-testid="floor-plan-input"]', { name: "plano.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") });
    await expect(page.locator(".floor-plan-field .form-error")).toContainText("PNG o JPG");
    await page.setInputFiles('[data-testid="floor-plan-input"]', { name: "plano.png", mimeType: "image/png", buffer: png });
    await expect(page.locator(".floor-plan-field__preview img")).toBeVisible();
    await press(page.locator("form.admin-form .admin-form__actions button[type=submit]"));
    await page.waitForURL((u) => u.pathname === "/admin/propiedades");

    await go("/propiedades/prop-1");
    const plano = page.locator(".property-detail__plan");
    await expect(plano).toBeVisible();
    await expect(plano.locator("img")).toHaveAttribute("src", /^data:image\/png/);
    await press(plano);
    await expect(page.locator(".gallery-lightbox")).toBeVisible();
    await press(page.locator(".gallery-lightbox__close"));
    await expect(page.locator(".gallery-lightbox")).toHaveCount(0);

    // Quitarlo desde el formulario.
    await go("/admin/propiedades/prop-1");
    await expect(page.locator(".floor-plan-field__preview img")).toBeVisible();
    await press(page.locator(".floor-plan-field__preview button"));
    await expect(page.locator(".floor-plan-field__preview")).toHaveCount(0);
    await press(page.locator("form.admin-form .admin-form__actions button[type=submit]"));
    await page.waitForURL((u) => u.pathname === "/admin/propiedades");
    await go("/propiedades/prop-1");
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page.locator(".property-detail__plan")).toHaveCount(0);
  });
});

test.describe("Galería: gestos", () => {
  test("móvil: deslizar la foto principal cambia de foto sin abrir el visor", async ({ page, go, isMobile }) => {
    test.skip(!isMobile, "gestos táctiles");
    await go("/propiedades/prop-1"); // 3 fotos
    const principal = page.locator(".gallery__main");
    await expect(principal.locator(".gallery__counter")).toHaveText("1 / 3");
    const caja = await principal.boundingBox();
    const y = caja.y + caja.height / 2;

    await deslizar(page, { x: caja.x + caja.width * 0.8, y }, { x: caja.x + caja.width * 0.2, y });
    await expect(principal.locator(".gallery__counter")).toHaveText("2 / 3");
    await expect(page.locator(".gallery-lightbox"), "deslizar no abre el visor").toHaveCount(0);

    await deslizar(page, { x: caja.x + caja.width * 0.2, y }, { x: caja.x + caja.width * 0.8, y });
    await expect(principal.locator(".gallery__counter")).toHaveText("1 / 3");

    // Un deslizamiento vertical es scroll de la página: no cambia la foto.
    await deslizar(page, { x: caja.x + caja.width / 2, y: y + 40 }, { x: caja.x + caja.width / 2 + 10, y: y - 40 });
    await expect(principal.locator(".gallery__counter")).toHaveText("1 / 3");
  });

  test("móvil: en el visor se pellizca para acercar, se arrastra y el doble toque acerca y vuelve", async ({ page, go, isMobile }) => {
    test.skip(!isMobile, "gestos táctiles");
    await go("/propiedades/prop-1");
    await page.locator(".gallery__main").tap();
    const imagen = page.locator(".gallery-lightbox__image");
    await expect(imagen).toBeVisible();
    const escala = async () => Number((await imagen.getAttribute("style")).match(/scale\(([\d.]+)\)/)[1]);
    expect(await escala()).toBe(1);

    const caja = await page.locator(".gallery-lightbox__stage").boundingBox();
    const centro = { x: caja.x + caja.width / 2, y: caja.y + caja.height / 2 };

    await pellizcar(page, centro, 60, 240);
    expect(await escala(), "pellizcar acerca").toBeGreaterThan(1.5);
    await expect(imagen).toHaveClass(/gallery-lightbox__image--zoomed/);

    // Pellizcar hacia adentro hasta el mínimo vuelve a la foto completa.
    await pellizcar(page, centro, 300, 40);
    await expect.poll(escala).toBe(1);

    // Doble toque: acerca; otro doble toque: vuelve.
    await page.touchscreen.tap(centro.x, centro.y);
    await page.touchscreen.tap(centro.x, centro.y);
    await expect.poll(escala).toBe(2.5);
    await page.touchscreen.tap(centro.x, centro.y);
    await page.touchscreen.tap(centro.x, centro.y);
    await expect.poll(escala).toBe(1);

    // Deslizar con un dedo (sin acercar) cambia de foto.
    await expect(page.locator(".gallery-lightbox__counter")).toContainText("1 / 3");
    await deslizar(page, { x: centro.x + 120, y: centro.y }, { x: centro.x - 120, y: centro.y });
    await expect(page.locator(".gallery-lightbox__counter")).toContainText("2 / 3");
  });

  test("PC: un clic acerca la foto del visor y otro la devuelve", async ({ page, go, isMobile }) => {
    test.skip(isMobile, "con el ratón");
    await go("/propiedades/prop-1");
    await page.locator(".gallery__main").click();
    const imagen = page.locator(".gallery-lightbox__image");
    await expect(imagen).toHaveAttribute("style", /scale\(1\)/);
    await imagen.click();
    await expect(imagen).toHaveAttribute("style", /scale\(2\.5\)/);
    await imagen.click();
    await expect(imagen).toHaveAttribute("style", /scale\(1\)/);
  });
});
