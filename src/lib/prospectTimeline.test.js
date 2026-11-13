import { describe, expect, it } from "vitest";
import { buildTimeline, citaTime, isProspectCita, isProspectVisit } from "./prospectTimeline";

const iso = (d, h = 10, m = 0) => new Date(2026, 10, d, h, m).toISOString();
const NOW = new Date(2026, 10, 12, 12, 0); // jueves 12 de noviembre de 2026, 12:00

const prospect = { id: "p1", name: "María", phone: "871 123 4567", source: "sitio", stage: "interesado", created_at: iso(1) };
const kinds = (items) => items.map((i) => i.kind);

describe("buildTimeline: selecciones de propiedades", () => {
  const sel = (over = {}) => ({ id: "s1", prospecto_id: "p1", title: "Propiedades para María", property_ids: ["a", "b", "c"], created_at: iso(3, 9), open_count: 0, first_opened_at: null, last_opened_at: null, revoked_at: null, ...over });

  it("anota cuándo se le mandó (con cuántas propiedades) y, si la abrió, la primera apertura con las veces", () => {
    const items = buildTimeline({ prospect, selections: [sel({ open_count: 3, first_opened_at: iso(3, 18), last_opened_at: iso(4, 8) })], now: NOW });
    expect(kinds(items)).toEqual(["selectionOpened", "selection", "created"]);
    expect(items[0]).toMatchObject({ selectionId: "s1", opens: 3, title: "Propiedades para María", at: new Date(iso(3, 18)).getTime(), lastAt: new Date(iso(4, 8)).getTime() });
    expect(items[1]).toMatchObject({ selectionId: "s1", count: 3, revoked: false, at: new Date(iso(3, 9)).getTime() });
  });

  it("sin abrir solo trae el envío; desactivada lo marca", () => {
    const items = buildTimeline({ prospect, selections: [sel({ revoked_at: iso(4) })], now: NOW });
    expect(kinds(items)).toEqual(["selection", "created"]);
    expect(items[0].revoked).toBe(true);
  });

  it("solo las de este prospecto, y una fecha vacía no inventa un evento en 1970", () => {
    const items = buildTimeline({ prospect, selections: [sel({ id: "s2", prospecto_id: "otro" }), sel({ id: "s3", first_opened_at: "" })], now: NOW });
    expect(items.filter((i) => i.kind.startsWith("selection")).map((i) => i.id)).toEqual(["selection-s3"]);
  });
});

describe("buildTimeline", () => {
  it("siempre trae el alta («Capturado»), con su origen", () => {
    const [created] = buildTimeline({ prospect, now: NOW });
    expect(created).toMatchObject({ id: "created", kind: "created", source: "sitio", at: new Date(prospect.created_at).getTime() });
  });

  it("junta contactos, etapas, citas, visitas y notas, del más reciente al más antiguo", () => {
    const items = buildTimeline({
      prospect,
      contacts: [{ id: "c1", at: iso(2, 10), channel: "whatsapp", note: "Le mandé la casa", actor: "ana@acl.mx" }],
      stages: [
        { prospecto_id: "p1", stage: "nuevo", at: iso(1) },
        { prospecto_id: "p1", stage: "contactado", at: iso(2, 9) },
      ],
      citas: [{ id: "k1", prospecto_id: "p1", titulo: "Visita: Casa", fecha: "2026-11-05", hora: "11:00:00", status: "realizada" }],
      visits: [{ id: "v1", cita_id: "k1", visited_at: iso(5, 12), property_id: "prop-1", interest: "muy_interesado", comments: "Le encantó" }],
      notes: [{ id: "n1", body: "Prefiere por la tarde", author_email: "ana@acl.mx", created_at: iso(6) }],
      now: NOW,
    });
    expect(kinds(items)).toEqual(["note", "visit", "appointment", "contact", "stage", "created"]);
    expect(items.map((i) => i.at)).toEqual([...items.map((i) => i.at)].sort((a, b) => b - a));
  });

  it("no repite como cambio de etapa la etapa inicial (ya la cuenta «Capturado»)", () => {
    const items = buildTimeline({ prospect, stages: [{ prospecto_id: "p1", stage: "nuevo", at: prospect.created_at }], now: NOW });
    expect(kinds(items)).toEqual(["created"]);
  });

  it("sí cuenta el siguiente cambio, aunque la primera fila sea de otra etapa", () => {
    const items = buildTimeline({
      prospect,
      stages: [
        { prospecto_id: "p1", stage: "nuevo", at: prospect.created_at },
        { prospecto_id: "p1", stage: "interesado", at: iso(3) },
      ],
      now: NOW,
    });
    expect(items.filter((i) => i.kind === "stage")).toHaveLength(1);
    expect(items.find((i) => i.kind === "stage").stage).toBe("interesado");
  });

  it("solo toma el historial de etapas de este prospecto", () => {
    const items = buildTimeline({ prospect, stages: [{ prospecto_id: "otro", stage: "cerrado", at: iso(4) }], now: NOW });
    expect(kinds(items)).toEqual(["created"]);
  });

  it("una cita próxima queda arriba y marcada como «próxima»; una pasada no", () => {
    const items = buildTimeline({
      prospect,
      citas: [
        { id: "futura", prospecto_id: "p1", titulo: "Visita futura", fecha: "2026-11-14", hora: "10:00", status: "confirmada" },
        { id: "pasada", prospecto_id: "p1", titulo: "Visita pasada", fecha: "2026-11-10", hora: "10:00", status: "confirmada" },
      ],
      contacts: [{ id: "c1", at: iso(11), channel: "llamada" }],
      now: NOW,
    });
    expect(items[0]).toMatchObject({ id: "cita-futura", upcoming: true });
    expect(items.find((i) => i.id === "cita-pasada").upcoming).toBe(false);
  });

  it("una cita futura cancelada no es «próxima»", () => {
    const [cita] = buildTimeline({ prospect, citas: [{ id: "x", prospecto_id: "p1", titulo: "t", fecha: "2026-11-20", hora: "10:00", status: "cancelada" }], now: NOW });
    expect(cita).toMatchObject({ kind: "appointment", status: "cancelada", upcoming: false });
  });

  it("ignora fechas inválidas o vacías sin romper (null no se vuelve 1970)", () => {
    const items = buildTimeline({
      prospect,
      contacts: [{ id: "c", at: "no-es-fecha", channel: "llamada" }],
      notes: [{ id: "n", body: "x", created_at: null }, { id: "m", body: "y", created_at: "" }],
      visits: [{ id: "v", prospect_phone: "871 123 4567", visited_at: undefined }],
      now: NOW,
    });
    expect(kinds(items)).toEqual(["created"]);
  });

  it("a la misma hora el orden es estable", () => {
    const at = iso(3);
    const a = buildTimeline({ prospect, contacts: [{ id: "b", at, channel: "llamada" }, { id: "a", at, channel: "correo" }], now: NOW });
    const b = buildTimeline({ prospect, contacts: [{ id: "a", at, channel: "correo" }, { id: "b", at, channel: "llamada" }], now: NOW });
    expect(a.map((i) => i.id)).toEqual(b.map((i) => i.id));
  });
});

describe("qué citas y visitas son de este prospecto", () => {
  it("la cita ligada a él, o la de su cliente si ya lo es", () => {
    expect(isProspectCita(prospect, { prospecto_id: "p1" })).toBe(true);
    expect(isProspectCita(prospect, { prospecto_id: "otro" })).toBe(false);
    expect(isProspectCita({ ...prospect, client_id: "cli" }, { client_id: "cli" })).toBe(true);
    expect(isProspectCita(prospect, { client_id: "cli" })).toBe(false);
  });

  it("la visita de la que salió, la de una de sus citas o la registrada con su mismo teléfono", () => {
    expect(isProspectVisit({ ...prospect, visit_id: "v9" }, { id: "v9" })).toBe(true);
    expect(isProspectVisit(prospect, { id: "v2", cita_id: "k1" }, new Set(["k1"]))).toBe(true);
    expect(isProspectVisit(prospect, { id: "v3", prospect_phone: "+52 (871) 123-4567" })).toBe(true);
  });

  it("no confunde visitas de otras personas ni teléfonos cortos", () => {
    expect(isProspectVisit(prospect, { id: "v4", prospect_phone: "871 999 0000" })).toBe(false);
    expect(isProspectVisit({ ...prospect, phone: "123" }, { id: "v5", prospect_phone: "123" })).toBe(false);
    expect(isProspectVisit(prospect, { id: "v6", cita_id: "k9" }, new Set(["k1"]))).toBe(false);
  });
});

describe("citaTime", () => {
  it("usa la fecha y la hora (sin hora, el inicio del día)", () => {
    expect(citaTime({ fecha: "2026-11-14", hora: "10:30:00" })).toBe(new Date(2026, 10, 14, 10, 30).getTime());
    expect(citaTime({ fecha: "2026-11-14", hora: null })).toBe(new Date(2026, 10, 14, 0, 0).getTime());
  });
});

describe("buildTimeline: opinión de la visita", () => {
  const prospect = { id: "p1", created_at: "2026-11-01T10:00:00Z" };
  const cita = (over = {}) => ({ id: "c1", prospecto_id: "p1", titulo: "Visita: Casa Lerdo", fecha: "2026-11-10", hora: "10:00", status: "realizada", ...over });

  it("la opinión del cliente entra con su propia hora, calificación, comentario y si quiere ver más", () => {
    const items = buildTimeline({
      prospect,
      citas: [cita({ feedback_rating: 4, feedback_comment: "Bonita pero lejos", feedback_more_options: true, feedback_at: "2026-11-10T18:30:00Z" })],
      now: new Date("2026-11-12T12:00:00Z"),
    });
    const feedback = items.find((i) => i.kind === "feedback");
    expect(feedback).toMatchObject({ rating: 4, comment: "Bonita pero lejos", moreOptions: true, citaId: "c1", title: "Visita: Casa Lerdo" });
    expect(feedback.at).toBe(new Date("2026-11-10T18:30:00Z").getTime());
    // La cita sigue saliendo aparte, antes de la opinión en el tiempo.
    expect(items.filter((i) => i.kind === "appointment")).toHaveLength(1);
    expect(items.findIndex((i) => i.kind === "feedback")).toBeLessThan(items.findIndex((i) => i.kind === "appointment"));
  });

  it("sin opinión (o de una cita de otro prospecto) no hay evento", () => {
    expect(buildTimeline({ prospect, citas: [cita()], now: new Date("2026-11-12T12:00:00Z") }).some((i) => i.kind === "feedback")).toBe(false);
    expect(buildTimeline({ prospect, citas: [cita({ prospecto_id: "otro", feedback_rating: 5, feedback_at: "2026-11-10T18:30:00Z" })], now: new Date("2026-11-12T12:00:00Z") }).some((i) => i.kind === "feedback")).toBe(false);
  });
});
