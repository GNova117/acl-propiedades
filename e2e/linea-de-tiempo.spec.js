import { test, expect } from "./fixtures.js";

// Línea de tiempo en la ficha del prospecto: todo lo que ha pasado con él en un solo historial por fecha
// (alta, contactos, cambios de etapa, citas, visitas y notas), con la cita que viene arriba.

const fechaLocal = (dias) => new Date(Date.now() + dias * 864e5).toLocaleDateString("en-CA");
const iso = (dias, hora) => new Date(`${fechaLocal(dias)}T${hora}`).toISOString();
const haceHoras = (h) => new Date(Date.now() - h * 3600e3).toISOString();

const prospecto = (extra = {}) => ({
  id: "t1",
  name: "Historia Completa QA",
  phone: "8715550177",
  email: null,
  source: "sitio",
  stage: "contactado",
  advisor_id: "advisor-1",
  property_id: "prop-1",
  looking_for: null,
  notes: null,
  last_contact_at: haceHoras(24),
  next_followup_at: null,
  lost_reason: null,
  created_at: iso(-10, "09:00"),
  updated_at: haceHoras(25),
  ...extra,
});

const cita = (id, titulo, dias, hora, status) => ({
  id,
  advisor_id: "advisor-1",
  client_id: null,
  titulo,
  fecha: fechaLocal(dias),
  hora,
  actividades: null,
  lugar: id === "k-pasada" ? "Blvd. Constitución 123" : null,
  contact_name: "Historia Completa QA",
  contact_phone: "8715550177",
  contact_email: null,
  status,
  source: "admin",
  prospecto_id: "t1",
  property_id: "prop-1",
  booking_token: id.padEnd(32, "0").slice(0, 32),
  created_at: iso(-5, "09:00"),
  updated_at: iso(-5, "09:00"),
});

async function sembrarHistoria(page, go, ruta = "/admin/prospectos/t1") {
  await go("/admin/prospectos");
  await page.evaluate(
    (datos) => {
      const poner = (k, v) => localStorage.setItem(k, JSON.stringify(v));
      poner("acl_local_prospectos", [datos.prospecto]);
      poner("acl_local_prospect_contacts", datos.contactos);
      poner("acl_local_prospect_stages", datos.etapas);
      poner("acl_local_agenda_citas", datos.citas);
      poner("acl_local_visits", datos.visitas);
      poner("acl_local_internal_notes", datos.notas);
    },
    {
      prospecto: prospecto(),
      contactos: [
        { id: "ct1", prospecto_id: "t1", channel: "llamada", note: "Primera llamada", at: iso(-3, "10:00"), actor: "ana@acl.mx" },
        { id: "ct2", prospecto_id: "t1", channel: "whatsapp", note: "Le mandé la casa por WhatsApp", at: new Date(Date.now() - 24 * 3600e3).toISOString(), actor: "ana@acl.mx" },
      ],
      etapas: [
        { prospecto_id: "t1", stage: "nuevo", at: iso(-10, "09:00") },
        { prospecto_id: "t1", stage: "contactado", at: new Date(Date.now() - 25 * 3600e3).toISOString() },
      ],
      citas: [cita("k-pasada", "Visita pasada QA", -2, "11:00", "realizada"), cita("k-futura", "Visita próxima QA", 1, "10:00", "confirmada")],
      visitas: [
        {
          id: "v-qa",
          property_id: "prop-1",
          advisor_id: "advisor-1",
          visited_at: iso(-2, "12:00"),
          prospect_name: "Historia Completa QA",
          interest: "muy_interesado",
          reasons: [],
          comments: "Le encantó el jardín",
          internal_notes: "",
          potential_client: true,
          prospect_phone: "8715550177",
          looking_for: "",
          cita_id: "k-pasada",
          created_at: iso(-2, "12:30"),
        },
      ],
      notas: [{ id: "n1", entity_type: "prospect", entity_id: "t1", body: "Prefiere visitas por la tarde", mentions: [], author_email: "ana@acl.mx", created_at: haceHoras(6) }],
    },
  );
  await go(ruta);
}

test.describe("Línea de tiempo del prospecto", () => {
  test.beforeEach(async ({ seedAdminSession }) => {
    await seedAdminSession();
  });

  test("junta alta, contactos, etapas, citas, visitas y notas por fecha, con la cita próxima arriba", async ({ page, go }) => {
    await sembrarHistoria(page, go);
    const linea = page.locator(".prospect-timeline");
    await expect(linea.getByRole("heading", { name: "Línea de tiempo" })).toBeVisible();
    const items = linea.locator(".prospect-timeline__item");

    await test.step("del más próximo al más antiguo", async () => {
      await expect(items).toHaveCount(8);
      expect(await items.evaluateAll((els) => els.map((e) => e.dataset.kind))).toEqual(["appointment", "note", "contact", "stage", "visit", "appointment", "contact", "created"]);
    });

    await test.step("la cita que viene va resaltada y marcada «Próxima»", async () => {
      const proxima = items.first();
      await expect(proxima).toHaveClass(/is-upcoming/);
      await expect(proxima).toContainText("Visita próxima QA");
      await expect(proxima.getByText("Próxima", { exact: true })).toBeVisible();
      await expect(items.nth(5)).not.toHaveClass(/is-upcoming/);
    });

    await test.step("cada evento dice lo que pasó", async () => {
      await expect(items.nth(1)).toContainText("Prefiere visitas por la tarde");
      await expect(items.nth(2)).toContainText("WhatsApp");
      await expect(items.nth(2)).toContainText("Le mandé la casa por WhatsApp");
      await expect(items.nth(3)).toContainText("Pasó a «Contactado»");
      await expect(items.nth(4)).toContainText("Visita a Casa en Residencial Senderos");
      await expect(items.nth(4)).toContainText("Muy interesado");
      await expect(items.nth(4)).toContainText("Le encantó el jardín");
      await expect(items.nth(5)).toContainText("Realizada");
      await expect(items.nth(5)).toContainText("Blvd. Constitución 123");
      await expect(items.nth(6)).toContainText("Primera llamada");
      await expect(items.nth(7)).toContainText("Origen: Sitio web");
    });

    await test.step("la cita y la visita llevan a su pantalla", async () => {
      await expect(items.first().getByRole("link", { name: "Visita próxima QA" })).toHaveAttribute("href", "/admin/agenda/k-futura");
      await expect(items.nth(4).getByRole("link", { name: /Visita a/ })).toHaveAttribute("href", "/admin/visitas/v-qa");
    });
  });

  test("al registrar un contacto aparecen enseguida el contacto y el cambio de etapa", async ({ page, go, press }) => {
    await go("/admin/prospectos");
    const nuevo = { ...prospecto({ id: "t2", name: "Recién Llegado QA", stage: "nuevo", last_contact_at: null, created_at: haceHoras(2) }) };
    await page.evaluate((p) => localStorage.setItem("acl_local_prospectos", JSON.stringify([p])), nuevo);
    await go("/admin/prospectos/t2");
    const linea = page.locator(".prospect-timeline");
    await expect(linea.locator(".prospect-timeline__item")).toHaveCount(1); // solo «Alta»

    const ficha = page.locator(".prospect-profile");
    await press(ficha.getByRole("button", { name: "Registrar contacto" }));
    await press(ficha.locator("form.contact-form").getByRole("button", { name: "No contestó" }));

    await expect(linea.locator(".prospect-timeline__item[data-kind=contact]")).toHaveCount(1);
    await expect(linea.locator(".prospect-timeline__item[data-kind=contact]")).toContainText("No contestó");
    await expect(linea.locator(".prospect-timeline__item[data-kind=stage]")).toContainText("Pasó a «Contactado»");
    await expect(linea.locator(".prospect-timeline__item").first()).toHaveAttribute("data-kind", /contact|stage/);
  });

  test("una nota nueva (o borrada) se refleja en la línea de tiempo", async ({ page, go, press }) => {
    await sembrarHistoria(page, go);
    const linea = page.locator(".prospect-timeline");
    const notas = linea.locator(".prospect-timeline__item[data-kind=note]");
    await expect(notas).toHaveCount(1);

    await page.fill("#internal-note-body", "Pidió cambiar la hora de la visita");
    await press(page.getByRole("button", { name: "Agregar nota" }));
    await expect(notas).toHaveCount(2);
    await expect(notas.first()).toContainText("Pidió cambiar la hora de la visita");

    // Se borra con el botón de la nota (en el bloque de notas internas).
    const bloque = page.locator(".internal-notes");
    await press(bloque.getByRole("button", { name: "Eliminar" }).first());
    await expect(notas).toHaveCount(1);
  });

  test("con muchos eventos muestra los primeros y «Ver más» despliega el resto", async ({ page, go, press }) => {
    await go("/admin/prospectos");
    const contactos = Array.from({ length: 16 }, (_, i) => ({ id: `m${i}`, prospecto_id: "t1", channel: "llamada", note: `Llamada número ${i + 1}`, at: new Date(Date.now() - (i + 1) * 3600e3).toISOString(), actor: "" }));
    await page.evaluate(
      ({ p, c }) => {
        localStorage.setItem("acl_local_prospectos", JSON.stringify([p]));
        localStorage.setItem("acl_local_prospect_contacts", JSON.stringify(c));
      },
      { p: prospecto(), c: contactos },
    );
    await go("/admin/prospectos/t1");
    const linea = page.locator(".prospect-timeline");
    await expect(linea.locator(".prospect-timeline__item")).toHaveCount(12);
    await press(linea.getByRole("button", { name: /Ver \d+ más/ }));
    // 16 contactos + el alta + la etapa actual (sin historial guardado, el backend le da una fila con su etapa).
    await expect(linea.locator(".prospect-timeline__item")).toHaveCount(18);
    await press(linea.getByRole("button", { name: "Ver menos" }));
    await expect(linea.locator(".prospect-timeline__item")).toHaveCount(12);
  });
});
