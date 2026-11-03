import { beforeEach, describe, expect, it } from "vitest";

// localBackend lee/escribe en window.localStorage: aquí se simula en memoria
// para probar el modo demo de "agendar visita" sin navegador.
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
const { DEFAULT_VISIT_SETTINGS, DEFAULT_WEEKLY_SCHEDULE } = await import("./visitSlots");

const property = PROPERTIES.find((p) => (p.advisor_ids || []).length > 0 && p.active && p.status !== "vendida");
const advisorId = property.advisor_ids[0];
const person = { name: "Ana Pérez", email: "ana@correo.com", phone: "871 123 4567" };

async function activateSchedule(id = advisorId) {
  await db.saveAdvisorVisitSchedule(id, { settings: { ...DEFAULT_VISIT_SETTINGS, enabled: true }, weekly: DEFAULT_WEEKLY_SCHEDULE });
}

beforeEach(() => store.clear());

describe("modo demo: horario del asesor", () => {
  it("sin guardar nada la reserva está desactivada y no hay horarios", async () => {
    const schedule = await db.getAdvisorVisitSchedule(advisorId);
    expect(schedule.settings.enabled).toBe(false);
    expect(schedule.weekly).toEqual([]);
    expect(await db.getVisitSlots(property.id)).toEqual([]);
  });

  it("al guardar el horario se ofrecen horarios y se recortan los datos inválidos", async () => {
    const saved = await db.saveAdvisorVisitSchedule(advisorId, {
      settings: { enabled: true, slot_minutes: 77, horizon_days: 999 },
      weekly: [...DEFAULT_WEEKLY_SCHEDULE, { weekday: 0, start_time: "12:00", end_time: "10:00" }],
    });
    expect(saved.settings).toMatchObject({ slot_minutes: 60, horizon_days: 60 });
    expect(saved.weekly).toHaveLength(6); // la ventana al revés se descartó
    expect((await db.getVisitSlots(property.id)).length).toBeGreaterThan(10);
  });
});

describe("modo demo: reservar, mover y cancelar", () => {
  it("reserva un horario libre y crea la cita, el mensaje y el token", async () => {
    await activateSchedule();
    const [slot] = await db.getVisitSlots(property.id);
    const result = await db.bookVisit({ propertyId: property.id, ...slot, ...person, note: "llevo a mi familia" });

    expect(result.ok).toBe(true);
    expect(result.token).toMatch(/^[0-9a-f]{32}$/);
    expect(result.advisor.id).toBe(advisorId);

    const [cita] = await db.getAgendaCitas();
    expect(cita).toMatchObject({ source: "sitio", status: "confirmada", fecha: slot.fecha, hora: slot.hora, property_id: property.id, contact_phone: person.phone });
    const messages = await db.getContactMessages();
    expect(messages[0]).toMatchObject({ channel: "visita", property_id: property.id });
    expect(messages[0].message).toContain("Visita agendada");
  });

  it("el horario reservado deja de ofrecerse y nadie más lo puede tomar", async () => {
    await activateSchedule();
    const [slot] = await db.getVisitSlots(property.id);
    await db.bookVisit({ propertyId: property.id, ...slot, ...person });

    expect(await db.getVisitSlots(property.id)).not.toContainEqual(slot);
    const other = await db.bookVisit({ propertyId: property.id, ...slot, name: "Luis", email: "luis@correo.com", phone: "871 999 0000" });
    expect(other).toEqual({ error: "slot_unavailable" });
  });

  it("valida los datos y limita a 2 visitas activas por teléfono", async () => {
    await activateSchedule();
    const [s1, s2, s3] = await db.getVisitSlots(property.id);
    expect(await db.bookVisit({ propertyId: property.id, ...s1, ...person, email: "mal" })).toEqual({ error: "invalid_email" });
    expect((await db.bookVisit({ propertyId: property.id, ...s1, ...person })).ok).toBe(true);
    expect((await db.bookVisit({ propertyId: property.id, ...s2, ...person })).ok).toBe(true);
    expect(await db.bookVisit({ propertyId: property.id, ...s3, ...person })).toEqual({ error: "too_many_active" });
  });

  it("limita los intentos por teléfono a 5 por hora", async () => {
    await activateSchedule();
    const [slot] = await db.getVisitSlots(property.id);
    for (let i = 0; i < 5; i++) await db.bookVisit({ propertyId: property.id, fecha: slot.fecha, hora: "03:00", ...person });
    expect(await db.bookVisit({ propertyId: property.id, ...slot, ...person })).toEqual({ error: "rate_limited" });
  });

  it("no agenda en una propiedad que no existe ni en un horario fuera de ventana", async () => {
    await activateSchedule();
    const [slot] = await db.getVisitSlots(property.id);
    expect(await db.bookVisit({ propertyId: "nada", ...slot, ...person })).toEqual({ error: "property_unavailable" });
    expect(await db.bookVisit({ propertyId: property.id, fecha: slot.fecha, hora: "03:00", ...person })).toEqual({ error: "slot_unavailable" });
  });

  it("get_booking, reprogramar (libera el horario viejo), confirmar asistencia y tope de 2 cambios", async () => {
    await activateSchedule();
    const slots = await db.getVisitSlots(property.id);
    const { token } = await db.bookVisit({ propertyId: property.id, ...slots[0], ...person });

    const booking = await db.getVisitBooking(token);
    expect(booking).toMatchObject({ status: "confirmada", client_name: "Ana", can_reschedule: true, can_cancel: true, can_confirm: true });
    expect(booking).not.toHaveProperty("contact_phone");

    expect(await db.confirmVisitAttendance(token)).toEqual({ ok: true });
    expect((await db.getVisitBooking(token)).can_confirm).toBe(false);

    expect(await db.rescheduleVisitBooking(token, slots[5].fecha, slots[5].hora)).toMatchObject({ ok: true, reschedule_count: 1 });
    expect(await db.getVisitSlots(property.id)).toContainEqual(slots[0]); // el viejo quedó libre
    expect((await db.getVisitBooking(token)).can_confirm).toBe(true); // otra cita: se vuelve a pedir
    expect(await db.rescheduleVisitBooking(token, slots[0].fecha, slots[0].hora)).toMatchObject({ ok: true, reschedule_count: 2 });
    expect(await db.rescheduleVisitBooking(token, slots[6].fecha, slots[6].hora)).toEqual({ error: "limit_reached" });
  });

  it("no se puede mover a un horario ocupado por otra cita", async () => {
    await activateSchedule();
    const slots = await db.getVisitSlots(property.id);
    const { token } = await db.bookVisit({ propertyId: property.id, ...slots[0], ...person });
    await db.bookVisit({ propertyId: property.id, ...slots[3], name: "Luis", email: "l@c.co", phone: "871 000 1111" });
    expect(await db.rescheduleVisitBooking(token, slots[3].fecha, slots[3].hora)).toEqual({ error: "slot_unavailable" });
  });

  it("cancelar libera el horario y deja la cita cancelada; no se cancela dos veces", async () => {
    await activateSchedule();
    const [slot] = await db.getVisitSlots(property.id);
    const { token } = await db.bookVisit({ propertyId: property.id, ...slot, ...person });

    expect(await db.cancelVisitBooking(token, "Surgió un imprevisto")).toEqual({ ok: true });
    const [cita] = await db.getAgendaCitas();
    expect(cita).toMatchObject({ status: "cancelada", cancelled_by: "cliente", cancelled_reason: "Surgió un imprevisto" });
    expect(await db.getVisitSlots(property.id)).toContainEqual(slot);
    expect(await db.cancelVisitBooking(token)).toEqual({ error: "not_active" });
    expect(await db.confirmVisitAttendance(token)).toEqual({ error: "not_active" });
  });

  it("tokens inválidos o inexistentes", async () => {
    expect(await db.getVisitBooking("abc")).toEqual({ status: "invalido" });
    expect(await db.getVisitBooking("0".repeat(32))).toEqual({ status: "invalido" });
    expect(await db.cancelVisitBooking("0".repeat(32))).toEqual({ error: "not_found" });
    expect(await db.rescheduleVisitBooking("abc", "2026-11-05", "10:00")).toEqual({ error: "not_found" });
  });
});

describe("modo demo: gestión desde /visita/:token", () => {
  async function bookFirst() {
    await activateSchedule();
    const slots = await db.getVisitSlots(property.id);
    const result = await db.bookVisit({ propertyId: property.id, ...slots[0], ...person });
    return { slots, token: result.token, first: slots[0] };
  }
  const changeMessages = async () => (await db.getContactMessages()).filter((m) => m.channel === "visita_cambio");

  it("getBookingSlots trae solo los horarios del asesor de la visita (la ficha mezcla a todos) y libera el propio", async () => {
    const otherAdvisor = property.advisor_ids.find((id) => id !== advisorId);
    expect(otherAdvisor, "la propiedad de prueba debe tener dos asesores").toBeTruthy();
    // El otro asesor solo atiende los domingos; el principal, lun–sáb.
    await db.saveAdvisorVisitSchedule(otherAdvisor, { settings: { ...DEFAULT_VISIT_SETTINGS, enabled: true }, weekly: [{ weekday: 0, start_time: "10:00", end_time: "12:00" }] });
    const { token, first } = await bookFirst();

    const own = await db.getBookingSlots(token);
    const all = await db.getVisitSlots(property.id);
    const sunday = (slot) => new Date(`${slot.fecha}T12:00:00Z`).getUTCDay() === 0;
    expect(all.some(sunday), "la unión de la ficha sí trae domingos").toBe(true);
    expect(own.some(sunday), "los del asesor de la visita no").toBe(false);
    expect(own).toContainEqual(first); // su propio horario aparece libre
    expect(all).not.toContainEqual(first); // en la ficha ya está ocupado
  });

  it("getBookingSlots devuelve vacío con token inválido, inexistente o ya cancelada", async () => {
    const { token } = await bookFirst();
    expect(await db.getBookingSlots("abc")).toEqual([]);
    expect(await db.getBookingSlots("0".repeat(32))).toEqual([]);
    await db.cancelVisitBooking(token);
    expect(await db.getBookingSlots(token)).toEqual([]);
  });

  it("reprogramar le avisa al asesor (mensaje canal visita_cambio con antes y ahora)", async () => {
    const { token, slots, first } = await bookFirst();
    const target = slots[5];
    await db.rescheduleVisitBooking(token, target.fecha, target.hora);
    const [notice, ...rest] = await changeMessages();
    expect(rest).toEqual([]);
    expect(notice).toMatchObject({ name: "Ana Pérez", phone: person.phone, property_id: property.id, status: "nuevo", details: { kind: "reprogramada" } });
    const dmy = (f) => f.split("-").reverse().join("/");
    expect(notice.message).toContain("Visita reprogramada por el cliente");
    expect(notice.message).toContain(`Antes: ${dmy(first.fecha)} a las ${first.hora}`);
    expect(notice.message).toContain(`Ahora: ${dmy(target.fecha)} a las ${target.hora}`);
  });

  it("cancelar avisa con el motivo y con la fecha vigente; confirmar asistencia no avisa", async () => {
    const { token, slots } = await bookFirst();
    await db.confirmVisitAttendance(token);
    expect(await changeMessages()).toEqual([]);

    await db.rescheduleVisitBooking(token, slots[4].fecha, slots[4].hora);
    await db.cancelVisitBooking(token, "Surgió un imprevisto");
    const notices = await changeMessages();
    expect(notices.map((n) => n.details.kind).sort()).toEqual(["cancelada", "reprogramada"]);
    const cancel = notices.find((n) => n.details.kind === "cancelada");
    expect(cancel.message).toContain(`Era el ${slots[4].fecha.split("-").reverse().join("/")} a las ${slots[4].hora}`);
    expect(cancel.message).toContain("Motivo: Surgió un imprevisto");
  });

  it("los intentos rechazados (cancelar dos veces, reprogramar a un horario ocupado) no generan avisos", async () => {
    const { token, slots } = await bookFirst();
    await db.bookVisit({ propertyId: property.id, ...slots[3], name: "Luis", email: "l@c.co", phone: "871 000 1111" });
    expect(await db.rescheduleVisitBooking(token, slots[3].fecha, slots[3].hora)).toEqual({ error: "slot_unavailable" });
    await db.cancelVisitBooking(token);
    expect(await db.cancelVisitBooking(token)).toEqual({ error: "not_active" });
    expect(await changeMessages()).toHaveLength(1); // solo la primera cancelación
  });
});
