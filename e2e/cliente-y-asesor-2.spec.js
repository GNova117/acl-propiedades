import { test, expect, isoDate } from "./fixtures.js";

// Mejoras 21–30: chat que pasa a un asesor, encuesta tras la visita, vendidas recientes con sus días, simulador de crédito,
// estimado al instante en «Vende tu casa», y del lado del asesor: arrastrar prospectos entre etapas, asignación automática,
// calificación (caliente/tibio/frío) y secuencia de seguimiento sugerida. Modo demo: la «base» es el localStorage de la prueba.

const ahora = () => new Date().toISOString();
const poner = (page, clave, valor) => page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [clave, valor]);
const leer = (page, clave) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "[]"), clave);

const prospecto = (id, name, extra = {}) => ({
  id,
  name,
  phone: "8715550101",
  email: null,
  source: "manual",
  stage: "nuevo",
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

test.describe("Chat: pasar a un asesor", () => {
  test("cuando el chat pasa la conversación a un asesor, el botón de WhatsApp sale resaltado en ese mensaje", async ({ page, go, press }) => {
    await page.route("**/api/chat", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ configured: true, reply: "Claro, un asesor te escribe en breve.", leadCaptured: true, handoff: true, visitBooked: false }),
      }),
    );
    await go("/");
    await press(page.locator(".chat-widget__toggle"));
    await page.locator(".chat-widget__form input").fill("Quiero hablar con una persona");
    await press(page.locator(".chat-widget__form button[type=submit]"));
    const respuesta = page.locator(".chat-widget__bubble--assistant", { hasText: "un asesor te escribe" });
    await expect(respuesta).toBeVisible();
    const boton = respuesta.locator("a.chat-widget__fallback-btn");
    await expect(boton).toBeVisible();
    // El mensaje de WhatsApp lleva lo que ya se platicó.
    expect(decodeURIComponent(await boton.getAttribute("href"))).toContain("Quiero hablar con una persona");
  });

  test("una respuesta normal no trae el botón resaltado", async ({ page, go, press }) => {
    await page.route("**/api/chat", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ configured: true, reply: "Tenemos varias casas en Torreón.", leadCaptured: false, handoff: false, visitBooked: false }) }),
    );
    await go("/");
    await press(page.locator(".chat-widget__toggle"));
    await page.locator(".chat-widget__form input").fill("¿Qué casas tienen?");
    await press(page.locator(".chat-widget__form button[type=submit]"));
    const respuesta = page.locator(".chat-widget__bubble--assistant", { hasText: "Tenemos varias casas" });
    await expect(respuesta).toBeVisible();
    await expect(respuesta.locator("a.chat-widget__fallback-btn")).toHaveCount(0);
  });
});

test.describe("Encuesta tras la visita", () => {
  const TOKEN = "d".repeat(32);
  const cita = (extra = {}) => ({
    id: "cita-opinion",
    advisor_id: "advisor-1",
    property_id: "prop-1",
    titulo: "Visita QA",
    fecha: isoDate(0),
    hora: "10:00",
    status: "realizada",
    source: "sitio",
    contact_name: "Carla Opinión",
    contact_email: "carla@correo.com",
    booking_token: TOKEN,
    created_at: ahora(),
    ...extra,
  });

  test("califica con estrellas, deja un comentario, no se puede responder dos veces y el asesor lo ve en la Agenda", async ({ page, go, press, seedAdminSession }) => {
    await go("/");
    await poner(page, "acl_local_agenda_citas", [cita()]);

    await go(`/opinion/${TOKEN}`);
    await expect(page.getByRole("heading", { name: "¿Cómo te fue en tu visita?" })).toBeVisible();
    await expect(page.locator(".public-survey__property")).toContainText("Casa en Residencial Senderos");

    // Sin calificación no se envía.
    await press(page.getByRole("button", { name: "Enviar mi opinión" }));
    await expect(page.getByRole("alert")).toContainText("Elige de 1 a 5 estrellas");

    await press(page.getByRole("radio", { name: "4 estrellas" }));
    await expect(page.getByRole("radio", { name: "4 estrellas" })).toHaveAttribute("aria-checked", "true");
    await expect(page.locator(".public-survey__word")).toHaveText("Buena");
    await press(page.getByRole("radio", { name: "5 estrellas" }));
    await page.locator("#survey-comment").fill("  Muy buena atención  ");
    await press(page.getByRole("button", { name: "Enviar mi opinión" }));

    await expect(page.getByRole("heading", { name: "¡Gracias por tu opinión!" })).toBeVisible();
    // Sin enlace de reseña de Google configurado no se invita a Google (no hay a dónde mandarla).
    await expect(page.getByRole("link", { name: /Google/ })).toHaveCount(0);
    await expect(page.locator("main")).not.toContainText("Muy buena atención");

    await go(`/opinion/${TOKEN}`);
    await expect(page.getByRole("heading", { name: "¡Ya recibimos tu opinión!" })).toBeVisible();

    const [guardada] = await leer(page, "acl_local_visit_feedback");
    expect(guardada).toMatchObject({ cita_id: "cita-opinion", rating: 5, comment: "Muy buena atención", advisor_id: "advisor-1" });

    await seedAdminSession();
    await go("/admin/agenda?vista=lista");
    const fila = page.locator("tr", { hasText: "Visita QA" }).first();
    await expect(fila.locator(".agenda-feedback")).toContainText("“Muy buena atención”");
    await expect(fila.locator(".agenda-feedback [aria-label]").first()).toHaveAttribute("aria-label", "5 de 5 estrellas");
  });

  test("una visita que todavía no está «realizada» no abre la encuesta", async ({ page, go }) => {
    await go("/");
    await poner(page, "acl_local_agenda_citas", [cita({ status: "confirmada" })]);
    await go(`/opinion/${TOKEN}`);
    await expect(page.getByRole("heading", { name: "Todavía no está disponible" })).toBeVisible();
    await expect(page.locator("#survey-comment")).toHaveCount(0);
  });

  test("un enlace inventado dice que no es válido", async ({ page, go }) => {
    await go(`/opinion/${"0".repeat(32)}`);
    await expect(page.getByRole("heading", { name: "Enlace no válido" })).toBeVisible();
  });

  test("el comentario no pasa de 500 caracteres", async ({ page, go }) => {
    await go("/");
    await poner(page, "acl_local_agenda_citas", [cita()]);
    await go(`/opinion/${TOKEN}`);
    await page.locator("#survey-comment").fill("x".repeat(700));
    await expect(page.locator("#survey-comment")).toHaveValue("x".repeat(500));
  });
});

test.describe("Vendidas recientemente: cuántos días tardó cada venta", () => {
  test("la galería de vendidas dice «Vendida en N días» y no inventa «0 días»", async ({ page, go }) => {
    await go("/");
    await page.evaluate(() => {
      const hace = (dias) => new Date(Date.now() - dias * 864e5).toISOString();
      const props = JSON.parse(localStorage.getItem("acl_local_properties"));
      const vendidas = ["prop-2", "prop-3", "prop-5", "prop-6"];
      for (const p of props) {
        if (vendidas.includes(p.id)) Object.assign(p, { status: "vendida", active: true, created_at: hace(100) });
      }
      localStorage.setItem("acl_local_properties", JSON.stringify(props));
      // prop-2 se vendió a los 60 días; prop-3 a los 25; prop-5 el mismo día de darse de alta (dato dudoso); prop-6 hace 5 días, a los 95.
      const fecha = (dias) => hace(dias).slice(0, 10);
      localStorage.setItem(
        "acl_local_ventas",
        JSON.stringify([
          { id: "v2", property_id: "prop-2", advisor_id: "advisor-1", fecha_venta: fecha(40), created_at: hace(40) },
          { id: "v3", property_id: "prop-3", advisor_id: "advisor-1", fecha_venta: fecha(75), created_at: hace(75) },
          { id: "v5", property_id: "prop-5", advisor_id: "advisor-1", fecha_venta: fecha(100), created_at: hace(100) },
          { id: "v6", property_id: "prop-6", advisor_id: "advisor-1", fecha_venta: fecha(5), created_at: hace(5) },
        ]),
      );
    });
    await page.reload();
    const seccion = page.locator(".trust-stats__recent");
    await expect(seccion).toBeVisible();
    const tarjetas = seccion.locator(".property-card");
    await expect(tarjetas).toHaveCount(3); // las 3 más recientes: prop-6, prop-2, prop-3
    await expect(tarjetas.nth(0)).toContainText("Vendida en 95 días");
    await expect(tarjetas.nth(1)).toContainText("Vendida en 60 días");
    await expect(tarjetas.nth(2)).toContainText("Vendida en 25 días");
    await expect(seccion.locator(".property-card__sold-days")).toHaveCount(3);
    await expect(seccion).not.toContainText("Vendida en 0");
  });
});

test.describe("Simulador de crédito público", () => {
  test("está en el pie, calcula al cambiar los datos y deja el contacto", async ({ page, go, press }) => {
    await go("/");
    await press(page.locator(".site-footer").getByRole("link", { name: "Simulador de crédito" }));
    await page.waitForURL("**/simulador-credito");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Simulador de crédito Infonavit");

    const resultado = page.locator(".card", { hasText: "Plazo" }).first();
    await expect(resultado).toBeVisible();
    const antes = await page.locator("main").innerText();
    await page.fill("#cs-salario", "30000");
    await expect.poll(() => page.locator("main").innerText()).not.toBe(antes);

    await page.fill("#cs-name", "Simulador QA");
    await page.fill("#cs-phone", "8711234567");
    await press(page.locator("form button[type=submit]").last());
    await expect(page.locator("main")).toContainText(/gracias|recibimos|contactar|enviad/i);
  });

  test("pide nombre y teléfono antes de enviar", async ({ page, go, press }) => {
    await go("/simulador-credito");
    await press(page.locator("form button[type=submit]").last());
    expect(await page.locator("form .form-error").count()).toBeGreaterThanOrEqual(2);
  });
});

test.describe("«Vende tu casa»: estimado al instante", () => {
  test("sin zona o sin metros pide los datos; con ellos da un rango y lo manda con la solicitud", async ({ page, go, press }) => {
    await go("/vende-tu-casa");
    const caja = page.locator(".sell-estimate");
    await expect(caja).toContainText("Elige tu zona");

    await page.selectOption("#sh-zone", { label: "Torreón" });
    await page.fill("#sh-land", "200");
    await expect(caja, "una casa necesita también la construcción").toContainText("Elige tu zona");
    await page.fill("#sh-built", "150");
    // 200 × $2,800 + 150 × $7,000 = $1,610,000 ± 10 %
    await expect(caja).toContainText(/Entre \$1,4\d\d,000 y \$1,7\d\d,000/);
    await expect(caja).toContainText("sin haber visto la propiedad");

    // Un terreno solo necesita el terreno.
    await page.selectOption("#sh-type", "terreno");
    await expect(caja).toContainText(/Entre \$5\d\d,000 y \$6\d\d,000/); // 200 × 2,800 = 560,000
    await page.selectOption("#sh-type", "casa");

    await page.fill("#sh-name", "Vendedor QA");
    await page.fill("#sh-phone", "8711234567");
    await page.fill("#sh-address", "Calle Prueba 123, Torreón");
    await press(page.locator("form button[type=submit]").last());
    await expect(page.locator("main")).toContainText(/gracias|recibimos|contactar|enviad/i);
    await expect(page.locator(".sell-estimate__after")).toContainText(/Tu estimado orientativo: entre \$1,4\d\d,000 y \$1,7\d\d,000/);

    const [mensaje] = (await leer(page, "acl_local_messages")).filter((m) => m.channel === "estimacion");
    expect(mensaje.message).toContain("Estimado orientativo que vio en el sitio");
    expect(mensaje.details.estimado_bajo).toBeGreaterThan(1_400_000);
    expect(mensaje.details.estimado_alto).toBeLessThan(1_800_000);
  });
});

test.describe("Prospectos: arrastrar, calificación y secuencia", () => {
  test.beforeEach(async ({ seedAdminSession }) => {
    await seedAdminSession();
  });

  const columna = (page, etapa) => page.locator(".prospect-col", { has: page.getByRole("heading", { name: etapa }) });
  // En el teléfono el tablero muestra una etapa a la vez: se toca su pestaña. En pantalla ancha no hay pestañas.
  const irAEtapa = async (page, press, etapa) => {
    const pestana = page.locator(".prospect-tabs__tab", { hasText: etapa });
    if (await pestana.isVisible()) await press(pestana);
  };

  test("PC: arrastrar una tarjeta a otra columna cambia su etapa", async ({ page, go, isMobile }) => {
    test.skip(isMobile, "arrastrar es con ratón; en el teléfono la etapa se cambia desde «Más»");
    await go("/admin/prospectos");
    await poner(page, "acl_local_prospectos", [prospecto("d1", "Arrastrable QA")]);
    await go("/admin/prospectos");
    const tarjeta = page.locator(".prospect-card", { hasText: "Arrastrable QA" });
    await expect(tarjeta).toBeVisible();
    await expect(tarjeta).toHaveAttribute("draggable", "true");

    await tarjeta.dragTo(columna(page, "Interesado"));
    await expect(columna(page, "Interesado").locator(".prospect-card", { hasText: "Arrastrable QA" })).toBeVisible();
    await expect(columna(page, "Nuevo").locator(".prospect-card", { hasText: "Arrastrable QA" })).toHaveCount(0);
    const [guardado] = await leer(page, "acl_local_prospectos");
    expect(guardado.stage).toBe("interesado");

    // Soltarla en su misma columna no cambia nada.
    await columna(page, "Interesado").locator(".prospect-card", { hasText: "Arrastrable QA" }).dragTo(columna(page, "Interesado"));
    expect((await leer(page, "acl_local_prospectos"))[0].stage).toBe("interesado");
  });

  test("en modo «Seleccionar» las tarjetas no se arrastran", async ({ page, go, press, isMobile }) => {
    test.skip(isMobile, "arrastrar es con ratón");
    await go("/admin/prospectos");
    await poner(page, "acl_local_prospectos", [prospecto("d2", "Sin arrastrar QA")]);
    await go("/admin/prospectos");
    await press(page.getByRole("button", { name: "Seleccionar" }));
    await expect(page.locator(".prospect-card", { hasText: "Sin arrastrar QA" })).toHaveAttribute("draggable", "false");
  });

  test("calificación: caliente, tibio y frío; filtro «Solo calientes»", async ({ page, go, press }) => {
    await go("/admin/prospectos");
    await poner(page, "acl_local_prospectos", [
      prospecto("s-frio", "Frío QA", { created_at: new Date(Date.now() - 60 * 864e5).toISOString() }),
      prospecto("s-tibio", "Tibio QA", { stage: "interesado", source: "chatbot" }),
      prospecto("s-caliente", "Caliente QA", { stage: "negociacion", source: "visita_agendada", property_id: "prop-1", search_criteria: { max_price: 2500000 }, last_contact_at: ahora() }),
    ]);
    await go("/admin/prospectos");
    const chip = (nombre) => page.locator(".prospect-card", { hasText: nombre }).locator(".prospect-score");
    await irAEtapa(page, press, "Negociación");
    await expect(chip("Caliente QA")).toContainText("Caliente");
    await expect(chip("Caliente QA")).toHaveAttribute("title", /Calificación \d+\/100[\s\S]*En negociación/);
    await irAEtapa(page, press, "Interesado");
    await expect(chip("Tibio QA")).toContainText("Tibio");
    await irAEtapa(page, press, "Nuevo");
    await expect(chip("Frío QA")).toContainText("Frío");

    // Solo calientes: el frío desaparece.
    await press(page.getByLabel("Solo calientes"));
    await irAEtapa(page, press, "Nuevo");
    await expect(page.locator(".prospect-card", { hasText: "Frío QA" })).toHaveCount(0);
    await irAEtapa(page, press, "Negociación");
    await expect(page.locator(".prospect-card", { hasText: "Caliente QA" })).toBeVisible();
  });

  test("calificación: un prospecto cerrado no se califica", async ({ page, go, press }) => {
    await go("/admin/prospectos");
    await poner(page, "acl_local_prospectos", [prospecto("s-cerrado", "Cerrado QA", { stage: "cerrado" })]);
    await go("/admin/prospectos");
    await irAEtapa(page, press, "Cerrado");
    await expect(page.locator(".prospect-card", { hasText: "Cerrado QA" })).toBeVisible();
    await expect(page.locator(".prospect-card", { hasText: "Cerrado QA" }).locator(".prospect-score")).toHaveCount(0);
  });

  test("calificación: ordenar por temperatura pone al más caliente primero dentro de la columna", async ({ page, go, press }) => {
    await go("/admin/prospectos");
    await poner(page, "acl_local_prospectos", [
      prospecto("o-frio", "Primero Frío", { stage: "contactado", created_at: new Date(Date.now() - 45 * 864e5).toISOString(), last_contact_at: new Date(Date.now() - 40 * 864e5).toISOString() }),
      prospecto("o-caliente", "Segundo Caliente", { stage: "contactado", source: "visita_agendada", property_id: "prop-1", search_criteria: { min_price: 1 }, last_contact_at: ahora(), created_at: new Date(Date.now() - 50 * 864e5).toISOString() }),
    ]);
    await go("/admin/prospectos");
    await irAEtapa(page, press, "Contactado");
    const nombres = async () => page.locator(".prospect-col--contactado .prospect-card__name").allInnerTexts();
    await page.getByLabel("Ordenar prospectos").selectOption("temperature");
    expect(await nombres()).toEqual(["Segundo Caliente", "Primero Frío"]);
  });

  test("secuencia: un prospecto nuevo muestra el paso 1 con el mensaje listo; al registrar contactos avanza y se detiene al avanzar de etapa", async ({ page, go, press }) => {
    await go("/admin/prospectos");
    await poner(page, "acl_local_prospectos", [prospecto("q1", "Luis Secuencia", { source: "whatsapp", property_id: "prop-1" })]);
    await go("/admin/prospectos");
    const tarjeta = page.locator(".prospect-card", { hasText: "Luis Secuencia" });
    await expect(tarjeta.locator(".prospect-sequence")).toContainText("Secuencia: paso 1 de 4 · toca hoy");
    const escribir = tarjeta.getByRole("link", { name: "Escribir: primer mensaje" });
    const href = decodeURIComponent(await escribir.getAttribute("href"));
    expect(href).toMatch(/^https:\/\/wa\.me\/528715550101\?text=/);
    expect(href).toContain("Hola Luis");
    expect(href).toContain("Casa en Residencial Senderos");

    // Con un contacto registrado hoy, el siguiente paso (día 1) ya no toca hoy.
    await poner(page, "acl_local_prospect_contacts", [{ id: "c1", prospecto_id: "q1", channel: "whatsapp", note: null, at: ahora() }]);
    await go("/admin/prospectos");
    await expect(tarjeta.locator(".prospect-sequence")).toContainText("Secuencia: paso 2 de 4 · toca el");
    await expect(tarjeta.getByRole("link", { name: /Escribir:/ }), "todavía no toca: no hay botón").toHaveCount(0);

    // Con los 4 contactos la secuencia termina.
    await poner(page, "acl_local_prospect_contacts", [1, 2, 3, 4].map((n) => ({ id: `c${n}`, prospecto_id: "q1", channel: "whatsapp", note: null, at: ahora() })));
    await go("/admin/prospectos");
    await expect(tarjeta.locator(".prospect-sequence")).toContainText("Secuencia completa");

    // Si el prospecto avanza (ya respondió y está interesado), la secuencia se detiene.
    await poner(page, "acl_local_prospect_contacts", []);
    await poner(page, "acl_local_prospectos", [prospecto("q1", "Luis Secuencia", { source: "whatsapp", stage: "interesado" })]);
    await go("/admin/prospectos");
    await expect(page.locator(".prospect-card", { hasText: "Luis Secuencia" }).locator(".prospect-sequence")).toHaveCount(0);
  });

  test("secuencia: el filtro «Secuencia que toca hoy» deja solo los que ya toca escribirles", async ({ page, go, press }) => {
    await go("/admin/prospectos");
    await poner(page, "acl_local_prospectos", [
      prospecto("f1", "Toca Hoy QA", { source: "whatsapp" }),
      prospecto("f2", "Ya Contactado QA", { source: "whatsapp" }),
    ]);
    await poner(page, "acl_local_prospect_contacts", [{ id: "c1", prospecto_id: "f2", channel: "llamada", note: null, at: ahora() }]);
    await go("/admin/prospectos");
    await press(page.getByLabel("Secuencia que toca hoy"));
    await expect(page.locator(".prospect-card", { hasText: "Toca Hoy QA" })).toBeVisible();
    await expect(page.locator(".prospect-card", { hasText: "Ya Contactado QA" })).toHaveCount(0);
  });
});

test.describe("Equipo hoy: asignación automática", () => {
  test.beforeEach(async ({ seedAdminSession }) => {
    await seedAdminSession();
  });

  test("propone un asesor para cada prospecto sin dueño, reparte la carga y solo guarda al confirmar", async ({ page, go, press }) => {
    await go("/admin/equipo");
    await poner(page, "acl_local_prospectos", [
      prospecto("a0", "Con Asesor QA", { advisor_id: "advisor-1" }),
      prospecto("a1", "Huérfano Uno", { advisor_id: null, created_at: new Date(Date.now() - 3 * 864e5).toISOString() }),
      prospecto("a2", "Huérfano Dos", { advisor_id: null, created_at: new Date(Date.now() - 2 * 864e5).toISOString() }),
      prospecto("a3", "Huérfano Tres", { advisor_id: null, created_at: new Date(Date.now() - 1 * 864e5).toISOString() }),
      prospecto("a4", "Cerrado Sin Asesor", { advisor_id: null, stage: "cerrado" }),
    ]);
    await go("/admin/equipo");
    await press(page.getByRole("button", { name: "Asignar automáticamente" }));
    const panel = page.getByRole("region", { name: "Asignación automática" });
    await expect(panel).toBeVisible();
    await expect(panel.locator("li")).toHaveCount(3); // el cerrado no necesita dueño
    await expect(panel).not.toContainText("Cerrado Sin Asesor");
    await expect(panel).toContainText("Huérfano Uno");

    // Solo es una propuesta: nada se guardó todavía.
    expect((await leer(page, "acl_local_prospectos")).filter((p) => !p.advisor_id)).toHaveLength(4);

    await press(panel.getByRole("button", { name: "Asignar los 3 prospectos" }));
    await expect(panel).toContainText("Listo: se asignaron 3 prospectos.");
    const guardados = await leer(page, "acl_local_prospectos");
    const huerfanos = guardados.filter((p) => ["a1", "a2", "a3"].includes(p.id));
    expect(huerfanos.every((p) => p.advisor_id)).toBe(true);
    expect(new Set(huerfanos.map((p) => p.advisor_id)).size, "la carga se reparte entre varios asesores").toBeGreaterThan(1);
    expect(guardados.find((p) => p.id === "a4").advisor_id, "el cerrado queda como estaba").toBeFalsy();

    // Ya no quedan abiertos sin dueño: la lista se vacía y no hay nada más que asignar.
    await expect(panel.locator("li")).toHaveCount(0);
    await expect(panel.getByRole("button", { name: /Asignar los/ })).toHaveCount(0);
  });

  test("sin prospectos huérfanos no hay botón", async ({ page, go }) => {
    await go("/admin/equipo");
    await poner(page, "acl_local_prospectos", [prospecto("z1", "Con dueño", { advisor_id: "advisor-1" })]);
    await go("/admin/equipo");
    await expect(page.getByRole("button", { name: "Asignar automáticamente" })).toHaveCount(0);
  });
});
