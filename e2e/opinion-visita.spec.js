import { test, expect, expectHealthyPage } from "./fixtures.js";

// Opinión después de la visita (/visita/<token>): de 1 a 5 estrellas, comentario y «quiero ver más opciones», una sola vez. Le llega al
// asesor como mensaje, queda como chip en la Agenda y en la línea de tiempo del prospecto.

const dia = (n) => new Date(Date.now() + n * 864e5).toLocaleDateString("en-CA");
const hace = (horas) => new Date(Date.now() - horas * 3600000).toISOString();
const poner = (page, clave, valor) => page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [clave, valor]);
const leer = (page, clave) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "null"), clave);
const TOKEN = "b".repeat(32);

const propiedad = {
  id: "prop-qa",
  code: "QA-1",
  title: "Casa Opinión QA",
  type: "casa",
  description: "x",
  price: 1500000,
  area_m2: 100,
  bedrooms: 3,
  bathrooms: 2,
  parking: 1,
  zone: "Lerdo",
  address: "Calle 1, Lerdo",
  lat: 25.5,
  lng: -103.5,
  status: "disponible",
  operation_type: "compra",
  active: true,
  main_image: "",
  images: [],
  advisor_ids: ["advisor-1"],
  created_at: hace(1000),
  updated_at: hace(1000),
};

const cita = (over = {}) => ({
  id: "cita-qa",
  advisor_id: "advisor-1",
  client_id: null,
  property_id: "prop-qa",
  prospecto_id: "p1",
  titulo: "Visita: Casa Opinión QA",
  fecha: dia(-1),
  hora: "10:00",
  duracion_min: 60,
  actividades: null,
  lugar: "Calle 1, Lerdo",
  contact_name: "Cliente Opinión QA",
  contact_phone: "8715550199",
  contact_email: "c@c.com",
  status: "confirmada",
  source: "sitio",
  booking_token: TOKEN,
  reschedule_count: 0,
  client_confirmed_at: null,
  created_at: hace(80),
  updated_at: hace(80),
  ...over,
});

const prospecto = {
  id: "p1",
  name: "Cliente Opinión QA",
  phone: "8715550199",
  email: null,
  source: "visita_agendada",
  stage: "interesado",
  advisor_id: "advisor-1",
  property_id: "prop-qa",
  looking_for: null,
  notes: null,
  last_contact_at: hace(48),
  next_followup_at: dia(3),
  lost_reason: null,
  created_at: hace(80),
  updated_at: hace(48),
};

async function preparar(page, go, citaOver) {
  await go("/");
  await poner(page, "acl_local_properties", [propiedad]);
  await poner(page, "acl_local_agenda_citas", [cita(citaOver)]);
  await poner(page, "acl_local_prospectos", [prospecto]);
}

test.describe("Opinión después de la visita", () => {
  test("el cliente califica, comenta y pide más opciones; queda guardada, avisa al asesor y no se puede repetir", async ({ page, go, press }) => {
    await preparar(page, go);
    await go(`/visita/${TOKEN}`);

    const tarjeta = page.locator(".visit-page__feedback");
    await expect(tarjeta.getByRole("heading", { name: "¿Qué te pareció la visita?" })).toBeVisible();

    // Sin elegir estrellas no se envía.
    await press(tarjeta.getByRole("button", { name: "Enviar opinión" }));
    await expect(tarjeta.getByRole("alert")).toHaveText("Elige de 1 a 5 estrellas.");

    await press(tarjeta.locator(".visit-page__star", { hasText: "4 estrellas de 5" }));
    await tarjeta.getByLabel("Comentario (opcional)").fill("Muy bonita pero lejos QA");
    await tarjeta.getByLabel(/Quiero ver más opciones/).check();
    await press(tarjeta.getByRole("button", { name: "Enviar opinión" }));

    await expect(page.getByRole("heading", { name: "¡Gracias por tu opinión!" })).toBeVisible();
    await expect(page.getByText("Te contactará con otras opciones.")).toBeVisible();
    await expect(page.locator(".visit-page__stars")).toHaveText("★★★★☆");

    const [guardada] = await leer(page, "acl_local_agenda_citas");
    expect(guardada).toMatchObject({ feedback_rating: 4, feedback_comment: "Muy bonita pero lejos QA", feedback_more_options: true });
    const mensajes = (await leer(page, "acl_local_messages")).filter((m) => m.channel === "visita_opinion");
    expect(mensajes).toHaveLength(1);
    expect(mensajes[0].message).toContain("★★★★☆ (4 de 5)");
    expect(mensajes[0].details.advisor_id).toBe("advisor-1");

    // Al volver a abrir el enlace ya no se ofrece el formulario.
    await go(`/visita/${TOKEN}`);
    await expect(page.getByRole("heading", { name: "¡Gracias por tu opinión!" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Enviar opinión" })).toHaveCount(0);
    await expectHealthyPage(page);
  });

  test("sin pedir más opciones, el agradecimiento no promete que lo van a contactar", async ({ page, go, press }) => {
    await preparar(page, go);
    await go(`/visita/${TOKEN}`);
    await press(page.locator(".visit-page__star", { hasText: "5 estrellas de 5" }));
    await press(page.getByRole("button", { name: "Enviar opinión" }));
    await expect(page.getByRole("heading", { name: "¡Gracias por tu opinión!" })).toBeVisible();
    await expect(page.getByText("Te contactará con otras opciones.")).toHaveCount(0);
  });

  test("no se ofrece antes de la visita, ni en una cancelada", async ({ page, go }) => {
    await preparar(page, go, { fecha: dia(3) });
    await go(`/visita/${TOKEN}`);
    await expect(page.locator(".visit-page__card").first()).toBeVisible();
    await expect(page.locator(".visit-page__feedback")).toHaveCount(0);

    await poner(page, "acl_local_agenda_citas", [cita({ status: "cancelada" })]);
    await go(`/visita/${TOKEN}`);
    await expect(page.locator(".visit-page__card").first()).toBeVisible();
    await expect(page.locator(".visit-page__feedback")).toHaveCount(0);
  });

  test("el equipo ve la opinión: chip en la Agenda, mensaje en Mensajes y evento en la línea de tiempo del prospecto", async ({ page, go, press, seedAdminSession }) => {
    await seedAdminSession();
    await preparar(page, go, { feedback_rating: 4, feedback_comment: "Muy bonita pero lejos QA", feedback_more_options: true, feedback_at: hace(5), status: "realizada" });
    await poner(page, "acl_local_messages", [
      { id: "msg-op", name: "Cliente Opinión QA", email: "c@c.com", phone: "8715550199", message: "Opinión de la visita — Casa Opinión QA (QA-1).\nCalificación: ★★★★☆ (4 de 5)", property_id: "prop-qa", channel: "visita_opinion", details: { advisor_id: "advisor-1" }, status: "nuevo", created_at: hace(5) },
    ]);

    await go("/admin/agenda");
    await press(page.getByRole("button", { name: "Lista", exact: true })); // la Agenda abre en el calendario
    await expect(page.locator("tr", { hasText: "Casa Opinión QA" }).locator(".agenda-chip", { hasText: "★ 4/5 del cliente · quiere ver más" })).toBeVisible();

    await go("/admin/mensajes");
    const fila = page.locator("tr", { hasText: "Cliente Opinión QA" });
    await expect(fila).toContainText("Opinión de una visita");
    // Un aviso de opinión no se convierte en prospecto ni en cita.
    await expect(fila.getByRole("button", { name: /prospecto/i })).toHaveCount(0);

    await go("/admin/prospectos/p1");
    const evento = page.locator('.prospect-timeline__item[data-kind="feedback"]');
    await expect(evento).toContainText("★★★★☆ (4 de 5)");
    await expect(evento).toContainText("Muy bonita pero lejos QA");
    await expect(evento).toContainText("Quiere ver más opciones");
  });
});
