// Agendar visita con horarios reales — lógica pura (sin React ni Supabase).
//
// La fuente de verdad en producción son las funciones SQL get_visit_slots /
// book_visit / reschedule_booking / cancel_booking de supabase/schema.sql
// (bloque "Agendar visita con horarios reales"). Este archivo hace lo mismo
// en JavaScript para tres cosas: el modo demo (localBackend), las pruebas
// automáticas y la interfaz (agrupar horarios por día, saber si una cita
// todavía se puede mover). Si cambia una regla aquí, cambia también en SQL.
//
// Todo se calcula en hora de México (America/Mexico_City): el servidor y
// los navegadores pueden estar en otra zona, y "hoy" o "dentro de 2 horas"
// tienen que significar lo mismo para todos. Las fechas viajan como
// "YYYY-MM-DD" y las horas como "HH:MM" (la base devuelve "HH:MM:SS").

export const OFFICE_TIMEZONE = "America/Mexico_City";

// Semana en formato JS/Postgres: 0 = domingo … 6 = sábado.
export const DEFAULT_WEEKLY_SCHEDULE = [1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, start_time: "10:00", end_time: "18:00" }));

export const DEFAULT_VISIT_SETTINGS = Object.freeze({
  enabled: true,
  slot_minutes: 60,
  min_notice_hours: 2,
  horizon_days: 14,
});

export const SLOT_MINUTE_OPTIONS = [30, 45, 60, 90, 120];
export const MAX_HORIZON_DAYS = 60;
// Reglas de la página de gestión de la cita (/visita/:token).
export const MIN_HOURS_TO_RESCHEDULE = 2;
export const MAX_RESCHEDULES = 2;
export const MAX_ACTIVE_BOOKINGS_PER_PHONE = 2;

// Enlace secreto de la visita (/visita/:token): 32 caracteres hexadecimales.
export const BOOKING_TOKEN_PATTERN = /^[0-9a-f]{32}$/;

export function generateBookingToken() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// Ajustes + ventanas semanales + descansos en la forma que guarda la base.
// Recorta lo inválido (ventanas al revés, duración fuera de catálogo…).
export function normalizeVisitSchedule({ settings, weekly = [], timeOff = [] } = {}) {
  const base = { ...DEFAULT_VISIT_SETTINGS, ...(settings || {}) };
  const slotMinutes = SLOT_MINUTE_OPTIONS.includes(Number(base.slot_minutes)) ? Number(base.slot_minutes) : DEFAULT_VISIT_SETTINGS.slot_minutes;
  const clamp = (value, min, max, fallback) => (Number.isFinite(Number(value)) ? Math.min(Math.max(Math.round(Number(value)), min), max) : fallback);
  return {
    settings: {
      enabled: Boolean(base.enabled),
      slot_minutes: slotMinutes,
      min_notice_hours: clamp(base.min_notice_hours, 0, 168, DEFAULT_VISIT_SETTINGS.min_notice_hours),
      horizon_days: clamp(base.horizon_days, 1, MAX_HORIZON_DAYS, DEFAULT_VISIT_SETTINGS.horizon_days),
    },
    weekly: weekly
      .map((w) => ({ weekday: Number(w.weekday), start_time: hhmm(w.start_time), end_time: hhmm(w.end_time) }))
      .filter((w) => Number.isInteger(w.weekday) && w.weekday >= 0 && w.weekday <= 6 && toMinutes(w.end_time) > toMinutes(w.start_time)),
    timeOff: timeOff
      .filter((o) => o.fecha_inicio && o.fecha_fin && o.fecha_fin >= o.fecha_inicio)
      .map((o) => ({ fecha_inicio: o.fecha_inicio, fecha_fin: o.fecha_fin, motivo: String(o.motivo ?? "").trim() || null })),
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// "10:30" | "10:30:00" → minutos desde medianoche. NaN si no es una hora.
export function toMinutes(time) {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(String(time ?? "").trim());
  if (!match) return NaN;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return NaN;
  return hours * 60 + minutes;
}

export function fromMinutes(total) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// "HH:MM:SS" → "HH:MM" (lo que muestra la interfaz); vacío si no hay hora.
export function hhmm(time) {
  return time ? String(time).slice(0, 5) : "";
}

// Fecha y hora de pared en México para un instante dado.
export function mexicoParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: OFFICE_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type).value;
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  return { date, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

// Suma días a "YYYY-MM-DD" sin pasar por la zona horaria del navegador.
export function addDays(date, days) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// 0 = domingo … 6 = sábado.
export function weekdayOf(date) {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

// Minutos transcurridos desde una fecha base "absoluta" de pared — sirve para
// comparar dos (fecha, hora) sin crear Dates en la zona del navegador.
function wallMinutes(date, minutes) {
  return Math.round(new Date(`${date}T00:00:00Z`).getTime() / 60000) + minutes;
}

function isActive(cita) {
  return (cita.status || "confirmada") !== "cancelada";
}

function overlaps(startA, endA, startB, endB) {
  return startA < endB && endA > startB;
}

function busyIntervals(citas, advisorId, date, excludeCitaId) {
  return citas
    .filter((c) => c.advisor_id === advisorId && c.fecha === date && c.hora && isActive(c) && c.id !== excludeCitaId)
    .map((c) => {
      const start = toMinutes(c.hora);
      return [start, start + (Number(c.duracion_min) || 60)];
    });
}

/**
 * Horarios libres de UN asesor entre `from` y `to` (ambos "YYYY-MM-DD", inclusive).
 * Devuelve [{ fecha, hora }] ordenados. Misma regla que visit_free_slots() en SQL:
 *  - solo si el asesor tiene la reserva activada y ventanas de atención ese día;
 *  - nada antes de "ahora + anticipación mínima" ni más allá del horizonte;
 *  - se saltan los días de descanso y lo que choque con una cita no cancelada.
 */
export function generateSlots({
  settings,
  availability = [],
  timeOff = [],
  citas = [],
  advisorId,
  from,
  to,
  now = new Date(),
  excludeCitaId = null,
}) {
  if (!settings || settings.enabled === false) return [];
  const slotMinutes = Number(settings.slot_minutes) || DEFAULT_VISIT_SETTINGS.slot_minutes;
  const notice = Number(settings.min_notice_hours ?? DEFAULT_VISIT_SETTINGS.min_notice_hours);
  const horizon = Math.min(Number(settings.horizon_days) || DEFAULT_VISIT_SETTINGS.horizon_days, MAX_HORIZON_DAYS);

  const nowMx = mexicoParts(now);
  const earliest = wallMinutes(nowMx.date, nowMx.minutes) + notice * 60;
  const first = from > nowMx.date ? from : nowMx.date;
  const lastAllowed = addDays(nowMx.date, horizon);
  const last = to < lastAllowed ? to : lastAllowed;

  const slots = [];
  for (let date = first; date <= last; date = addDays(date, 1)) {
    if (timeOff.some((o) => o.fecha_inicio <= date && date <= o.fecha_fin)) continue;
    const weekday = weekdayOf(date);
    const windows = availability
      .filter((w) => w.weekday === weekday)
      .map((w) => [toMinutes(w.start_time), toMinutes(w.end_time)])
      .filter(([start, end]) => Number.isFinite(start) && Number.isFinite(end) && end > start)
      .sort((a, b) => a[0] - b[0]);
    if (windows.length === 0) continue;
    const busy = busyIntervals(citas, advisorId, date, excludeCitaId);
    for (const [start, end] of windows) {
      for (let t = start; t + slotMinutes <= end; t += slotMinutes) {
        if (wallMinutes(date, t) < earliest) continue;
        if (busy.some(([bs, be]) => overlaps(t, t + slotMinutes, bs, be))) continue;
        slots.push({ fecha: date, hora: fromMinutes(t) });
      }
    }
  }
  return slots;
}

// Une los horarios de varios asesores sin repetir (fecha, hora). Es lo que ve
// el visitante: no sabe ni le importa con cuál asesor se va a agendar.
export function mergeSlots(listsOfSlots) {
  const seen = new Set();
  const merged = [];
  for (const slot of listsOfSlots.flat()) {
    const key = `${slot.fecha} ${slot.hora}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(slot);
  }
  return merged.sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
}

// [{fecha, hora}] → [{ fecha, horas: ["10:00", …] }] para pintar día por día.
export function groupSlotsByDate(slots) {
  const byDate = new Map();
  for (const { fecha, hora } of slots) {
    if (!byDate.has(fecha)) byDate.set(fecha, []);
    byDate.get(fecha).push(hora);
  }
  return [...byDate.entries()].map(([fecha, horas]) => ({ fecha, horas }));
}

// Entre varios asesores libres en el mismo horario, el que menos citas
// activas tiene ese día; si empatan, el de menor id (resultado estable).
export function pickAdvisor(candidateIds, citas, date) {
  const load = (id) => citas.filter((c) => c.advisor_id === id && c.fecha === date && isActive(c)).length;
  return [...candidateIds].sort((a, b) => load(a) - load(b) || String(a).localeCompare(String(b)))[0] ?? null;
}

// Datos que captura el visitante. Devuelve el código de error o null. Los
// mismos códigos que regresa book_visit() en SQL.
export function validateBookingInput(input = {}) {
  const errors = bookingFieldErrors(input);
  return errors.name || errors.email || errors.phone || errors.note || null;
}

// Igual que validateBookingInput pero con TODOS los campos inválidos a la vez
// ({ name?, email?, phone?, note? } → código): la pantalla los marca juntos.
export function bookingFieldErrors({ name, email, phone, note } = {}) {
  const errors = {};
  const cleanName = String(name ?? "").trim();
  if (!cleanName || cleanName.length > 120) errors.name = "invalid_name";
  if (!EMAIL_RE.test(String(email ?? "").trim())) errors.email = "invalid_email";
  const digits = phoneDigits(phone);
  if (digits.length < 10 || digits.length > 15) errors.phone = "invalid_phone";
  if (String(note ?? "").length > 500) errors.note = "invalid_note";
  return errors;
}

export function phoneDigits(phone) {
  return String(phone ?? "").replace(/\D/g, "");
}

// Los últimos 10 dígitos identifican un teléfono mexicano con o sin lada de país.
export function samePhone(a, b) {
  const da = phoneDigits(a).slice(-10);
  return da.length === 10 && da === phoneDigits(b).slice(-10);
}

// ¿Cuántas citas futuras sigue teniendo activas este teléfono desde el sitio?
export function activeBookingsForPhone(citas, phone, now = new Date()) {
  const today = mexicoParts(now).date;
  return citas.filter((c) => c.source === "sitio" && isActive(c) && (c.status || "confirmada") === "confirmada" && c.fecha >= today && samePhone(c.contact_phone, phone)).length;
}

/**
 * ¿Qué puede hacer el cliente con su cita desde el enlace? Mismas reglas que
 * reschedule_booking / cancel_booking en SQL: reprogramar pide 2 h de aviso y
 * máximo 2 cambios; cancelar se puede hasta el momento de la cita.
 */
export function bookingPermissions(cita, now = new Date()) {
  if (!cita || (cita.status || "confirmada") !== "confirmada" || !cita.hora) {
    return { canReschedule: false, canCancel: false, canConfirm: false };
  }
  const nowMx = mexicoParts(now);
  const minutesUntil = wallMinutes(cita.fecha, toMinutes(cita.hora)) - wallMinutes(nowMx.date, nowMx.minutes);
  const upcoming = minutesUntil > 0;
  return {
    canReschedule: minutesUntil >= MIN_HOURS_TO_RESCHEDULE * 60 && (Number(cita.reschedule_count) || 0) < MAX_RESCHEDULES,
    canCancel: upcoming,
    canConfirm: upcoming && !cita.client_confirmed_at,
  };
}

// ── Editor de horarios del asesor ──

export const WEEK_DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // lunes primero

// [{weekday, start_time, end_time}] → { 0: [...], … , 6: [...] } con las ventanas de cada día.
export function weeklyToDays(weekly = []) {
  const days = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  for (const w of weekly) {
    if (days[w.weekday]) days[w.weekday].push({ start_time: hhmm(w.start_time), end_time: hhmm(w.end_time) });
  }
  for (const list of Object.values(days)) list.sort((a, b) => a.start_time.localeCompare(b.start_time));
  return days;
}

export function daysToWeekly(days) {
  return WEEK_DISPLAY_ORDER.flatMap((weekday) => (days[weekday] || []).map((w) => ({ weekday, start_time: w.start_time, end_time: w.end_time })));
}

/**
 * Problemas del horario que impiden guardarlo. Cada uno trae `code` y el día:
 *  - invalid_window: falta una hora o el fin no es después del inicio;
 *  - overlap: dos ventanas del mismo día se empalman;
 *  - invalid_time_off: un descanso sin fechas o con el fin antes del inicio.
 */
export function findScheduleIssues({ weekly = [], timeOff = [] } = {}) {
  const issues = [];
  const days = weeklyToDays(weekly);
  for (const weekday of WEEK_DISPLAY_ORDER) {
    const windows = days[weekday];
    if (windows.some((w) => !(toMinutes(w.end_time) > toMinutes(w.start_time)))) {
      issues.push({ code: "invalid_window", weekday });
      continue;
    }
    let latestEnd = -1;
    for (const w of windows) {
      if (toMinutes(w.start_time) < latestEnd) {
        issues.push({ code: "overlap", weekday });
        break;
      }
      latestEnd = Math.max(latestEnd, toMinutes(w.end_time));
    }
  }
  timeOff.forEach((o, index) => {
    if (!o.fecha_inicio || !o.fecha_fin || o.fecha_fin < o.fecha_inicio) issues.push({ code: "invalid_time_off", index });
  });
  return issues;
}

// Texto con el que queda registrada la visita en el inbox de Mensajes.
export function buildBookingMessage({ title, code, fecha, hora, note }) {
  const label = code ? `${String(title).trim()} (${code})` : String(title).trim();
  const date = new Date(`${fecha}T12:00:00Z`).toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  let message = `Visita agendada — ${label}.\nFecha: ${date} a las ${hhmm(hora)}`;
  if (String(note ?? "").trim()) message += `\nNota: ${String(note).trim()}`;
  return message;
}
