import { test, expect, isoDate, abrirMas } from "./fixtures.js";

// Mejoras 31–40: propiedades nuevas para prospectos, ofertas y apartados, agenda por semana/día, calendario suscribible,
// ruta de hoy, dictado por voz, duplicar propiedad, edición en lote (precio y asesor) y ficha completa.
// Modo demo: la «base» es el localStorage de la prueba.

const ahora = () => new Date().toISOString();
const poner = (page, clave, valor) => page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [clave, valor]);
const leer = (page, clave) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "[]"), clave);

const prospecto = (id, name, extra = {}) => ({
  id,
  name,
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
  ...extra,
});

const cita = (id, hora, extra = {}) => ({
  id,
  advisor_id: "advisor-1",
  client_id: null,
  property_id: null,
  titulo: `Cita ${id}`,
  fecha: isoDate(0),
  hora,
  duracion_min: 30,
  lugar: null,
  status: "confirmada",
  created_at: ahora(),
  ...extra,
});

const filaProp = (page, titulo) => page.locator(".admin-table tbody tr.admin-row", { hasText: titulo }).first();
const SENDEROS = "Casa en Residencial Senderos";

test.describe("Mi día: propiedades nuevas, ruta de hoy y apartados", () => {
  test.beforeEach(async ({ seedAdminSession }) => {
    await seedAdminSession();
  });

  test("una propiedad nueva que encaja con un prospecto sale en Mi día, y «Ocultar» la quita para siempre", async ({ page, go, press }) => {
    await go("/admin/mi-dia");
    await poner(page, "acl_local_prospectos", [prospecto("pn1", "Busca Casa QA", { search_criteria: { type: "casa" } })]);
    await poner(page, "acl_local_properties", [
      {
        id: "prop-nueva-qa",
        code: "ACL-9001",
        title: "Casa Nueva QA",
        type: "casa",
        operation_type: "compra",
        status: "disponible",
        active: true,
        price: 1500000,
        area_m2: 120,
        zone: "Torreón",
        address: "Calle QA 1",
        lat: 25.54,
        lng: -103.4,
        advisor_ids: [],
        images: [],
        created_at: ahora(),
      },
    ]);
    await go("/admin/mi-dia");
    const panel = page.locator("section", { has: page.getByRole("heading", { name: /Propiedades nuevas para tus prospectos/ }) });
    await expect(panel).toContainText("Busca Casa QA");
    await expect(panel).toContainText("Casa Nueva QA");
    // «Avisarle» arma el mensaje (no lo manda solo): es un enlace de WhatsApp.
    await expect(panel.getByRole("link", { name: "Avisarle" })).toHaveAttribute("href", /wa\.me/);

    await press(panel.getByRole("button", { name: "Ocultar" }));
    await expect(page.getByRole("heading", { name: /Propiedades nuevas para tus prospectos/ })).toHaveCount(0);
    await go("/admin/mi-dia");
    await expect(page.getByRole("heading", { name: /Mi día/ }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: /Propiedades nuevas para tus prospectos/ })).toHaveCount(0);
  });

  test("la ruta de hoy ordena las visitas que faltan y arma un solo enlace de Google Maps con todas las paradas", async ({ page, go }) => {
    await go("/admin/mi-dia");
    // Tarde en el día, para que no hayan «pasado» cuando corre la prueba.
    await poner(page, "acl_local_agenda_citas", [
      cita("r2", "23:40", { lugar: "Calle Segunda 200, Torreón", titulo: "Segunda parada" }),
      cita("r1", "23:30", { lugar: "Calle Primera 100, Torreón", titulo: "Primera parada" }),
      cita("r3", "23:50", { lugar: null, titulo: "Sin lugar" }),
    ]);
    await go("/admin/mi-dia");
    const ahoraMx = new Date();
    test.skip(ahoraMx.getHours() === 23 && ahoraMx.getMinutes() >= 30, "demasiado tarde para citas de las 23:30");
    const tarjeta = page.locator("section", { has: page.getByRole("heading", { name: /Ruta de hoy/ }) });
    await expect(tarjeta.locator("ol li")).toHaveCount(2);
    await expect(tarjeta.locator("ol li").first()).toContainText("Calle Primera 100");
    await expect(tarjeta).toContainText("1 visita de hoy no tiene una dirección");
    const href = await tarjeta.getByRole("link", { name: "Abrir ruta en Google Maps" }).getAttribute("href");
    const url = new URL(href);
    expect(url.hostname).toBe("www.google.com");
    expect(url.searchParams.get("destination")).toBe("Calle Segunda 200, Torreón");
    expect(url.searchParams.get("waypoints")).toBe("Calle Primera 100, Torreón");
  });

  test("un apartado por vencer avisa en Mi día", async ({ page, go }) => {
    await go("/admin/mi-dia");
    await poner(page, "acl_local_property_holds", [
      { id: "h1", property_id: "prop-1", advisor_id: null, buyer_name: "Comprador QA", buyer_phone: null, amount: 15000, due_date: isoDate(2), note: null, status: "vigente", created_at: ahora() },
      { id: "h2", property_id: "prop-2", advisor_id: null, buyer_name: "Lejano QA", buyer_phone: null, amount: 1, due_date: isoDate(30), note: null, status: "vigente", created_at: ahora() },
    ]);
    await go("/admin/mi-dia");
    const panel = page.locator("section", { has: page.getByRole("heading", { name: /Apartados por vencer/ }) });
    await expect(panel).toContainText("Comprador QA");
    await expect(panel).toContainText("Vence en 2 días");
    await expect(panel).not.toContainText("Lejano QA");
  });
});

test.describe("Propiedades: ofertas, apartado, duplicar, lote y ficha completa", () => {
  test.beforeEach(async ({ seedAdminSession }) => {
    await seedAdminSession();
  });

  test("registra ofertas y un apartado: la propiedad queda «apartada», no admite un segundo y al cancelar regresa a «disponible»", async ({ page, go, press }) => {
    await go("/admin/propiedades");
    const fila = filaProp(page, SENDEROS);
    await expect(fila).toBeVisible();
    await abrirMas(fila, press);
    await press(fila.getByRole("button", { name: "Ofertas y apartado" }));
    const modal = page.getByRole("dialog", { name: "Ofertas y apartado" });

    // Oferta del cliente y contraoferta del propietario.
    await modal.getByLabel("Comprador").fill("Luis Oferta");
    await modal.getByLabel("Monto", { exact: true }).fill("2300000");
    await press(modal.getByRole("button", { name: "Agregar oferta" }));
    await expect(modal).toContainText("Mejor oferta abierta del cliente");
    await expect(modal).toContainText("6.1 % por debajo de la lista");
    await modal.getByLabel("De", { exact: true }).selectOption("propietario");
    await modal.getByLabel("Comprador").fill("Luis Oferta");
    await modal.getByLabel("Monto", { exact: true }).fill("2400000");
    await press(modal.getByRole("button", { name: "Agregar oferta" }));
    await expect(modal.locator(".offers-modal__list li")).toHaveCount(2);
    expect((await leer(page, "acl_local_property_offers")).map((o) => o.party).sort()).toEqual(["cliente", "propietario"]);

    // Un monto en cero no pasa.
    await modal.getByLabel("Comprador").fill("Cero");
    await modal.getByLabel("Monto", { exact: true }).fill("0");
    await press(modal.getByRole("button", { name: "Agregar oferta" }));
    await expect(modal.getByRole("alert")).toContainText("mayor que cero");

    // Apartado.
    await modal.getByLabel("Quién aparta").fill("Ana Apartado");
    await modal.getByLabel("Monto del apartado").fill("20000");
    await modal.getByLabel("Fecha límite").fill(isoDate(10));
    await press(modal.getByRole("button", { name: "Registrar apartado" }));
    await expect(modal).toContainText("Ana Apartado");
    await expect(modal.getByRole("button", { name: "Se concretó" })).toBeVisible();
    await expect(modal.getByLabel("Quién aparta")).toHaveCount(0); // ya hay uno vigente: no se ofrece otro
    expect((await leer(page, "acl_local_properties")).find((p) => p.id === "prop-1").status).toBe("apartada");

    await press(modal.getByRole("button", { name: "Cancelar apartado" }));
    await expect(modal.getByLabel("Quién aparta")).toBeVisible();
    expect((await leer(page, "acl_local_properties")).find((p) => p.id === "prop-1").status).toBe("disponible");
    const holds = await leer(page, "acl_local_property_holds");
    expect(holds).toHaveLength(1);
    expect(holds[0].status).toBe("cancelado");
  });

  test("duplicar abre el formulario con los datos de la propiedad, sin fotos, inactiva y avisándolo", async ({ page, go, press }) => {
    await go("/admin/propiedades");
    const fila = filaProp(page, SENDEROS);
    await abrirMas(fila, press);
    await press(fila.getByRole("link", { name: "Duplicar" }));
    await page.waitForURL("**/nueva?duplicar=*");
    await expect(page.getByRole("status").filter({ hasText: "Estás creando una copia" })).toContainText(SENDEROS);
    await expect(page.locator("#p-title")).toHaveValue(`${SENDEROS} (copia)`);
    await expect(page.locator("#p-price")).toHaveValue("2450000");
    await expect(page.getByRole("checkbox", { name: /^Activ/ })).not.toBeChecked();

    // Al guardar nace una propiedad NUEVA e inactiva, sin las fotos de la original; la original queda igual.
    await press(page.getByRole("button", { name: "Guardar", exact: true }));
    await page.waitForURL("**/admin/propiedades");
    const todas = await leer(page, "acl_local_properties");
    const copia = todas.find((p) => p.title === `${SENDEROS} (copia)`);
    expect(copia).toBeTruthy();
    expect(copia.id).not.toBe("prop-1");
    expect(copia.active).toBe(false);
    expect(copia.price).toBe(2450000);
    expect(copia.images || []).toEqual([]);
    expect(todas.find((p) => p.id === "prop-1").images.length).toBeGreaterThan(0);
  });

  test("edición en lote: baja el precio un porcentaje y agrega un asesor sin quitar a los que ya tiene", async ({ page, go, press }) => {
    await go("/admin/propiedades");
    const filas = page.locator(".admin-table tbody tr.admin-row");
    await expect(filas.first()).toBeVisible();
    await press(filaProp(page, SENDEROS).getByLabel("Seleccionar fila"));
    const barra = page.locator(".bulk-actions-bar");
    await expect(barra).toContainText("1 seleccionado");

    await barra.getByLabel("Cambio de precio").selectOption("percentDown");
    await barra.getByLabel("Cantidad").fill("10");
    await press(barra.getByRole("button", { name: "Cambiar precio" }));
    await expect.poll(async () => (await leer(page, "acl_local_properties")).find((p) => p.id === "prop-1")?.price).toBe(2205000);

    await go("/admin/propiedades");
    await press(filaProp(page, SENDEROS).getByLabel("Seleccionar fila"));
    const original = (await leer(page, "acl_local_properties")).find((p) => p.id === "prop-1").advisor_ids || [];
    await page.locator(".bulk-actions-bar").getByLabel("Asesor", { exact: true }).selectOption({ label: "Ana Martínez" });
    await press(page.locator(".bulk-actions-bar").getByRole("button", { name: "Agregar asesor" }));
    await expect
      .poll(async () => (await leer(page, "acl_local_properties")).find((p) => p.id === "prop-1").advisor_ids)
      .toEqual(expect.arrayContaining([...original, "advisor-2"]));
  });

  test("un porcentaje fuera de rango no cambia ningún precio", async ({ page, go, press }) => {
    await go("/admin/propiedades");
    await press(filaProp(page, SENDEROS).getByLabel("Seleccionar fila"));
    const barra = page.locator(".bulk-actions-bar");
    await barra.getByLabel("Cantidad").fill("80");
    let aviso = "";
    page.removeAllListeners("dialog");
    page.on("dialog", (d) => {
      aviso = d.message();
      d.accept();
    });
    await press(barra.getByRole("button", { name: "Cambiar precio" }));
    await expect.poll(() => aviso).toContain("50 %");
    expect((await leer(page, "acl_local_properties")).find((p) => p.id === "prop-1").price).toBe(2450000);
  });

  test("cada propiedad muestra qué tan completa está su ficha y se pueden ver solo las incompletas", async ({ page, go, press }) => {
    await go("/admin/propiedades");
    const filas = page.locator(".admin-table tbody tr.admin-row");
    const total = await filas.count();
    await expect(page.locator(".property-completeness").first()).toContainText(/Ficha \d+ %/);
    await expect(page.locator(".property-completeness")).toHaveCount(total);

    // Una propiedad vacía sale incompleta y dice qué le falta.
    await poner(page, "acl_local_properties", [
      { id: "vacia", code: "ACL-0", title: "Ficha Vacía QA", type: "casa", operation_type: "compra", status: "disponible", active: true, price: 1000000, area_m2: 100, zone: "Torreón", images: [], created_at: ahora() },
    ]);
    await go("/admin/propiedades");
    const fila = filaProp(page, "Ficha Vacía QA");
    await expect(fila.locator(".property-completeness")).toContainText("Falta: fotos (mínimo 5)");
    if (await page.locator(".admin-filters__toggle").isVisible()) await press(page.locator(".admin-filters__toggle"));
    await page.getByLabel("Solo fichas incompletas").check();
    await expect(fila).toBeVisible();
  });
});

test.describe("Dictado por voz", () => {
  test.beforeEach(async ({ seedAdminSession }) => {
    await seedAdminSession();
  });

  const falsoReconocimiento = (page) =>
    page.addInitScript(() => {
      window.SpeechRecognition = class {
        start() {
          window.__dictado = { lang: this.lang, started: true };
          setTimeout(() => {
            const r = Object.assign([{ transcript: "no contestó, llamar mañana" }], { isFinal: true });
            this.onresult?.({ resultIndex: 0, results: [r] });
          }, 50);
        }
        stop() {
          this.onend?.();
        }
        abort() {}
      };
    });

  test("dicta la nota de un contacto (solo al pulsar el micrófono) y queda escrita para revisarla", async ({ page, go, press }) => {
    await falsoReconocimiento(page);
    await go("/admin/prospectos");
    await poner(page, "acl_local_prospectos", [prospecto("dic1", "Dictado QA")]);
    await go("/admin/prospectos/dic1");
    expect(await page.evaluate(() => window.__dictado)).toBeUndefined(); // nunca arranca solo
    const ficha = page.locator(".prospect-profile");
    await press(ficha.getByRole("button", { name: "Registrar contacto" }));
    const nota = ficha.getByLabel("Nota (opcional)");
    await nota.fill("Llamé:");
    await press(ficha.locator("form.contact-form").getByRole("button", { name: /Dictar/ }));
    await expect(nota).toHaveValue("Llamé: no contestó, llamar mañana");
    expect(await page.evaluate(() => window.__dictado)).toMatchObject({ lang: "es-MX", started: true });
  });

  test("sin reconocimiento de voz en el navegador no se muestra el botón", async ({ page, go, press }) => {
    // Chromium ya trae reconocimiento de voz: se quita para simular un navegador que no lo tiene (p. ej. Firefox).
    await page.addInitScript(() => {
      delete window.SpeechRecognition;
      delete window.webkitSpeechRecognition;
    });
    await go("/admin/prospectos");
    await poner(page, "acl_local_prospectos", [prospecto("dic2", "Sin Voz QA")]);
    await go("/admin/prospectos/dic2");
    const ficha = page.locator(".prospect-profile");
    await press(ficha.getByRole("button", { name: "Registrar contacto" }));
    await expect(ficha.getByLabel("Nota (opcional)")).toBeVisible();
    await expect(ficha.getByRole("button", { name: /Dictar/ })).toHaveCount(0);
  });
});

test.describe("Agenda: semana, día y calendario suscribible", () => {
  test.beforeEach(async ({ seedAdminSession }) => {
    await seedAdminSession();
  });

  test("la semana pone cada cita en su hora, las que se traslapan quedan lado a lado y se puede pasar al día y a otra semana", async ({ page, go, press }) => {
    await go("/admin/agenda");
    await poner(page, "acl_local_agenda_citas", [
      cita("w1", "10:00", { titulo: "Visita Uno", duracion_min: 60 }),
      cita("w2", "10:30", { titulo: "Visita Dos", duracion_min: 60 }),
      cita("w3", null, { titulo: "Todo el día QA" }),
      cita("w4", "09:00", { titulo: "Semana Próxima", fecha: isoDate(7) }),
    ]);
    await go("/admin/agenda?vista=semana");
    const grid = page.locator(".agenda-grid");
    await expect(grid).toBeVisible();
    const uno = grid.getByRole("link", { name: /Visita Uno/ });
    const dos = grid.getByRole("link", { name: /Visita Dos/ });
    await expect(uno).toBeVisible();
    const a = await uno.boundingBox();
    const b = await dos.boundingBox();
    expect(Math.abs(a.y - b.y)).toBeGreaterThan(10); // 10:00 y 10:30: distinta altura
    expect(Math.abs(a.x - b.x)).toBeGreaterThan(10); // traslapadas: lado a lado
    await expect(grid.getByRole("link", { name: /Todo el día QA/ })).toBeVisible();
    // La semana no desborda la página (la cuadrícula se desliza dentro de su caja).
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);

    await press(page.getByRole("button", { name: "Día", exact: true }));
    await expect(page).toHaveURL(/vista=dia/);
    await expect(page.locator(".agenda-grid__col")).toHaveCount(1);
    await expect(page.locator(".agenda-grid").getByRole("link", { name: /Visita Dos/ })).toBeVisible();

    await press(page.getByRole("button", { name: "Semana", exact: true }));
    await press(page.getByRole("button", { name: "Semana siguiente" }));
    await expect(page.locator(".agenda-grid").getByRole("link", { name: /Semana Próxima/ })).toBeVisible();
    await expect(page.locator(".agenda-grid").getByRole("link", { name: /Visita Uno/ })).toHaveCount(0);
    await press(page.getByRole("button", { name: "Hoy", exact: true }));
    await expect(page.locator(".agenda-grid").getByRole("link", { name: /Visita Uno/ })).toBeVisible();
  });

  test("el calendario suscribible explica que es de un solo sentido y en modo demo avisa que no está disponible", async ({ page, go, press }) => {
    await go("/admin/agenda");
    await press(page.getByRole("button", { name: /Ver mi Agenda en Google, Apple u Outlook/ }));
    await expect(page.getByText("lo que cambies en el calendario externo NO llega al sitio")).toBeVisible();
    await press(page.getByRole("button", { name: "Crear mi dirección" }));
    await expect(page.getByRole("alert").filter({ hasText: "modo demo" })).toBeVisible();
  });
});
