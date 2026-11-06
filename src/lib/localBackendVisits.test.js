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
    const sameSlot = (slot) => slot.fecha === first.fecha && slot.hora === first.hora;
    expect(own.some(sameSlot)).toBe(true); // su propio horario aparece libre
    expect(all.some(sameSlot)).toBe(false); // en la ficha ya está ocupado
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

describe("modo demo: cierre del ciclo (prospecto)", () => {
  const dayAfter = (fecha) => new Date(new Date(`${fecha}T12:00:00Z`).getTime() + 86400000).toISOString().slice(0, 10);
  const prospectsOf = async () => db.getProspects();

  async function book(slotIndex, who = person) {
    await activateSchedule();
    const slots = await db.getVisitSlots(property.id);
    const slot = slots[slotIndex];
    const result = await db.bookVisit({ propertyId: property.id, ...slot, ...who, note: "voy con mi esposo" });
    return { slot, slots, result, cita: (await db.getAgendaCitas()).find((c) => c.booking_token === result.token) };
  }

  it("reservar crea un prospecto interesado con seguimiento el día después de la visita, ligado a la cita", async () => {
    const { slot, cita } = await book(10);
    const prospects = await prospectsOf();
    expect(prospects).toHaveLength(1);
    expect(prospects[0]).toMatchObject({
      name: "Ana Pérez",
      phone: person.phone,
      email: person.email,
      source: "visita_agendada",
      stage: "interesado",
      advisor_id: advisorId,
      property_id: property.id,
      next_followup_at: dayAfter(slot.fecha),
    });
    expect(prospects[0].notes).toContain("Agendó una visita a");
    expect(prospects[0].notes).toContain("Nota: voy con mi esposo");
    expect(prospects[0].last_contact_at).toBeTruthy();
    expect(cita.prospecto_id).toBe(prospects[0].id);
  });

  it("una segunda reserva con el mismo teléfono (otro formato) reutiliza al prospecto y anota la visita", async () => {
    const first = await book(10);
    const slot2 = first.slots[20];
    const second = await db.bookVisit({ propertyId: property.id, ...slot2, name: "Ana P.", email: "otro@correo.com", phone: "+52 (871) 123-4567" });
    expect(second.ok).toBe(true);
    const prospects = await prospectsOf();
    expect(prospects).toHaveLength(1);
    expect(prospects[0].notes.split("\n")).toHaveLength(2);
    expect((await db.getAgendaCitas()).map((c) => c.prospecto_id)).toEqual([prospects[0].id, prospects[0].id]);
  });

  it("un prospecto abierto con ese correo se actualiza: nuevo → interesado, sin duplicar", async () => {
    const manual = await db.addProspect({ name: "Ana Manual", email: "ANA@correo.com", phone: null, stage: "nuevo", source: "manual", next_followup_at: "2020-01-01", property_id: null, advisor_id: null, notes: null });
    const { cita, slot } = await book(10);
    const prospects = await prospectsOf();
    expect(prospects).toHaveLength(1);
    expect(cita.prospecto_id).toBe(manual.id);
    expect(prospects[0]).toMatchObject({ stage: "interesado", next_followup_at: dayAfter(slot.fecha), property_id: property.id });
  });

  it("un prospecto ya cerrado no cuenta: se crea uno nuevo", async () => {
    await db.addProspect({ name: "Ana Cerrada", email: person.email, phone: person.phone, stage: "cerrado", source: "manual", notes: null });
    await book(10);
    const prospects = await prospectsOf();
    expect(prospects).toHaveLength(2);
    expect(prospects.find((p) => p.name === "Ana Cerrada").stage).toBe("cerrado");
  });

  it("reprogramar mueve el seguimiento automático, pero no uno que el asesor puso a mano", async () => {
    const { result, slots, cita } = await book(10);
    const token = result.token;
    const moved = slots[40];
    await db.rescheduleVisitBooking(token, moved.fecha, moved.hora);
    expect((await prospectsOf())[0].next_followup_at).toBe(dayAfter(moved.fecha));

    await db.updateProspect(cita.prospecto_id, { next_followup_at: "2030-01-01" }); // a mano
    const again = slots[60];
    await db.rescheduleVisitBooking(token, again.fecha, again.hora);
    expect((await prospectsOf())[0].next_followup_at).toBe("2030-01-01");
  });

  it("si el cliente cancela o no asiste, el seguimiento pasa a mañana (si seguía siendo el automático)", async () => {
    const { result } = await book(10);
    await db.cancelVisitBooking(result.token, "imprevisto");
    const tomorrow = dayAfter(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(new Date()));
    expect((await prospectsOf())[0].next_followup_at).toBe(tomorrow);

    // No asistió, marcado por el asesor desde la Agenda.
    const second = await db.bookVisit({ propertyId: property.id, ...(await db.getVisitSlots(property.id))[30], name: "Luis", email: "luis@correo.com", phone: "871 222 3333" });
    const cita = (await db.getAgendaCitas()).find((c) => c.booking_token === second.token);
    await db.setAgendaCitaStatus(cita.id, "no_asistio");
    const luis = (await prospectsOf()).find((p) => p.name === "Luis");
    expect(luis.next_followup_at).toBe(tomorrow);
  });

  it("marcar realizada no mueve el seguimiento (queda para llamar tras la visita)", async () => {
    const { cita, slot } = await book(10);
    await db.setAgendaCitaStatus(cita.id, "realizada");
    expect((await prospectsOf())[0].next_followup_at).toBe(dayAfter(slot.fecha));
  });

  it("una visita registrada desde la cita conserva el cita_id", async () => {
    const { cita } = await book(10);
    const visit = await db.addVisit({ property_id: property.id, advisor_id: advisorId, visited_at: new Date().toISOString(), interest: "interesado", reasons: [], cita_id: cita.id });
    expect((await db.getVisitById(visit.id)).cita_id).toBe(cita.id);
  });
});

