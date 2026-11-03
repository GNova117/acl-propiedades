import { test, expect } from "./fixtures.js";

// Regresiones de diseño adaptable (móvil/tableta). Cada prueba corresponde a un
// defecto real que se encontró y corrigió; si vuelve, estas fallan.
// Solo corren en el proyecto «mobile»: fijan su propio ancho con setViewportSize.
//
// Fuente ancha a propósito: el ancho del texto depende de las fuentes instaladas.
// Inter (la del sitio) llega desde Google Fonts, que aquí se bloquea, y cada equipo
// cae en su tipografía de respaldo: en una máquina con Inter instalada todo cabía y
// en el CI (DejaVu Sans) la cabecera de los filtros se desbordaba a 320 px. Se fuerza
// una fuente ancha para que el resultado no dependa del equipo y se pruebe el peor caso.
const FUENTE_ANCHA = ':root{--font-body:"DejaVu Sans",Verdana,sans-serif;--font-heading:"DejaVu Sans",Verdana,sans-serif}';

test.describe("Móvil y tableta", () => {
  test.skip(({ isMobile }) => !isMobile, "solo aplica al proyecto móvil");

  test.beforeEach(async ({ page }) => {
    await page.addInitScript((css) => {
      document.addEventListener("DOMContentLoaded", () => {
        const estilo = document.createElement("style");
        estilo.textContent = css;
        document.head.appendChild(estilo);
      });
    }, FUENTE_ANCHA);
  });

  const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

  // Anchos reales: 320 (iPhone SE viejo), 360 (Android más común), 390 (iPhone),
  // 768 / 1024 (iPad vertical y horizontal). Inicio se desbordaba a ≤360 y a 1024 px
  // porque su rejilla `1fr` no podía bajar del ancho mínimo de la tarjeta (~350 px).
  for (const width of [320, 360, 390, 768, 1024]) {
    test(`ninguna página se desborda de lado a ${width} px`, async ({ page, go }) => {
      await page.setViewportSize({ width, height: 800 });
      for (const route of ["/", "/propiedades", "/contacto", "/propiedades/prop-1", "/terrenos", "/desarrollos/torre-aurora"]) {
        await go(route);
        expect.soft(await overflow(page), `${route} a ${width} px: píxeles de desborde horizontal`).toBeLessThanOrEqual(1);
      }
    });
  }

  // El pie de la tarjeta (asesor + Compartir + Ver detalle) no cabía en una tarjeta
  // angosta y «Ver detalle» quedaba recortado contra el borde de la tarjeta.
  for (const [width, route] of [
    [360, "/"],
    [360, "/propiedades"],
    [1024, "/"],
  ]) {
    test(`los botones de la tarjeta no se recortan (${route} a ${width} px)`, async ({ page, go }) => {
      await page.setViewportSize({ width, height: 800 });
      await go(route);
      await expect(page.locator(".property-card").first()).toBeVisible();
      const clipped = await page.evaluate(() =>
        [...document.querySelectorAll(".property-card")]
          .map((card) => {
            const cardRect = card.getBoundingClientRect();
            const actions = card.querySelector(".property-card__footer-actions")?.getBoundingClientRect();
            return actions && actions.right > cardRect.right - 1 ? `${card.querySelector("h3")?.textContent}: botones terminan en ${Math.round(actions.right)} y la tarjeta en ${Math.round(cardRect.right)}` : null;
          })
          .filter(Boolean),
      );
      expect(clipped, "tarjetas con el pie recortado").toEqual([]);
    });
  }

  // Con un terreno publicado el menú tiene 8 enlaces; el tope fijo de 320 px dejaba
  // «Contacto» con 4 px visibles, imposible de tocar.
  test("el menú con 8 enlaces muestra «Contacto» completo y se puede tocar", async ({ page, go, press }) => {
    await go("/");
    await page.evaluate(() => {
      const key = "acl_local_properties";
      const list = JSON.parse(localStorage.getItem(key));
      list.find((p) => p.type !== "nave_industrial").type = "terreno"; // aparece «Terrenos» en el menú
      localStorage.setItem(key, JSON.stringify(list));
    });
    await page.reload();
    await expect(page.locator(".site-nav a", { hasText: "Terrenos" })).toHaveCount(1);

    await press(page.getByRole("button", { name: "Abrir menú" }));
    const nav = page.locator(".site-nav--open");
    await expect(nav).toBeVisible();
    await expect.poll(() => page.locator(".site-nav a").count()).toBe(8);
    await page.waitForTimeout(400); // fin de la transición de apertura
    const clipped = await page.evaluate(() => {
      const bottom = document.querySelector(".site-nav").getBoundingClientRect().bottom;
      return [...document.querySelectorAll(".site-nav a")].filter((a) => a.getBoundingClientRect().bottom > bottom + 0.5).map((a) => a.textContent);
    });
    expect(clipped, "enlaces recortados dentro del menú abierto").toEqual([]);

    await press(page.locator(".site-nav a", { hasText: "Contacto" }));
    await page.waitForURL("**/contacto");
  });

  // Una propiedad o asesor sin foto pintaba <img src=""> (tarjeta, comparador, mapa, admin).
  test("propiedad y asesor sin foto no generan <img> vacío en ninguna vista", async ({ page, go, press }) => {
    await go("/");
    await page.evaluate(() => {
      const props = JSON.parse(localStorage.getItem("acl_local_properties"));
      Object.assign(props.find((p) => p.id === "prop-1"), { main_image: "", images: [] });
      localStorage.setItem("acl_local_properties", JSON.stringify(props));
      const advisors = JSON.parse(localStorage.getItem("acl_local_advisors") || "null");
      if (advisors) {
        advisors.forEach((a) => (a.photo_url = ""));
        localStorage.setItem("acl_local_advisors", JSON.stringify(advisors));
      }
    });

    const emptyImgs = () => page.locator('img[src=""], img:not([src])').count();

    await go("/propiedades");
    const card = page.locator(".property-card", { has: page.locator('a[href="/propiedades/prop-1"]') }).first();
    await expect(card).toBeVisible();
    await expect(card.locator(".property-card__image-link img"), "la tarjeta sin foto no debe pintar <img>").toHaveCount(0);
    expect(await emptyImgs(), "/propiedades").toBe(0);

    await press(card.locator(".compare-button"));
    await go("/comparar");
    await expect(page.locator("main")).toContainText("Casa en Residencial Senderos");
    expect(await emptyImgs(), "/comparar").toBe(0);

    await go("/propiedades/prop-1");
    await expect(page.locator("h1").first()).toContainText("Casa en Residencial Senderos");
    expect(await emptyImgs(), "ficha de propiedad").toBe(0);

    await page.evaluate(() => localStorage.setItem("acl_local_session", JSON.stringify({ user: { email: "admin@aclpropiedades.com" } })));
    for (const route of ["/admin/propiedades", "/admin/asesores", "/admin/propiedades/prop-1"]) {
      await go(route);
      await expect(page.locator(".admin-layout__content h1").first()).toBeVisible();
      expect(await emptyImgs(), route).toBe(0);
    }
  });

  test.describe("Panel admin en móvil", () => {
    test.beforeEach(async ({ seedAdminSession }) => {
      await seedAdminSession();
    });

    // El cajón solo se cerraba cuando cambiaba la ruta: tocar el enlace de la página
    // donde ya estás lo dejaba abierto tapando la pantalla.
    test("el cajón del menú se cierra al tocar el enlace de la página actual", async ({ page, go, press }) => {
      await go("/admin");
      await press(page.locator(".admin-layout__menu-btn"));
      await expect(page.locator(".admin-layout__backdrop")).toBeVisible();
      await press(page.locator('.admin-layout__sidebar a[href="/admin"]'));
      await expect(page.locator(".admin-layout__backdrop")).toHaveCount(0);
      await expect(page.locator(".admin-layout__menu-btn")).toHaveAttribute("aria-expanded", "false");
    });

    // Los botones de la barra le dejaban al buscador ~60 px (se leía «Bu»).
    test("el buscador global se extiende al enfocarlo y encuentra resultados", async ({ page, go, press }) => {
      await go("/admin");
      const input = page.locator(".admin-search__input");
      const before = (await input.boundingBox()).width;
      await press(input);
      await input.fill("Senderos");
      await expect(page.locator(".admin-search__item").first()).toBeVisible();
      const after = (await input.boundingBox()).width;
      const viewport = page.viewportSize().width;
      expect(after, `el campo pasó de ${Math.round(before)} a ${Math.round(after)} px`).toBeGreaterThan(viewport * 0.8);
      await press(page.locator(".admin-search__item").first());
      await page.waitForURL(/\/admin\/propiedades\/.+/);
    });
  });
});
