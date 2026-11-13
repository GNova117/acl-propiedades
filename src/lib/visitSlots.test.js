import { describe, expect, it } from "vitest";
import {
  DEFAULT_VISIT_SETTINGS,
  DEFAULT_WEEKLY_SCHEDULE,
  activeBookingsForPhone,
  advisorsForSlot,
  buildRequestMessage,
  requestSlotError,
  bookingFieldErrors,
  buildBookingChangeMessage,
  addDays,
  bookingPermissions,
  buildBookingMessage,
  buildFeedbackMessage,
  canGiveFeedback,
  daysToWeekly,
  findScheduleIssues,
  generateSlots,
  groupSlotsByDate,
  mergeSlots,
  mexicoParts,
  pickAdvisor,
  samePhone,
  normalizeVisitSchedule,
  toMinutes,
  validateBookingInput,
  weekdayOf,
  weeklyToDays,
} from "./visitSlots";

// Lunes 2026-11-02 08:00 en México (UTC-6, sin horario de verano) = 14:00 UTC.
const MONDAY_8AM = new Date("2026-11-02T14:00:00Z");
const settings = { ...DEFAULT_VISIT_SETTINGS };
const availability = DEFAULT_WEEKLY_SCHEDULE; // lun–sáb 10–18, citas de 60 min

const slotsFor = (overrides = {}) =>
  generateSlots({ settings, availability, advisorId: "a1", from: "2026-11-02", to: "2026-11-02", now: MONDAY_8AM, ...overrides });

describe("fechas y horas", () => {
  it("toMinutes entiende HH:MM y HH:MM:SS y rechaza basura", () => {
    expect(toMinutes("10:30")).toBe(630);
    expect(toMinutes("10:30:00")).toBe(630);
    expect(Number.isNaN(toMinutes("25:00"))).toBe(true);
    expect(Number.isNaN(toMinutes(null))).toBe(true);
  });

  it("mexicoParts da la fecha de México aunque en UTC ya sea otro día", () => {
    // 2026-11-03 03:30 UTC = 2026-11-02 21:30 en México.
    expect(mexicoParts(new Date("2026-11-03T03:30:00Z"))).toEqual({ date: "2026-11-02", minutes: 21 * 60 + 30 });
  });

  it("addDays y weekdayOf no dependen de la zona del navegador", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(weekdayOf("2026-11-02")).toBe(1); // lunes
    expect(weekdayOf("2026-11-08")).toBe(0); // domingo
  });
});

describe("generateSlots", () => {
  it("un día normal trae 8 horarios de 10:00 a 17:00", () => {
    expect(slotsFor().map((s) => s.hora)).toEqual(["10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"]);
  });

  it("respeta la anticipación mínima: a las 9:30 con 2 h de aviso no sale el de las 10 ni el de las 11", () => {
    const now = new Date("2026-11-02T15:30:00Z"); // 9:30 en México
    expect(slotsFor({ now }).map((s) => s.hora)[0]).toBe("12:00");
  });

  it("el domingo no hay horarios (el default no incluye domingo)", () => {
    expect(slotsFor({ from: "2026-11-08", to: "2026-11-08" })).toEqual([]);
  });

  it("no ofrece nada pasado el horizonte ni antes de hoy", () => {
    const wide = slotsFor({ from: "2026-10-01", to: "2027-01-31" });
    expect(wide[0].fecha).toBe("2026-11-02");
    expect(wide[wide.length - 1].fecha <= "2026-11-16").toBe(true); // hoy + 14 días
  });

  it("usa 'hoy' de México: a las 21:30 locales (ya es mañana en UTC) hoy ya no tiene horarios", () => {
    const now = new Date("2026-11-03T03:30:00Z"); // lunes 21:30 en México
    expect(slotsFor({ now })).toEqual([]);
  });

  it("una cita existente bloquea su hora y también las que se traslapan", () => {
    const citas = [{ id: "c1", advisor_id: "a1", fecha: "2026-11-02", hora: "11:30:00", duracion_min: 60, status: "confirmada" }];
    const horas = slotsFor({ citas }).map((s) => s.hora);
    expect(horas).not.toContain("11:00"); // 11:00–12:00 choca con 11:30–12:30
    expect(horas).not.toContain("12:00"); // 12:00–13:00 también
    expect(horas).toContain("10:00");
    expect(horas).toContain("13:00");
  });

  it("las citas canceladas, sin hora o de otro asesor no bloquean", () => {
    const citas = [
      { id: "c1", advisor_id: "a1", fecha: "2026-11-02", hora: "10:00", status: "cancelada" },
      { id: "c2", advisor_id: "a1", fecha: "2026-11-02", hora: null, status: "confirmada" },
      { id: "c3", advisor_id: "a2", fecha: "2026-11-02", hora: "11:00", status: "confirmada" },
    ];
    expect(slotsFor({ citas })).toHaveLength(8);
  });

  it("las citas viejas sin status cuentan como confirmadas", () => {
    const citas = [{ id: "c1", advisor_id: "a1", fecha: "2026-11-02", hora: "10:00" }];
    expect(slotsFor({ citas }).map((s) => s.hora)).not.toContain("10:00");
  });

  it("excludeCitaId libera la hora de la propia cita al reprogramarla", () => {
    const citas = [{ id: "mia", advisor_id: "a1", fecha: "2026-11-02", hora: "10:00", status: "confirmada" }];
    expect(slotsFor({ citas, excludeCitaId: "mia" }).map((s) => s.hora)).toContain("10:00");
  });

  it("los días de descanso se saltan completos", () => {
    const timeOff = [{ fecha_inicio: "2026-11-02", fecha_fin: "2026-11-03" }];
    expect(slotsFor({ timeOff, to: "2026-11-04" }).every((s) => s.fecha === "2026-11-04")).toBe(true);
  });

  it("slots de 90 min en una ventana de 10–18 caben cinco, el último termina a las 17:30", () => {
    const horas = slotsFor({ settings: { ...settings, slot_minutes: 90 } }).map((s) => s.hora);
    expect(horas).toEqual(["10:00", "11:30", "13:00", "14:30", "16:00"]);
  });

  it("con la reserva desactivada o sin ventanas no hay horarios", () => {
    expect(slotsFor({ settings: { ...settings, enabled: false } })).toEqual([]);
    expect(slotsFor({ availability: [] })).toEqual([]);
    expect(slotsFor({ settings: null })).toEqual([]);
  });

  it("varias ventanas el mismo día (mañana y tarde) dejan hueco en medio; el de las 9:00 ya no cumple las 2 h de aviso", () => {
    const split = [
      { weekday: 1, start_time: "09:00", end_time: "11:00" },
      { weekday: 1, start_time: "16:00", end_time: "18:00" },
    ];
    expect(slotsFor({ availability: split }).map((s) => s.hora)).toEqual(["10:00", "16:00", "17:00"]);
  });
});

describe("mergeSlots y groupSlotsByDate", () => {
  it("une asesores sin repetir horarios y ordena", () => {
    const merged = mergeSlots([
      [{ fecha: "2026-11-02", hora: "11:00" }, { fecha: "2026-11-02", hora: "10:00" }],
      [{ fecha: "2026-11-02", hora: "11:00" }, { fecha: "2026-11-03", hora: "09:00" }],
    ]);
    expect(merged).toEqual([
      { fecha: "2026-11-02", hora: "10:00" },
      { fecha: "2026-11-02", hora: "11:00" },
      { fecha: "2026-11-03", hora: "09:00" },
    ]);
  });

  it("agrupa por día conservando el orden", () => {
    expect(
      groupSlotsByDate([
        { fecha: "2026-11-02", hora: "10:00" },
        { fecha: "2026-11-02", hora: "11:00" },
        { fecha: "2026-11-03", hora: "10:00" },
      ])
    ).toEqual([
      { fecha: "2026-11-02", horas: ["10:00", "11:00"] },
      { fecha: "2026-11-03", horas: ["10:00"] },
    ]);
  });
});

describe("pickAdvisor", () => {
  const citas = [
    { advisor_id: "a1", fecha: "2026-11-02", status: "confirmada" },
    { advisor_id: "a1", fecha: "2026-11-02", status: "confirmada" },
    { advisor_id: "a2", fecha: "2026-11-02", status: "confirmada" },
    { advisor_id: "a2", fecha: "2026-11-02", status: "cancelada" },
  ];
  it("elige al de menos citas activas ese día", () => {
    expect(pickAdvisor(["a1", "a2"], citas, "2026-11-02")).toBe("a2");
  });
  it("en empate elige el de menor id y sin candidatos devuelve null", () => {
    expect(pickAdvisor(["b", "a"], [], "2026-11-02")).toBe("a");
    expect(pickAdvisor([], [], "2026-11-02")).toBeNull();
  });
});

describe("validateBookingInput", () => {
  const ok = { name: "Ana Pérez", email: "ana@correo.com", phone: "871 123 4567", note: "" };
  it("acepta datos válidos", () => {
    expect(validateBookingInput(ok)).toBeNull();
  });
  it("devuelve el primer campo inválido", () => {
    expect(validateBookingInput({ ...ok, name: "  " })).toBe("invalid_name");
    expect(validateBookingInput({ ...ok, email: "ana@" })).toBe("invalid_email");
    expect(validateBookingInput({ ...ok, phone: "12345" })).toBe("invalid_phone");
    expect(validateBookingInput({ ...ok, note: "x".repeat(501) })).toBe("invalid_note");
  });
});

describe("bookingFieldErrors", () => {
  it("devuelve todos los campos inválidos juntos y nada si todo está bien", () => {
    expect(bookingFieldErrors({ name: "", email: "x", phone: "1", note: "x".repeat(501) })).toEqual({
      name: "invalid_name",
      email: "invalid_email",
      phone: "invalid_phone",
      note: "invalid_note",
    });
    expect(bookingFieldErrors({ name: "Ana", email: "a@b.co", phone: "871 123 4567" })).toEqual({});
    expect(bookingFieldErrors({ name: "Ana", email: "a@b.co", phone: "123" })).toEqual({ phone: "invalid_phone" });
  });
});

describe("teléfonos y tope de citas activas", () => {
  it("samePhone ignora formato y lada de país", () => {
    expect(samePhone("871 123 4567", "+52 871-123-4567")).toBe(true);
    expect(samePhone("871 123 4567", "(871) 123 4567")).toBe(true);
    expect(samePhone("871 123 4567", "871 123 0000")).toBe(false);
    expect(samePhone("123", "123")).toBe(false);
  });

  it("cuenta solo citas del sitio, confirmadas y futuras de ese teléfono", () => {
    const citas = [
      { source: "sitio", status: "confirmada", fecha: "2026-11-05", contact_phone: "8711234567" },
      { source: "sitio", status: "confirmada", fecha: "2026-11-06", contact_phone: "(871) 123-4567" },
      { source: "sitio", status: "cancelada", fecha: "2026-11-07", contact_phone: "8711234567" },
      { source: "sitio", status: "confirmada", fecha: "2026-10-01", contact_phone: "8711234567" }, // ya pasó
      { source: "admin", status: "confirmada", fecha: "2026-11-08", contact_phone: "8711234567" },
      { source: "sitio", status: "confirmada", fecha: "2026-11-09", contact_phone: "8719999999" },
    ];
    expect(activeBookingsForPhone(citas, "871 123 4567", MONDAY_8AM)).toBe(2);
  });
});

describe("bookingPermissions", () => {
  const cita = { status: "confirmada", fecha: "2026-11-02", hora: "12:00:00", reschedule_count: 0 };

  it("con más de 2 h de aviso se puede reprogramar, cancelar y confirmar asistencia", () => {
    expect(bookingPermissions(cita, MONDAY_8AM)).toEqual({ canReschedule: true, canCancel: true, canConfirm: true });
  });

  it("a menos de 2 h ya no se reprograma, pero sí se cancela", () => {
    const now = new Date("2026-11-02T17:30:00Z"); // 11:30 en México
    expect(bookingPermissions(cita, now)).toMatchObject({ canReschedule: false, canCancel: true });
  });

  it("pasada la hora de la cita ya no se puede nada", () => {
    const now = new Date("2026-11-02T19:00:00Z"); // 13:00
    expect(bookingPermissions(cita, now)).toEqual({ canReschedule: false, canCancel: false, canConfirm: false });
  });

  it("tras 2 reprogramaciones ya no se mueve más; si ya confirmó asistencia no se vuelve a pedir", () => {
    expect(bookingPermissions({ ...cita, reschedule_count: 2 }, MONDAY_8AM).canReschedule).toBe(false);
    expect(bookingPermissions({ ...cita, client_confirmed_at: "2026-11-01T10:00:00Z" }, MONDAY_8AM).canConfirm).toBe(false);
  });

  it("una cita cancelada o sin hora no permite nada", () => {
    expect(bookingPermissions({ ...cita, status: "cancelada" }, MONDAY_8AM).canCancel).toBe(false);
    expect(bookingPermissions({ ...cita, hora: null }, MONDAY_8AM).canCancel).toBe(false);
    expect(bookingPermissions(null, MONDAY_8AM).canCancel).toBe(false);
  });
});

describe("buildBookingMessage", () => {
  it("arma el texto legible para el inbox", () => {
    const text = buildBookingMessage({ title: " Casa Lerdo ", code: "ACL-12", fecha: "2026-11-05", hora: "16:00:00", note: " llevo a mi esposa " });
    expect(text).toBe("Visita agendada — Casa Lerdo (ACL-12).\nFecha: jueves, 5 de noviembre de 2026 a las 16:00\nNota: llevo a mi esposa");
  });
  it("sin código ni nota va más corto", () => {
    expect(buildBookingMessage({ title: "Casa", fecha: "2026-11-05", hora: "09:00" })).toBe("Visita agendada — Casa.\nFecha: jueves, 5 de noviembre de 2026 a las 09:00");
  });
});

describe("editor de horarios", () => {
  it("weeklyToDays agrupa por día y ordena las ventanas; daysToWeekly regresa lunes primero", () => {
    const days = weeklyToDays([
      { weekday: 1, start_time: "16:00:00", end_time: "18:00:00" },
      { weekday: 1, start_time: "09:00", end_time: "13:00" },
      { weekday: 0, start_time: "10:00", end_time: "12:00" },
    ]);
    expect(days[1]).toEqual([
      { start_time: "09:00", end_time: "13:00" },
      { start_time: "16:00", end_time: "18:00" },
    ]);
    expect(days[2]).toEqual([]);
    expect(daysToWeekly(days).map((w) => `${w.weekday} ${w.start_time}`)).toEqual(["1 09:00", "1 16:00", "0 10:00"]);
  });

  it("el horario por omisión no tiene problemas", () => {
    expect(findScheduleIssues({ weekly: DEFAULT_WEEKLY_SCHEDULE })).toEqual([]);
  });

  it("detecta ventanas al revés, vacías o empalmadas, y descansos mal puestos", () => {
    const issues = findScheduleIssues({
      weekly: [
        { weekday: 1, start_time: "12:00", end_time: "10:00" },
        { weekday: 2, start_time: "10:00", end_time: "14:00" },
        { weekday: 2, start_time: "13:00", end_time: "15:00" },
        { weekday: 3, start_time: "10:00", end_time: "18:00" },
        { weekday: 3, start_time: "11:00", end_time: "12:00" },
        { weekday: 3, start_time: "13:00", end_time: "14:00" },
        { weekday: 4, start_time: "", end_time: "14:00" },
        { weekday: 5, start_time: "10:00", end_time: "12:00" },
        { weekday: 5, start_time: "12:00", end_time: "14:00" }, // pegadas pero sin empalme: válido
      ],
      timeOff: [{ fecha_inicio: "2026-11-10", fecha_fin: "2026-11-09" }, { fecha_inicio: "", fecha_fin: "2026-11-09" }, { fecha_inicio: "2026-11-10", fecha_fin: "2026-11-10" }],
    });
    expect(issues).toEqual([
      { code: "invalid_window", weekday: 1 },
      { code: "overlap", weekday: 2 },
      { code: "overlap", weekday: 3 },
      { code: "invalid_window", weekday: 4 },
      { code: "invalid_time_off", index: 0 },
      { code: "invalid_time_off", index: 1 },
    ]);
  });

  it("normalizeVisitSchedule recorta lo inválido y respeta lo válido", () => {
    const out = normalizeVisitSchedule({
      settings: { enabled: 1, slot_minutes: 45, min_notice_hours: -5, horizon_days: 0 },
      weekly: [{ weekday: 9, start_time: "10:00", end_time: "11:00" }, { weekday: 1, start_time: "10:00:00", end_time: "09:00" }, { weekday: 1, start_time: "10:00:00", end_time: "11:00:00" }],
      timeOff: [{ fecha_inicio: "2026-11-10", fecha_fin: "2026-11-12", motivo: "  Vacaciones " }, { fecha_inicio: "2026-11-10", fecha_fin: "2026-11-01" }],
    });
    expect(out.settings).toEqual({ enabled: true, slot_minutes: 45, min_notice_hours: 0, horizon_days: 1 });
    expect(out.weekly).toEqual([{ weekday: 1, start_time: "10:00", end_time: "11:00" }]);
    expect(out.timeOff).toEqual([{ fecha_inicio: "2026-11-10", fecha_fin: "2026-11-12", motivo: "Vacaciones" }]);
  });
});

describe("buildBookingChangeMessage", () => {
  it("la reprogramación dice cuándo era y cuándo es ahora", () => {
    expect(buildBookingChangeMessage({ kind: "reprogramada", title: " Casa Lerdo ", code: "ACL-12", oldFecha: "2026-11-05", oldHora: "16:00:00", fecha: "2026-11-07", hora: "10:30" })).toBe(
      "Visita reprogramada por el cliente — Casa Lerdo (ACL-12).\nAntes: 05/11/2026 a las 16:00\nAhora: 07/11/2026 a las 10:30"
    );
  });

  it("la cancelación lleva el motivo solo si lo hay", () => {
    expect(buildBookingChangeMessage({ kind: "cancelada", title: "Casa", oldFecha: "2026-11-05", oldHora: "16:00", reason: " Surgió un imprevisto " })).toBe(
      "Visita cancelada por el cliente — Casa.\nEra el 05/11/2026 a las 16:00\nMotivo: Surgió un imprevisto"
    );
    expect(buildBookingChangeMessage({ kind: "cancelada", title: "Casa", code: "ACL-1", oldFecha: "2026-11-05", oldHora: "16:00", reason: "  " })).toBe(
      "Visita cancelada por el cliente — Casa (ACL-1).\nEra el 05/11/2026 a las 16:00"
    );
  });
});

describe("solicitud de visita sin asesor", () => {
  // Lunes 2026-11-02 08:00 en México.
  const at = (fecha, hora) => requestSlotError(fecha, hora, MONDAY_8AM);

  it("pide fecha y hora, al menos 1 h adelante y a no más de 90 días (hora de México)", () => {
    expect(at("2026-11-02", "09:30")).toBe(null); // 1 h 30 min adelante
    expect(at("2026-11-02", "09:00")).toBe(null); // justo 1 h
    expect(at("2026-11-02", "08:59")).toBe("invalid_slot"); // falta menos de 1 h
    expect(at("2026-11-01", "20:00")).toBe("invalid_slot"); // ayer
    expect(at("2026-11-03", "")).toBe("invalid_slot");
    expect(at("", "10:00")).toBe("invalid_slot");
    expect(at("2026-11-03", "no es hora")).toBe("invalid_slot");
    expect(at("2027-01-31", "10:00")).toBe(null); // 90 días
    expect(at("2027-02-01", "10:00")).toBe("invalid_slot"); // 91 días
  });

  it("mergeSlots junta los asesores libres de cada horario, sin repetir y por nombre", () => {
    const ana = { id: "a1", name: "Ana", photo_url: null };
    const beto = { id: "a2", name: "Beto", photo_url: null };
    const merged = mergeSlots([
      [{ fecha: "2026-11-03", hora: "12:00", advisors: [beto] }, { fecha: "2026-11-03", hora: "10:00", advisors: [beto] }],
      [{ fecha: "2026-11-03", hora: "12:00", advisors: [ana] }, { fecha: "2026-11-03", hora: "12:00", advisors: [ana] }],
    ]);
    expect(merged.map((s) => s.hora)).toEqual(["10:00", "12:00"]);
    expect(advisorsForSlot(merged, "2026-11-03", "12:00").map((a) => a.name)).toEqual(["Ana", "Beto"]);
    expect(advisorsForSlot(merged, "2026-11-03", "10:00")).toEqual([beto]);
    expect(advisorsForSlot(merged, "2026-11-03", "15:00")).toEqual([]);
  });

  it("mergeSlots sigue funcionando con horarios sin asesores", () => {
    expect(mergeSlots([[{ fecha: "2026-11-03", hora: "10:00" }], [{ fecha: "2026-11-03", hora: "10:00" }]])).toEqual([{ fecha: "2026-11-03", hora: "10:00" }]);
  });

  it("una solicitud solo se puede cancelar (no mover ni confirmar) y cuenta como activa del teléfono", () => {
    const cita = { status: "solicitada", source: "sitio", advisor_id: null, fecha: "2026-11-05", hora: "16:00", contact_phone: "871 300 4000" };
    expect(bookingPermissions(cita, MONDAY_8AM)).toEqual({ canReschedule: false, canCancel: true, canConfirm: false });
    expect(bookingPermissions({ ...cita, fecha: "2026-11-01" }, MONDAY_8AM).canCancel).toBe(false); // ya pasó
    expect(activeBookingsForPhone([cita, { ...cita, status: "cancelada" }], "+52 871 300 4000", MONDAY_8AM)).toBe(1);
  });

  it("el mensaje de la solicitud (mismo texto que request_visit en SQL)", () => {
    expect(buildRequestMessage({ title: " Casa en Lerdo ", code: "ACL-12", fecha: "2026-11-05", hora: "19:30:00", note: " por la tarde " })).toBe(
      "Solicitud de visita sin asesor — Casa en Lerdo (ACL-12).\nFecha preferida: 05/11/2026 a las 19:30\nNota: por la tarde\nEstá en la Agenda de todos hasta que un asesor la tome."
    );
    expect(buildRequestMessage({ title: "Casa", fecha: "2026-11-05", hora: "10:00" })).not.toContain("Nota:");
  });
});

describe("canGiveFeedback", () => {
  // Las horas de pared son de México (UTC−6): 16:00Z = 10:00 allá.
  const now = new Date("2026-11-20T16:00:00Z");
  const cita = (over = {}) => ({ status: "confirmada", fecha: "2026-11-20", hora: "09:00", feedback_at: null, ...over });

  it("se puede una vez que la visita ya empezó", () => {
    expect(canGiveFeedback(cita(), now)).toEqual({ ok: true });
    expect(canGiveFeedback(cita({ status: "realizada" }), now)).toEqual({ ok: true });
  });

  it("antes de la hora todavía no", () => {
    expect(canGiveFeedback(cita({ hora: "11:00" }), now)).toEqual({ ok: false, reason: "too_early" });
    expect(canGiveFeedback(cita({ fecha: "2026-11-21" }), now)).toEqual({ ok: false, reason: "too_early" });
  });

  it("quien canceló, no llegó o solo solicitó no opina", () => {
    for (const status of ["cancelada", "no_asistio", "solicitada"]) expect(canGiveFeedback(cita({ status }), now)).toEqual({ ok: false, reason: "not_active" });
    expect(canGiveFeedback(null, now)).toEqual({ ok: false, reason: "not_active" });
  });

  it("pasados 30 días ya no, y solo una vez", () => {
    expect(canGiveFeedback(cita({ fecha: "2026-10-25" }), now)).toEqual({ ok: true });
    expect(canGiveFeedback(cita({ fecha: "2026-10-20" }), now)).toEqual({ ok: false, reason: "too_late" });
    expect(canGiveFeedback(cita({ feedback_at: "2026-11-20T17:00:00Z" }), now)).toEqual({ ok: false, reason: "already_sent" });
  });

  it("una cita sin hora cuenta desde el inicio de su día", () => {
    expect(canGiveFeedback(cita({ hora: null }), now)).toEqual({ ok: true });
  });
});

describe("buildFeedbackMessage", () => {
  it("lleva las estrellas, el comentario y el aviso de que quiere ver más", () => {
    const text = buildFeedbackMessage({ title: "Casa Lerdo", code: "ACL-1", rating: 4, comment: "  Muy bonita pero lejos  ", moreOptions: true });
    expect(text).toBe(
      "Opinión de la visita — Casa Lerdo (ACL-1).\nCalificación: ★★★★☆ (4 de 5)\nComentario: Muy bonita pero lejos\nQuiere ver más opciones: propónle un día para mostrarle otras propiedades."
    );
  });
  it("sin comentario ni «más opciones» solo trae la calificación", () => {
    expect(buildFeedbackMessage({ title: "Casa", rating: 1, comment: "", moreOptions: false })).toBe("Opinión de la visita — Casa.\nCalificación: ★☆☆☆☆ (1 de 5)");
  });
});
