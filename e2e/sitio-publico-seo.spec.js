import { test, expect } from "./fixtures.js";

// Puntos 71–80: formulario de propiedad por pasos con borrador, 404 con búsqueda, barra inferior en el teléfono,
// direcciones legibles de las fichas y lo que Google lee (canonical, hreflang, datos estructurados).

const SENDEROS_SLUG = "casa-en-residencial-senderos-ACL-1001";
const attr = (page, selector, name) => page.locator(selector).first().getAttribute(name);
const jsonLd = async (page) => JSON.parse(await page.locator("script#seo-jsonld").textContent());

test.describe("Direcciones legibles y SEO", () => {
  test("la ficha tiene dirección con el nombre y el código, y las viejas (id o solo código) llevan a ella", async ({ page, go }) => {
    for (const vieja of ["/propiedades/prop-1", "/propiedades/ACL-1001", `/propiedades/${SENDEROS_SLUG}`]) {
      await go(vieja);
      await expect(page.locator("h1").first()).toBeVisible();
      await page.waitForURL((u) => u.pathname === `/propiedades/${SENDEROS_SLUG}`);
    }
  });

  test("las tarjetas del listado enlazan con la dirección legible", async ({ page, go }) => {
    await go("/propiedades");
    await expect(page.locator(`.property-card a[href="/propiedades/${SENDEROS_SLUG}"]`).first()).toBeVisible();
  });

  test("la ficha declara su dirección canónica, las versiones es/en y datos estructurados (ficha, migas y preguntas)", async ({ page, go }) => {
    await go("/propiedades/prop-1");
    await page.waitForURL((u) => u.pathname === `/propiedades/${SENDEROS_SLUG}`);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`/propiedades/${SENDEROS_SLUG}$`));
    await expect(page.locator('link[rel="alternate"][hreflang="es"]')).toHaveCount(1);
    await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute("href", new RegExp(`${SENDEROS_SLUG}\\?lang=en$`));
    await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveCount(1);
    const types = (await jsonLd(page)).map((d) => d["@type"]);
    expect(types).toEqual(expect.arrayContaining(["RealEstateListing", "BreadcrumbList", "FAQPage"]));
  });

  test("?lang=en muestra el sitio en inglés y su canonical apunta a esa versión", async ({ page, go }) => {
    await go("/contacto?lang=en");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/contacto\?lang=en$/);
    await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute("content", "en_US");
  });

  test("?lang=en no muestra español ni un instante (el inglés se baja antes de montar la app)", async ({ page }) => {
    // Registra el texto del enlace «saltar al contenido» cada vez que cambia el DOM: el primero que aparezca ya debe estar en inglés.
    await page.addInitScript(() => {
      window.__skipTexts = [];
      new MutationObserver(() => {
        const text = document.querySelector(".skip-link")?.textContent?.trim();
        if (text && window.__skipTexts[window.__skipTexts.length - 1] !== text) window.__skipTexts.push(text);
      }).observe(document, { childList: true, subtree: true, characterData: true });
    });
    await page.goto("/contacto?lang=en");
    await expect(page.locator(".skip-link")).toHaveText("Skip to content");
    expect(await page.evaluate(() => window.__skipTexts)).toEqual(["Skip to content"]);
  });

  test("inicio, nosotros y contacto declaran a la inmobiliaria como negocio local", async ({ page, go }) => {
    for (const ruta of ["/", "/nosotros", "/contacto"]) {
      await go(ruta);
      await expect(page.locator("script#seo-jsonld")).toHaveCount(1);
      const ld = await jsonLd(page);
      expect(ld["@type"]).toBe("RealEstateAgent");
      expect(ld.address.addressLocality).toBe("Torreón");
    }
  });

  test("las páginas privadas llevan noindex y no declaran canonical", async ({ page, go }) => {
    await go("/favoritos");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  });
});

test.describe("Página 404", () => {
  test("ofrece buscar y muestra propiedades destacadas", async ({ page, go, press }) => {
    await go("/esta-pagina-no-existe");
    await expect(page.locator("h1")).toContainText("404");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.locator(".not-found__featured .property-card")).toHaveCount(3);
    await page.fill("#not-found-q", "Senderos");
    await press(page.locator(".not-found__search button[type=submit]"));
    await page.waitForURL((u) => u.pathname === "/propiedades" && u.searchParams.get("q") === "Senderos");
  });
});

test.describe("Barra inferior del teléfono", () => {
  test("en el teléfono lleva a Buscar, Favoritos y Contacto; en la ficha no aparece; en escritorio no existe a la vista", async ({ page, go, press, isMobile }) => {
    await go("/");
    const barra = page.locator(".public-tab-bar");
    if (!isMobile) {
      await expect(barra).toBeHidden();
      return;
    }
    await expect(barra).toBeVisible();
    await expect(barra.getByRole("link")).toHaveCount(3);
    await press(barra.getByRole("link", { name: "Favoritos" }));
    await page.waitForURL("**/favoritos");
    await expect(barra.getByRole("link", { name: "Favoritos" })).toHaveAttribute("aria-current", "page");
    await press(barra.getByRole("link", { name: "Contacto" }));
    await page.waitForURL("**/contacto");
    await go(`/propiedades/${SENDEROS_SLUG}`);
    await expect(page.locator(".public-tab-bar")).toHaveCount(0);
  });
});

test.describe("Formulario de propiedad por pasos", () => {
  test.beforeEach(async ({ seedAdminSession }) => {
    await seedAdminSession();
  });

  test("avanza por cinco pasos con barra de progreso y guardar siempre disponible", async ({ page, go, press }) => {
    await go("/admin/propiedades/nueva");
    const barra = page.getByRole("progressbar");
    await expect(barra).toHaveAttribute("aria-valuenow", "20");
    await expect(page.locator(".form-steps__tab")).toHaveCount(5);
    await expect(page.locator("#p-title")).toBeVisible();
    await expect(page.locator("#p-address")).toBeHidden();
    await press(page.getByRole("button", { name: "Siguiente", exact: true }));
    await expect(barra).toHaveAttribute("aria-valuenow", "40");
    await expect(page.locator("#p-address")).toBeVisible();
    await expect(page.locator("#p-title")).toBeHidden();
    await press(page.getByRole("button", { name: "Anterior", exact: true }));
    await expect(page.locator("#p-title")).toBeVisible();
    await press(page.locator(".form-steps__tab").nth(4));
    await expect(barra).toHaveAttribute("aria-valuenow", "100");
    await expect(page.locator("form.admin-form button[type=submit]")).toBeVisible();
  });

  test("al guardar con campos vacíos lleva al primer paso con errores y lo marca", async ({ page, go, press }) => {
    await go("/admin/propiedades/nueva");
    await press(page.locator(".form-steps__tab").nth(4));
    await press(page.locator("form.admin-form button[type=submit]"));
    await expect(page.locator("#p-title")).toBeVisible();
    await expect(page.locator("#p-title ~ .form-error")).toBeVisible();
    await expect(page.locator(".form-steps__tab.has-error").first()).toBeVisible();
  });

  test("el borrador se guarda solo, se ofrece al volver y se borra al guardar", async ({ page, go, press }) => {
    await go("/admin/propiedades/nueva");
    await page.fill("#p-title", "Casa del borrador");
    await expect(page.locator(".form-steps__saved")).toBeVisible();

    await go("/admin/propiedades/nueva");
    const aviso = page.locator(".admin-form__draft");
    await expect(aviso).toContainText("borrador");
    await press(aviso.getByRole("button", { name: "Descartar" }));
    await expect(aviso).toHaveCount(0);
    await expect(page.locator("#p-title")).toHaveValue("");

    // Descartar lo borra: al volver ya no hay aviso.
    await go("/admin/propiedades/nueva");
    await expect(page.locator(".admin-form__draft")).toHaveCount(0);

    await page.fill("#p-title", "Casa recuperada");
    await expect(page.locator(".form-steps__saved")).toBeVisible();
    await go("/admin/propiedades/nueva");
    await press(page.locator(".admin-form__draft").getByRole("button", { name: "Recuperar borrador" }));
    await expect(page.locator("#p-title")).toHaveValue("Casa recuperada");

    // Al guardar de verdad el borrador desaparece.
    await page.fill("#p-price", "500000");
    await page.fill("#p-area", "90");
    await press(page.getByRole("button", { name: "Siguiente", exact: true }));
    await page.selectOption("#p-zone", { index: 1 });
    await page.fill("#p-address", "Calle 1");
    await page.fill("#p-lat", "25.5");
    await page.fill("#p-lng", "-103.4");
    await press(page.locator("form.admin-form button[type=submit]"));
    await page.waitForURL((u) => u.pathname === "/admin/propiedades");
    await go("/admin/propiedades/nueva");
    await expect(page.locator(".admin-form__draft")).toHaveCount(0);
  });
});
