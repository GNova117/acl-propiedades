import { describe, expect, it, vi } from "vitest";
import {
  bookingProspectNote,
  closeLoopAfterVisit,
  findOpenProspect,
  followupAfterVisit,
  mergeBookingIntoProspect,
  prospectAfterVisit,
  prospectFieldsFromBooking,
  syncProspectFollowup,
} from "./visitProspect";

const NOW = "2026-11-03T20:00:00.000Z";
const TODAY = "2026-11-03";
const booking = { label: "Casa Lerdo (ACL-1)", fecha: "2026-11-06", hora: "14:00", propertyId: "p1", today: TODAY, nowISO: NOW };

describe("promoción a prospecto al reservar", () => {
  it("el seguimiento es el día después de la visita", () => {
    expect(followupAfterVisit("2026-11-06")).toBe("2026-11-07");
    expect(followupAfterVisit("2026-12-31")).toBe("2027-01-01");
  });

  it("la nota dice qué visita agendó, con la nota del visitante si la dejó", () => {
    expect(bookingProspectNote({ label: "Casa", fecha: "2026-11-06", hora: "14:00:00" })).toBe("Agendó una visita a Casa el 06/11/2026 a las 14:00");
    expect(bookingProspectNote({ label: "Casa", fecha: "2026-11-06", hora: "14:00", note: " voy con mi esposo " })).toBe("Agendó una visita a Casa el 06/11/2026 a las 14:00. Nota: voy con mi esposo");
  });

  it("un prospecto nuevo: fuente visita_agendada, interesado, con contacto y seguimiento tras la visita", () => {
    expect(prospectFieldsFromBooking({ ...booking, name: "Ana Pérez", phone: "871 123 4567", email: "ana@c.co", advisorId: "a1", messageId: "m1", note: "" })).toEqual({
      name: "Ana Pérez",
      phone: "871 123 4567",
      email: "ana@c.co",
      source: "visita_agendada",
      stage: "interesado",
      advisor_id: "a1",
      property_id: "p1",
      message_id: "m1",
      notes: "Agendó una visita a Casa Lerdo (ACL-1) el 06/11/2026 a las 14:00",
      last_contact_at: NOW,
      next_followup_at: "2026-11-07",
      lost_reason: null,
    });
  });
});

describe("findOpenProspect", () => {
  const prospects = [
    { id: "viejo", phone: "871 123 4567", stage: "contactado", created_at: "2026-10-01T00:00:00Z" },
    { id: "nuevo", phone: "(871) 123-4567", stage: "interesado", created_at: "2026-10-20T00:00:00Z" },
    { id: "cerrado", phone: "871 777 8888", stage: "cerrado" },
    { id: "perdido", email: "perdi@c.co", stage: "perdido" },
    { id: "correo", email: "Luis@Correo.com", stage: "nuevo" },
  ];

  it("coincide por teléfono sin importar el formato ni la lada, y elige el más reciente", () => {
    expect(findOpenProspect(prospects, { phone: "+52 871 123 4567" }).id).toBe("nuevo");
  });

  it("coincide por correo sin importar mayúsculas", () => {
    expect(findOpenProspect(prospects, { email: " luis@correo.com " }).id).toBe("correo");
  });

  it("un prospecto cerrado o perdido no cuenta como existente", () => {
    expect(findOpenProspect(prospects, { phone: "871 777 8888" })).toBeNull();
    expect(findOpenProspect(prospects, { email: "perdi@c.co" })).toBeNull();
  });

  it("sin teléfono válido ni correo no coincide con nadie", () => {
    expect(findOpenProspect(prospects, { phone: "123" })).toBeNull();
    expect(findOpenProspect(prospects, {})).toBeNull();
  });
});

describe("mergeBookingIntoProspect", () => {
  it("de nuevo o contactado sube a interesado; negociación no retrocede", () => {
    expect(mergeBookingIntoProspect({ stage: "nuevo" }, booking).stage).toBe("interesado");
    expect(mergeBookingIntoProspect({ stage: "contactado" }, booking).stage).toBe("interesado");
    expect(mergeBookingIntoProspect({ stage: "interesado" }, booking).stage).toBe("interesado");
    expect(mergeBookingIntoProspect({ stage: "negociacion" }, booking).stage).toBe("negociacion");
  });

  it("el seguimiento se mueve solo si no tenía, ya venció o es posterior a la visita", () => {
    const follow = (next) => mergeBookingIntoProspect({ stage: "contactado", next_followup_at: next }, booking).next_followup_at;
    expect(follow(null)).toBe("2026-11-07");
    expect(follow("2026-10-30")).toBe("2026-11-07"); // vencido
    expect(follow("2026-12-01")).toBe("2026-11-07"); // posterior a la visita: se adelanta
    expect(follow("2026-11-05")).toBe("2026-11-05"); // anterior a la visita y vigente: se conserva
    expect(follow("2026-11-03")).toBe("2026-11-03"); // hoy: se conserva
  });

  it("anota la visita sin borrar lo que ya había, completa la propiedad y marca el último contacto", () => {
    const merged = mergeBookingIntoProspect({ stage: "nuevo", notes: "Llamó por WhatsApp", property_id: null }, booking);
    expect(merged.notes).toBe("Llamó por WhatsApp\nAgendó una visita a Casa Lerdo (ACL-1) el 06/11/2026 a las 14:00");
    expect(merged.property_id).toBe("p1");
    expect(merged.last_contact_at).toBe(NOW);
    expect(mergeBookingIntoProspect({ stage: "nuevo", property_id: "otra" }, booking).property_id).toBe("otra");
  });
});

describe("syncProspectFollowup", () => {
  const auto = { stage: "interesado", next_followup_at: "2026-11-07" }; // visita el 6 → seguimiento el 7

  it("si la visita se mueve, el seguimiento automático se mueve con ella", () => {
    expect(syncProspectFollowup(auto, { kind: "moved", oldFecha: "2026-11-06", fecha: "2026-11-10", today: TODAY })).toEqual({ next_followup_at: "2026-11-11" });
  });

  it("si el asesor lo puso a mano, no se pisa", () => {
    expect(syncProspectFollowup({ ...auto, next_followup_at: "2026-11-15" }, { kind: "moved", oldFecha: "2026-11-06", fecha: "2026-11-10", today: TODAY })).toBeNull();
    expect(syncProspectFollowup({ ...auto, next_followup_at: "2026-11-15" }, { kind: "lost", fecha: "2026-11-06", today: TODAY })).toBeNull();
  });

  it("si se cancela o no asiste, se recontacta mañana", () => {
    expect(syncProspectFollowup(auto, { kind: "lost", fecha: "2026-11-06", today: TODAY })).toEqual({ next_followup_at: "2026-11-04" });
  });

  it("no toca prospectos cerrados o perdidos", () => {
    expect(syncProspectFollowup({ ...auto, stage: "cerrado" }, { kind: "lost", fecha: "2026-11-06", today: TODAY })).toBeNull();
    expect(syncProspectFollowup({ ...auto, stage: "perdido" }, { kind: "moved", oldFecha: "2026-11-06", fecha: "2026-11-10", today: TODAY })).toBeNull();
  });
});

describe("prospectAfterVisit", () => {
  const visit = { id: "v1", interest: "interesado", visited_at: "2026-11-06T20:00:00.000Z" };

  it("el último contacto es la visita y queda ligado a ella (así importarla no lo duplica)", () => {
    expect(prospectAfterVisit({ stage: "interesado", next_followup_at: "2026-11-07" }, visit)).toEqual({ last_contact_at: visit.visited_at, visit_id: "v1" });
  });

  it("la etapa solo avanza según el interés", () => {
    expect(prospectAfterVisit({ stage: "contactado" }, { ...visit, interest: "muy_interesado" }).stage).toBe("interesado");
    expect(prospectAfterVisit({ stage: "interesado" }, { ...visit, interest: "oferta_realizada" }).stage).toBe("negociacion");
    expect(prospectAfterVisit({ stage: "negociacion" }, { ...visit, interest: "interesado" })).not.toHaveProperty("stage"); // no retrocede
    expect(prospectAfterVisit({ stage: "interesado" }, { ...visit, interest: "descartado" })).not.toHaveProperty("stage"); // descartó esa propiedad
  });

  it("si no tenía seguimiento, se agenda el día después de la visita; si ya tenía, se respeta", () => {
    // La visita se construye en hora local (el 6 de noviembre a las 14:00 de donde corra la prueba).
    const local = { ...visit, visited_at: new Date(2026, 10, 6, 14, 0).toISOString() };
    expect(prospectAfterVisit({ stage: "interesado", next_followup_at: null }, local).next_followup_at).toBe("2026-11-07");
    expect(prospectAfterVisit({ stage: "interesado", next_followup_at: "2026-12-01" }, visit)).not.toHaveProperty("next_followup_at");
  });

  it("no toca un prospecto ya ligado a otra visita ni uno cerrado o perdido", () => {
    expect(prospectAfterVisit({ stage: "interesado", visit_id: "otra" }, visit)).not.toHaveProperty("visit_id");
    expect(prospectAfterVisit({ stage: "cerrado" }, visit)).toBeNull();
    expect(prospectAfterVisit({ stage: "perdido" }, visit)).toBeNull();
  });
});

describe("closeLoopAfterVisit", () => {
  const visit = { id: "v1", interest: "muy_interesado", visited_at: "2026-11-06T20:00:00.000Z" };
  const fakeDb = (over = {}) => ({
    getAgendaCitaById: vi.fn(async () => ({ id: "c1", status: "confirmada", prospecto_id: "p1" })),
    setAgendaCitaStatus: vi.fn(async () => ({})),
    getProspects: vi.fn(async () => [{ id: "p1", stage: "interesado", next_followup_at: "2026-11-07" }]),
    updateProspect: vi.fn(async () => ({})),
    ...over,
  });

  it("marca la cita como realizada y actualiza al prospecto", async () => {
    const db = fakeDb();
    const result = await closeLoopAfterVisit(db, visit, "c1", { agenda: true, prospectos: true });
    expect(result).toEqual({ citaClosed: true, prospectUpdated: true });
    expect(db.setAgendaCitaStatus).toHaveBeenCalledWith("c1", "realizada");
    expect(db.updateProspect).toHaveBeenCalledWith("p1", { last_contact_at: visit.visited_at, visit_id: "v1" });
  });

  it("no vuelve a cerrar una cita que ya estaba cerrada", async () => {
    const db = fakeDb({ getAgendaCitaById: vi.fn(async () => ({ id: "c1", status: "realizada", prospecto_id: "p1" })) });
    const result = await closeLoopAfterVisit(db, visit, "c1", { agenda: true, prospectos: true });
    expect(result.citaClosed).toBe(false);
    expect(db.setAgendaCitaStatus).not.toHaveBeenCalled();
    expect(result.prospectUpdated).toBe(true);
  });

  it("respeta los permisos del rol: sin Agenda no toca la cita ni al prospecto ligado; sin Prospectos no toca al prospecto", async () => {
    const db1 = fakeDb();
    expect(await closeLoopAfterVisit(db1, visit, "c1", { agenda: false, prospectos: true })).toEqual({ citaClosed: false, prospectUpdated: false });
    expect(db1.getAgendaCitaById).not.toHaveBeenCalled();
    const db2 = fakeDb();
    expect(await closeLoopAfterVisit(db2, visit, "c1", { agenda: true, prospectos: false })).toEqual({ citaClosed: true, prospectUpdated: false });
    expect(db2.getProspects).not.toHaveBeenCalled();
  });

  it("es de mejor esfuerzo: un fallo no lanza (la visita ya está guardada) ni impide el otro paso", async () => {
    const db = fakeDb({ setAgendaCitaStatus: vi.fn(async () => { throw new Error("sin permiso"); }) });
    const result = await closeLoopAfterVisit(db, visit, "c1", { agenda: true, prospectos: true });
    expect(result).toEqual({ citaClosed: false, prospectUpdated: true });
    const db2 = fakeDb({ getProspects: vi.fn(async () => { throw new Error("caído"); }) });
    await expect(closeLoopAfterVisit(db2, visit, "c1", { agenda: true, prospectos: true })).resolves.toEqual({ citaClosed: true, prospectUpdated: false });
  });

  it("sin cita o sin prospecto ligado no actualiza a nadie", async () => {
    const db = fakeDb({ getAgendaCitaById: vi.fn(async () => ({ id: "c1", status: "confirmada", prospecto_id: null })) });
    expect(await closeLoopAfterVisit(db, visit, "c1", { agenda: true, prospectos: true })).toEqual({ citaClosed: true, prospectUpdated: false });
    expect(db.updateProspect).not.toHaveBeenCalled();
  });
});
