import { test, expect } from "./fixtures.js";

// Mejoras 11–20 del cliente y del asesor: ficha en PDF, lista de favoritos compartible, tiempo de traslado, «Mi
// espacio», «Visítala mañana», reacciones en la selección, interés en línea en el informe del vendedor y el aviso por
// correo del trámite. Modo demo: la «base» es el localStorage de cada prueba.

const ahora = () => new Date().toISOString();
const enDias = (dias) => new Date(Date.now() + dias * 864e5).toISOString();
const poner = (page, clave, valor) => page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [clave, valor]);
const TOKEN = "c".repeat(32);

const seleccion = (extra = {}) => ({
  id: "sel-e2e",
  token: TOKEN,
  title: "Propiedades para Luis",
  note: "Las que mejor van contigo.",
  property_ids: ["prop-1", "prop-2", "prop-4"],
  advisor_id: "advisor-1",
  prospecto_id: null,
  created_by: "admin@aclpropiedades.com",
  created_at: ahora(),
  expires_at: enDias(60),
  first_opened_at: null,
  last_opened_at: null,
  open_count: 0,
  revoked_at: null,
  reactions: {},
  ...extra,
});

// En /seleccion/<token> hay una tarjeta por propiedad, cada una con su bloque de reacciones.
const item = (page, n) => page.locator(".public-selection__item").nth(n);

test.describe("Ficha en PDF", () => {
  test("«Descargar ficha en PDF» baja un PDF con el membrete", async ({ page, go, press }) => {
    await go("/propiedades/prop-1");
    const [descarga] = await Promise.all([page.waitForEvent("download"), press(page.getByRole("button", { name: "Descargar ficha en PDF" }))]);
    expect(descarga.suggestedFilename()).toMatch(/^Ficha_.*\.pdf$/);
    expect(descarga.suggestedFilename(), "la versión pública no se llama «FichaTecnica»").not.toMatch(/^FichaTecnica/);
    await expect(page.locator(".download-ficha .form-error")).toHaveCount(0);
  });
});

test.describe("Favoritos compartibles", () => {
  test("una lista compartida se ve sin tocar mis favoritos y se puede guardar", async ({ page, go, press }) => {
    await go("/favoritos?lista=prop-1,prop-2,<script>,prop-1");
    const banner = page.locator(".favorites-banner");
    await expect(banner).toContainText("Te compartieron 2 propiedades.");
    await expect(page.locator(".property-card")).toHaveCount(2);
    expect(await page.evaluate(() => localStorage.getItem("acl_favorites")), "ver la lista no guarda nada").toBeNull();

    await press(banner.getByRole("button", { name: "Guardar en mis favoritos" }));
    await expect(banner).toContainText("ya están en tus favoritos");
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("acl_favorites")))).toEqual(["prop-1", "prop-2"]);

    await press(banner.getByRole("link", { name: "Ver mi lista" }));
    await page.waitForURL((u) => u.pathname === "/favoritos" && !u.search);
    await expect(page.locator(".property-card")).toHaveCount(2);
    await expect(page.locator(".favorites-share")).toBeVisible();
  });

  test("mi lista ofrece compartirla; con una lista compartida ya guardada no pide guardarla otra vez", async ({ page, go }) => {
    await go("/");
    await poner(page, "acl_favorites", ["prop-1", "prop-4"]);
    await go("/favoritos");
    await expect(page.locator(".favorites-share")).toContainText("Con el enlace se abre esta lista");
    await go("/favoritos?lista=prop-1,prop-4");
    await expect(page.locator(".favorites-banner")).toContainText("ya están en tus favoritos");
    await expect(page.locator(".favorites-banner").getByRole("button", { name: "Guardar en mis favoritos" })).toHaveCount(0);
  });

  test("una lista cuyas propiedades ya no existen lo dice", async ({ page, go }) => {
    await go("/favoritos?lista=no-existe-1,no-existe-2");
    await expect(page.locator(".empty-state")).toContainText("ya no tiene propiedades disponibles");
  });
});

test.describe("Tiempo de traslado", () => {
  const nominatim = (page) =>
    page.route("https://nominatim.openstreetmap.org/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{ place_id: 1, display_name: "Parque Industrial Lagunero, Gómez Palacio, Durango, México", lat: "25.6265", lon: "-103.4429" }]),
      }),
    );

  test("con la ruta real: dice los minutos, avisa a dónde va la dirección y la recuerda en otras fichas", async ({ page, go, press }) => {
    await nominatim(page);
    await page.route("https://router.project-osrm.org/**", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ code: "Ok", routes: [{ duration: 1260, distance: 14500 }] }) }),
    );
    await go("/propiedades/prop-1");
    const bloque = page.locator(".travel-time");
    await expect(bloque).toContainText("OpenStreetMap");
    await bloque.getByRole("textbox").fill("Parque Industrial Lagunero");
    await press(bloque.getByRole("button", { name: "Calcular" }));
    await expect(bloque.locator(".travel-time__duration strong")).toHaveText("20 min");
    await expect(bloque).toContainText("en auto · 14.5 km");
    await expect(bloque, "con la ruta real no dice «aprox.»").not.toContainText("Estimación");
    await expect(bloque).toContainText("Desde: Parque Industrial Lagunero, Gómez Palacio, Durango");

    // En otra ficha ya está el lugar, pero NO se calcula solo: hay que tocar «Calcular».
    await go("/propiedades/prop-2");
    await expect(page.locator(".travel-time")).toContainText("Desde: Parque Industrial Lagunero");
    await expect(page.locator(".travel-time__duration")).toHaveCount(0);
    await press(page.locator(".travel-time").getByRole("button", { name: "Calcular" }));
    await expect(page.locator(".travel-time__duration strong")).toBeVisible();

    await press(page.locator(".travel-time").getByRole("button", { name: "Cambiar" }));
    await expect(page.locator(".travel-time").getByRole("textbox")).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("acl_travel_place"))).toBeNull();
  });

  test("si el servicio de rutas no contesta, da una estimación y lo avisa", async ({ page, go, press }) => {
    await nominatim(page);
    await page.route("https://router.project-osrm.org/**", (route) => route.abort());
    await go("/propiedades/prop-1");
    const bloque = page.locator(".travel-time");
    await bloque.getByRole("textbox").fill("Parque Industrial Lagunero");
    await press(bloque.getByRole("button", { name: "Calcular" }));
    await expect(bloque.locator(".travel-time__duration strong")).toContainText("≈");
    await expect(bloque).toContainText("Estimación a partir de la distancia");
  });

  test("una dirección que no se encuentra da un aviso y no calcula", async ({ page, go, press }) => {
    await page.route("https://nominatim.openstreetmap.org/**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
    await go("/propiedades/prop-1");
    const bloque = page.locator(".travel-time");
    await bloque.getByRole("textbox").fill("Calle que no existe 999");
    await press(bloque.getByRole("button", { name: "Calcular" }));
    await expect(bloque.getByRole("alert")).toContainText("No encontramos esa dirección");
    await expect(bloque.locator(".travel-time__duration")).toHaveCount(0);
  });

  test("no se manda nada a internet mientras se teclea ni con menos de 3 letras", async ({ page, go }) => {
    const salidas = [];
    page.on("request", (r) => /nominatim|osrm/.test(r.url()) && salidas.push(r.url()));
    await go("/propiedades/prop-1");
    const bloque = page.locator(".travel-time");
    await bloque.getByRole("textbox").fill("Parque Industrial");
    await expect(bloque.getByRole("button", { name: "Calcular" })).toBeEnabled();
    await bloque.getByRole("textbox").fill("ab");
    await expect(bloque.getByRole("button", { name: "Calcular" })).toBeDisabled();
    expect(salidas).toEqual([]);
  });
});

test.describe("Mi espacio", () => {
  test("anota la selección que abrió el cliente, sin nombres, y se puede quitar", async ({ page, go, press }) => {
    await go("/");
    await poner(page, "acl_local_selecciones", [seleccion()]);
    await go("/mi-espacio");
    await expect(page.locator(".empty-state")).toContainText("Todavía no hay nada aquí");

    await go(`/seleccion/${TOKEN}`);
    await expect(page.locator(".public-selection__item").first()).toBeVisible();

    await go("/mi-espacio");
    const bloque = page.getByRole("region", { name: "Listas de mi asesor" });
    await expect(bloque).toContainText("Propiedades para Luis");
    await expect(bloque).toContainText("3 propiedades");
    await expect(bloque.getByRole("link", { name: "Propiedades para Luis" })).toHaveAttribute("href", `/seleccion/${TOKEN}`);
    await expect(page.getByRole("region", { name: "Mis favoritos" })).toContainText("0 propiedades");

    // Solo el enlace y un título corto en el dispositivo.
    const guardado = await page.evaluate(() => localStorage.getItem("acl_my_space"));
    expect(guardado).toContain(TOKEN);
    expect(guardado).not.toContain("Las que mejor van contigo");

    await press(bloque.getByRole("button", { name: /Quitar «Propiedades para Luis»/ }));
    await expect(page.locator(".empty-state")).toContainText("Todavía no hay nada aquí");
  });

  test("la vista previa del asesor no cuenta como «abierta» por el cliente", async ({ page, go }) => {
    await go("/");
    await poner(page, "acl_local_selecciones", [seleccion()]);
    await go(`/seleccion/${TOKEN}?vista=asesor`);
    await expect(page.locator(".public-selection__item").first()).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("acl_my_space"))).toBeNull();
  });

  test("un enlace inválido no se anota", async ({ page, go }) => {
    await go(`/seleccion/${"d".repeat(32)}`);
    await expect(page.locator(".public-report__notice")).toBeVisible();
    await go("/mi-espacio");
    await expect(page.locator(".empty-state")).toBeVisible();
  });

  test("tiene su enlace en el pie del sitio", async ({ page, go, press }) => {
    await go("/");
    await press(page.locator(".site-footer").getByRole("link", { name: "Mi espacio" }));
    await page.waitForURL("**/mi-espacio");
  });
});

test.describe("Reacciones en la selección", () => {
  test.beforeEach(async ({ page, go }) => {
    await go("/");
    await poner(page, "acl_local_selecciones", [seleccion()]);
  });

  test("me gusta y comentario: se guardan, sobreviven a recargar y se pueden quitar", async ({ page, go, press }) => {
    await go(`/seleccion/${TOKEN}`);
    const primera = item(page, 0);
    const gusta = primera.getByRole("button", { name: /Me gusta/ });
    const noGusta = primera.getByRole("button", { name: /No es para mí/ });
    await expect(gusta).toHaveAttribute("aria-pressed", "false");

    await press(gusta);
    await expect(gusta).toHaveAttribute("aria-pressed", "true");
    await press(noGusta);
    await expect(noGusta).toHaveAttribute("aria-pressed", "true");
    await expect(gusta, "cambiar de opinión quita la anterior").toHaveAttribute("aria-pressed", "false");
    await press(noGusta);
    await expect(noGusta, "tocar otra vez la quita").toHaveAttribute("aria-pressed", "false");

    await press(gusta);
    await press(primera.getByRole("button", { name: "Agregar comentario" }));
    await primera.getByRole("textbox").fill("  Me encanta el jardín  ");
    await press(primera.getByRole("button", { name: "Guardar comentario" }));
    await expect(primera).toContainText("Listo, tu asesor lo verá.");

    await page.reload();
    await expect(item(page, 0).getByRole("button", { name: /Me gusta/ })).toHaveAttribute("aria-pressed", "true");
    await expect(item(page, 0).getByRole("textbox")).toHaveValue("Me encanta el jardín");
    await expect(item(page, 1).getByRole("button", { name: /Me gusta/ }), "las otras propiedades no cambian").toHaveAttribute("aria-pressed", "false");

    const [guardada] = await page.evaluate(() => JSON.parse(localStorage.getItem("acl_local_selecciones")));
    expect(guardada.reactions["prop-1"]).toMatchObject({ r: "like", c: "Me encanta el jardín" });
  });

  test("el comentario no pasa de 300 caracteres", async ({ page, go, press }) => {
    await go(`/seleccion/${TOKEN}`);
    await press(item(page, 0).getByRole("button", { name: "Agregar comentario" }));
    await item(page, 0).getByRole("textbox").fill("x".repeat(400));
    await expect(item(page, 0).getByRole("textbox")).toHaveValue("x".repeat(300));
  });

  test("el asesor que previsualiza no deja reacciones", async ({ page, go, press }) => {
    await go(`/seleccion/${TOKEN}?vista=asesor`);
    await press(item(page, 0).getByRole("button", { name: /Me gusta/ }));
    await page.reload();
    await expect(item(page, 0).getByRole("button", { name: /Me gusta/ })).toHaveAttribute("aria-pressed", "false");
    const [guardada] = await page.evaluate(() => JSON.parse(localStorage.getItem("acl_local_selecciones")));
    expect(guardada.reactions).toEqual({});
  });

  test("el asesor ve el resumen y las respuestas en la ficha del prospecto", async ({ page, go, press, seedAdminSession }) => {
    await seedAdminSession();
    const prospecto = {
      id: "sel-react",
      name: "Reacciones QA",
      phone: "8715550101",
      email: null,
      source: "manual",
      stage: "contactado",
      advisor_id: "advisor-1",
      property_id: null,
      looking_for: null,
      notes: null,
      last_contact_at: null,
      next_followup_at: null,
      lost_reason: null,
      created_at: ahora(),
      updated_at: ahora(),
    };
    await poner(page, "acl_local_prospectos", [prospecto]);
    await poner(page, "acl_local_selecciones", [
      seleccion({
        prospecto_id: prospecto.id,
        reactions: {
          "prop-1": { r: "like", c: "Bonita", at: ahora() },
          "prop-2": { r: "dislike", c: null, at: ahora() },
          "prop-4": { r: null, c: "¿Cuánto es de enganche?", at: ahora() },
        },
      }),
    ]);
    await go(`/admin/prospectos/${prospecto.id}`);
    const lista = page.getByRole("region", { name: "Selecciones enviadas" });
    const resumen = lista.locator(".selection-feedback summary");
    await expect(resumen).toContainText("👍 1 · 👎 1 · 💬 2");
    await press(resumen);
    await expect(lista.locator(".selection-feedback li")).toHaveCount(3);
    await expect(lista.locator(".selection-feedback")).toContainText("Casa en Residencial Senderos");
    await expect(lista.locator(".selection-feedback")).toContainText("“Bonita”");
    await expect(lista.locator(".selection-feedback")).toContainText("“¿Cuánto es de enganche?”");
  });
});

test.describe("«Visítala mañana» en las tarjetas", () => {
  test("sale en las propiedades con horario libre pronto y no en las demás", async ({ page, go }) => {
    await page.addInitScript(
      (horario) => localStorage.setItem("acl_local_visit_schedules", JSON.stringify(horario)),
      {
        "advisor-1": {
          settings: { enabled: true, slot_minutes: 60, min_notice_hours: 0, horizon_days: 14 },
          weekly: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, start_time: "09:00", end_time: "20:00" })),
          timeOff: [],
        },
      },
    );
    await go("/propiedades");
    await expect(page.locator(".property-card").first()).toBeVisible();
    const etiquetas = page.locator(".property-card__visit");
    await expect(etiquetas.first()).toBeVisible();
    await expect(etiquetas.first()).toContainText(/Visítala (hoy|mañana)/);
    const total = await page.locator(".property-card").count();
    expect(await etiquetas.count(), "no todas las propiedades tienen asesor con horario").toBeLessThan(total);
    // La apartada nunca la lleva.
    const apartada = page.locator(".property-card", { has: page.locator('a[href$="-ACL-1003"]') });
    await expect(apartada.locator(".property-card__visit")).toHaveCount(0);
  });

  test("sin horario de ningún asesor no sale ninguna etiqueta", async ({ page, go }) => {
    await go("/propiedades");
    await expect(page.locator(".property-card").first()).toBeVisible();
    await expect(page.locator(".property-card__visit")).toHaveCount(0);
  });
});

test.describe("Interés en línea en el informe del vendedor", () => {
  test("las vistas, los favoritos y las veces compartida llegan al informe", async ({ page, go, press, seedAdminSession }) => {
    await go("/propiedades/prop-1"); // registra la vista
    const barra = page.locator(".property-detail__price-block-top");
    await press(barra.locator(".favorite-button"));
    const menu = barra.locator("details.share-button");
    if (await menu.count()) {
      await press(menu.locator("summary"));
      await press(menu.getByRole("button", { name: /Copiar texto/ }));
    } else {
      await press(barra.getByRole("button", { name: "Compartir" }));
    }
    await page.waitForFunction(() => (JSON.parse(localStorage.getItem("acl_local_property_events") || "[]")).length >= 2);

    await seedAdminSession();
    await go("/admin/visitas/propiedad/prop-1");
    const bloque = page.locator("section.vr-card", { has: page.locator("#vr-online-title") });
    await expect(bloque).toContainText("Interés en línea");
    const valor = (etiqueta) => bloque.locator(".vr-tile", { hasText: etiqueta }).locator(".vr-tile__value");
    await expect(valor("Personas que vieron la ficha")).toHaveText("1");
    await expect(valor("La guardaron en favoritos")).toHaveText("1");
    await expect(valor("Veces compartida")).toHaveText("1");
  });
});

test.describe("Aviso por correo del trámite", () => {
  test("el asesor lo activa en el trámite del cliente; avisa si no tiene correo", async ({ page, go, press, seedAdminSession }) => {
    await seedAdminSession();
    const nombre = `Cliente Avisos ${Date.now() % 100000}`;
    await go("/admin/clientes/nuevo");
    await page.fill("#c-name", nombre);
    await page.selectOption("#c-type", "comprador");
    await page.fill("#c-phone", "8715550101");
    await press(page.locator("form button[type=submit]").first());
    await page.waitForURL("**/admin/clientes");
    const id = await page.evaluate((n) => JSON.parse(localStorage.getItem("acl_local_clients") || "[]").find((c) => c.name === n)?.id, nombre);

    await go(`/admin/clientes/${id}/documentos`);
    const panel = page.locator(".admin-portal-tramite");
    const aviso = panel.getByLabel("Avisar por correo al cliente");
    await expect(aviso).not.toBeChecked();
    await press(aviso);
    await expect(panel).toContainText("no tiene correo");

    await press(panel.getByRole("button", { name: "Guardar" }));
    await expect(panel.getByRole("status")).toContainText("Guardado");
    const [tramite] = await page.evaluate((cid) => JSON.parse(localStorage.getItem("acl_local_client_tramites") || "[]").filter((t) => t.client_id === cid), id);
    expect(tramite.notify_client).toBe(true);

    // Al volver a abrirlo sigue activado; guardar sin tocarlo no lo cambia.
    await go(`/admin/clientes/${id}/documentos`);
    await expect(page.locator(".admin-portal-tramite").getByLabel("Avisar por correo al cliente")).toBeChecked();
    await press(page.locator(".admin-portal-tramite").getByRole("button", { name: "Guardar" }));
    await expect(page.locator(".admin-portal-tramite").getByRole("status")).toContainText("Guardado");
    const [despues] = await page.evaluate((cid) => JSON.parse(localStorage.getItem("acl_local_client_tramites") || "[]").filter((t) => t.client_id === cid), id);
    expect(despues.notify_client).toBe(true);
  });
});
