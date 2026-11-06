import { beforeEach, describe, expect, it } from "vitest";

// Modo demo de las solicitudes de visita SIN asesor: el cliente pide un día y una hora, la solicitud
// queda en la Agenda de todos y la primera persona que la toma se la queda. Mismas reglas que
// request_visit / claim_visit_request de supabase/schema.sql.
const store = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  },
};

const { localBackend: db } = await import("./localBackend");
const { PROPERTIES } = await import("./seedData");
const { DEFAULT_VISIT_SETTINGS, DEFAULT_WEEKLY_SCHEDULE, addDays, mexicoParts } = await import("./visitSlots");

const property = PROPERTIES.find((p) => (p.advisor_ids || []).length > 1 && p.active && p.status !== "vendida");
const [advisorA, advisorB] = property.advisor_ids;
const person = { name: "Rita Solicitud", email: "rita@correo.com", phone: "871 300 4000" };
const fecha = () => addDays(mexicoParts().date, 10);

const request = (extra = {}) => db.requestVisit({ propertyId: property.id, fecha: fecha(), hora: "19:30", ...person, note: "prefiero por la tarde", ...extra });

beforeEach(() => store.clear());

describe("modo demo: solicitar una visita sin asesor", () => {
  it("crea una cita 'solicitada' sin asesor, un mensaje visita_solicitud y un prospecto sin asesor", async () => {
    const result = await request();
    expect(result).toMatchObject({ ok: true, fecha: fecha(), hora: "19:30" });
    expect(result.token).toMatch(/^[0-9a-f]{32}$/);

    const [cita] = await db.getAgendaCitas();
    expect(cita).toMatchObject({ advisor_id: null, status: "solicitada", source: "sitio", property_id: property.id, contact_name: person.name, hora: "19:30" });

    const [message] = await db.getContactMessages();
    expect(message).toMatchObject({ channel: "visita_solicitud", property_id: property.id });
    expect(message.message).toContain("Solicitud de visita sin asesor");
    expect(message.message).toContain("Nota: prefiero por la tarde");

    const [prospect] = await db.getProspects();
    expect(prospect).toMatchObject({ source: "visita_agendada", stage: "interesado", advisor_id: null });
    expect(prospect.notes).toMatch(/^Solicitó una visita a /);
  });

  it("valida los datos y la fecha (con hora, al menos 1 h adelante, a menos de 90 días)", async () => {
    expect((await request({ name: " " })).error).toBe("invalid_name");
    expect((await request({ email: "x" })).error).toBe("invalid_email");
    expect((await request({ phone: "123" })).error).toBe("invalid_phone");
    expect((await request({ hora: "" })).error).toBe("invalid_slot");
    expect((await request({ fecha: addDays(mexicoParts().date, -1) })).error).toBe("invalid_slot");
    expect((await request({ fecha: addDays(mexicoParts().date, 120) })).error).toBe("invalid_slot");
    expect((await request({ propertyId: "no-existe" })).error).toBe("property_unavailable");
    expect(await db.getAgendaCitas()).toEqual([]);
  });

  it("máximo 2 activas por teléfono contando las solicitudes, y no duplica el prospecto", async () => {
    expect((await request()).ok).toBe(true);
    expect((await request({ fecha: addDays(fecha(), 1) })).ok).toBe(true);
    expect((await request({ fecha: addDays(fecha(), 2), phone: "+52 871-300-4000" })).error).toBe("too_many_active");
    expect(await db.getProspects()).toHaveLength(1);
  });

  it("el cliente ve su solicitud en /visita/<token>: sin asesor, solo se puede cancelar", async () => {
    const { token } = await request();
    const booking = await db.getVisitBooking(token);
    expect(booking).toMatchObject({ status: "solicitada", advisor: null, can_cancel: true, can_reschedule: false, can_confirm: false });
    expect((await db.rescheduleVisitBooking(token, fecha(), "10:00")).error).toBe("not_active");
    expect((await db.confirmVisitAttendance(token)).error).toBe("not_active");
    expect(await db.getBookingSlots(token)).toEqual([]);

    expect((await db.cancelVisitBooking(token, "ya no puedo")).ok).toBe(true);
    const [cita] = await db.getAgendaCitas();
    expect(cita).toMatchObject({ status: "cancelada", cancelled_by: "cliente" });
    expect((await db.cancelVisitBooking(token)).error).toBe("not_active");
    expect((await db.claimVisitRequest(cita.id, { advisorId: advisorA })).error).toBe("already_taken");
  });
});

describe("modo demo: tomar la solicitud", () => {
  it("la primera persona que la toma se la queda: queda confirmada, con su nombre y su prospecto", async () => {
    const { token } = await request();
    const [cita] = await db.getAgendaCitas();

    expect((await db.claimVisitRequest(cita.id, { advisorId: advisorA })).ok).toBe(true);
    const [taken] = await db.getAgendaCitas();
    expect(taken).toMatchObject({ advisor_id: advisorA, status: "confirmada" });
    expect((await db.getProspects())[0].advisor_id).toBe(advisorA);

    const booking = await db.getVisitBooking(token);
    expect(booking.status).toBe("confirmada");
    expect(booking.advisor.id).toBe(advisorA);

    // quien llega segundo, tarde
    expect((await db.claimVisitRequest(cita.id, { advisorId: advisorB })).error).toBe("already_taken");
    expect((await db.getAgendaCitas())[0].advisor_id).toBe(advisorA);
  });

  it("errores: sin asesor, asesor inexistente o cita que no existe", async () => {
    await request();
    const [cita] = await db.getAgendaCitas();
    expect((await db.claimVisitRequest(cita.id)).error).toBe("advisor_required");
    expect((await db.claimVisitRequest(cita.id, { advisorId: "nadie" })).error).toBe("invalid_advisor");
    expect((await db.claimVisitRequest("nada", { advisorId: advisorA })).error).toBe("not_found");
    expect((await db.getAgendaCitas())[0]).toMatchObject({ advisor_id: null, status: "solicitada" });
  });

  it("una cita normal ya confirmada no se puede 'tomar'", async () => {
    await db.saveAdvisorVisitSchedule(advisorA, { settings: { ...DEFAULT_VISIT_SETTINGS, enabled: true }, weekly: DEFAULT_WEEKLY_SCHEDULE });
    const [slot] = await db.getVisitSlots(property.id);
    await db.bookVisit({ propertyId: property.id, ...slot, ...person });
    const [cita] = await db.getAgendaCitas();
    expect((await db.claimVisitRequest(cita.id, { advisorId: advisorB })).error).toBe("already_taken");
    expect((await db.getAgendaCitas())[0].advisor_id).toBe(advisorA);
  });
});

describe("modo demo: horarios con los asesores disponibles", () => {
  it("cada horario dice qué asesores están libres a esa hora (nombre y foto, sin contacto)", async () => {
    await db.saveAdvisorVisitSchedule(advisorA, { settings: { ...DEFAULT_VISIT_SETTINGS, enabled: true }, weekly: DEFAULT_WEEKLY_SCHEDULE }); // 10–18
    await db.saveAdvisorVisitSchedule(advisorB, { settings: { ...DEFAULT_VISIT_SETTINGS, enabled: true }, weekly: [1, 2, 3, 4, 5, 6, 0].map((weekday) => ({ weekday, start_time: "12:00", end_time: "14:00" })) });
    const slots = await db.getVisitSlots(property.id);
    const at = (hora) => slots.find((s) => s.hora === hora);

    expect(at("10:00").advisors.map((a) => a.id)).toEqual([advisorA]);
    expect(at("12:00").advisors).toHaveLength(2);
    expect(Object.keys(at("12:00").advisors[0]).sort()).toEqual(["id", "name", "photo_url"]);
    const names = at("12:00").advisors.map((a) => a.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });
});
