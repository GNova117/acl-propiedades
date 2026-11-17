import { beforeEach, describe, expect, it } from "vitest";

// Modo demo (espejo de next_visit_slots, selection_react, track_property_event y el `interest` del informe de
// schema.sql). localBackend lee/escribe en window.localStorage: aquí se simula en memoria.
const store = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  },
};

// visitorId.js usa el `localStorage` global (no window.localStorage): el mismo visitante en todas las llamadas.
globalThis.localStorage = globalThis.window.localStorage;

const { localBackend: db } = await import("./localBackend");
const { PROPERTIES } = await import("./seedData");
const { DEFAULT_VISIT_SETTINGS, DEFAULT_WEEKLY_SCHEDULE } = await import("./visitSlots");

const withAdvisor = PROPERTIES.find((p) => (p.advisor_ids || []).length > 0 && p.active && p.status !== "vendida");
const sold = PROPERTIES.find((p) => p.status === "vendida");

beforeEach(() => store.clear());

describe("modo demo: próximos horarios para las tarjetas", () => {
  it("sin horario activo no sale ninguna propiedad", async () => {
    expect(await db.getNextVisitSlots([withAdvisor.id])).toEqual([]);
  });

  it("con horario sale el primer horario libre; vendidas, inexistentes y repetidas se omiten", async () => {
    await db.saveAdvisorVisitSchedule(withAdvisor.advisor_ids[0], { settings: { ...DEFAULT_VISIT_SETTINGS, enabled: true }, weekly: DEFAULT_WEEKLY_SCHEDULE });
    const [first] = await db.getVisitSlots(withAdvisor.id, { days: 7 });
    const result = await db.getNextVisitSlots([withAdvisor.id, withAdvisor.id, sold.id, "no-existe"]);
    expect(result).toEqual([{ property_id: withAdvisor.id, fecha: first.fecha, hora: first.hora }]);
  });

  it("sin ids devuelve una lista vacía", async () => {
    expect(await db.getNextVisitSlots([])).toEqual([]);
    expect(await db.getNextVisitSlots(null)).toEqual([]);
  });
});

describe("modo demo: reacciones en la selección", () => {
  const make = () => db.createSelection({ propertyIds: ["prop-1", "prop-2"], title: "Para Luis", advisorId: null, prospectoId: null });

  it("guarda me gusta y comentario, y la apertura los devuelve", async () => {
    const s = await make();
    expect(await db.reactToSelection(s.token, "prop-1", { reaction: "like", comment: "  Me encanta  " })).toMatchObject({ ok: true });
    await db.reactToSelection(s.token, "prop-2", { reaction: "dislike" });
    const opened = await db.openSelection(s.token, { track: false });
    expect(opened.reactions["prop-1"]).toMatchObject({ r: "like", c: "Me encanta" });
    expect(opened.reactions["prop-2"]).toMatchObject({ r: "dislike", c: null });
  });

  it("solo un comentario se conserva; sin reacción ni comentario se borra", async () => {
    const s = await make();
    await db.reactToSelection(s.token, "prop-1", { comment: "Muy lejos" });
    expect((await db.openSelection(s.token, { track: false })).reactions["prop-1"]).toMatchObject({ r: null, c: "Muy lejos" });
    await db.reactToSelection(s.token, "prop-1", { reaction: null, comment: "   " });
    expect((await db.openSelection(s.token, { track: false })).reactions).toEqual({});
  });

  it("mismos errores que la base", async () => {
    const s = await make();
    expect(await db.reactToSelection("x".repeat(32), "prop-1", { reaction: "like" })).toEqual({ error: "unavailable" });
    expect(await db.reactToSelection(s.token, "prop-9", { reaction: "like" })).toEqual({ error: "invalid_property" });
    expect(await db.reactToSelection(s.token, "prop-1", { reaction: "maybe" })).toEqual({ error: "invalid_reaction" });
    expect(await db.reactToSelection(s.token, "prop-1", { comment: "x".repeat(301) })).toEqual({ error: "invalid_comment" });
  });

  it("una selección desactivada no admite reacciones y no las muestra", async () => {
    const s = await make();
    await db.reactToSelection(s.token, "prop-1", { reaction: "like" });
    await db.revokeSelection(s.id);
    expect(await db.reactToSelection(s.token, "prop-1", { reaction: "dislike" })).toEqual({ error: "unavailable" });
    expect((await db.openSelection(s.token, { track: false })).reactions).toEqual({});
  });
});

describe("modo demo: interés en línea en el informe del vendedor", () => {
  it("sin nada son ceros", async () => {
    const report = await db.getVisitReport(withAdvisor.id);
    expect(report.interest).toEqual({ views: 0, unique_visitors: 0, views_7d: 0, favorites: 0, shares: 0 });
  });

  it("cuenta vistas, favoritos y compartidas, una vez por visitante y día", async () => {
    await db.trackPropertyView(withAdvisor.id);
    await db.trackPropertyView(withAdvisor.id);
    await db.trackPropertyEvent(withAdvisor.id, "favorite");
    await db.trackPropertyEvent(withAdvisor.id, "favorite");
    await db.trackPropertyEvent(withAdvisor.id, "share");
    await db.trackPropertyEvent(withAdvisor.id, "hack");
    await db.trackPropertyEvent("no-existe", "share");
    expect((await db.getVisitReport(withAdvisor.id)).interest).toEqual({ views: 1, unique_visitors: 1, views_7d: 1, favorites: 1, shares: 1 });
  });
});

describe("modo demo: avisos al cliente del portal (notify_client)", () => {
  const base = { stage: "documentos", note: "", requestedDocs: ["ine"] };

  it("apagado por omisión", async () => {
    expect((await db.saveClientTramite("c1", base)).notify_client).toBe(false);
  });

  it("solo cambia cuando viene; si no, conserva lo que había", async () => {
    expect((await db.saveClientTramite("c1", { ...base, notifyClient: true })).notify_client).toBe(true);
    expect((await db.saveClientTramite("c1", { ...base, stage: "revision" })).notify_client).toBe(true);
    expect((await db.getClientTramite("c1")).stage).toBe("revision");
    expect((await db.saveClientTramite("c1", { ...base, notifyClient: false })).notify_client).toBe(false);
  });
});
