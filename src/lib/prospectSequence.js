// Secuencia de seguimiento sugerida: el primer contacto y tres seguimientos más (al día 1, 3 y 7 de que llegó el prospecto),
// para que ninguno se quede a medias. El sistema NO manda los mensajes solo: dice qué paso toca, cuándo y con qué texto
// (un toque para abrir WhatsApp ya escrito), y lo cuenta cuando el asesor registra el contacto.
//
// Cuenta de pasos: los contactos registrados con el prospecto (llamada, WhatsApp, correo, en persona). Se detiene sola cuando
// el prospecto avanza más allá de «contactado» (respondió y ya hay algo concreto: interesado, negociación, cerrado o perdido).
import { addDaysISO, todayISO } from "./prospects";

export const SEQUENCE_STEPS = [
  { key: "first", day: 0 },
  { key: "day1", day: 1 },
  { key: "day3", day: 3 },
  { key: "day7", day: 7 },
];
const ACTIVE_STAGES = ["nuevo", "contactado"];
// Solo prospectos recientes: uno más viejo ya es asunto del aviso de «olvidados», y su historial de contactos no se consulta completo.
export const SEQUENCE_WINDOW_DAYS = 30;

const dateOf = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

/**
 * → null (no aplica) o { state: "due" | "upcoming" | "finished", index, total, step, dueOn, daysLate }
 *   due: ya toca (o se pasó); upcoming: toca más adelante (dueOn); finished: ya se hicieron los cuatro pasos.
 * `contactCount`: cuántos contactos se han registrado con este prospecto.
 */
export function sequenceState(prospect, { contactCount = 0, now = new Date() } = {}) {
  if (!ACTIVE_STAGES.includes(prospect.stage)) return null;
  const created = dateOf(prospect.created_at);
  if (!created) return null;
  if (now - created > SEQUENCE_WINDOW_DAYS * 86400000) return null;
  const done = Math.max(0, Math.floor(Number(contactCount) || 0));
  if (done >= SEQUENCE_STEPS.length) return { state: "finished", index: SEQUENCE_STEPS.length, total: SEQUENCE_STEPS.length, step: null, dueOn: null, daysLate: 0 };

  const step = SEQUENCE_STEPS[done];
  const dueOn = addDaysISO(step.day, created);
  const today = todayISO(now);
  const late = Math.round((dateOf(today) - dateOf(dueOn)) / 86400000);
  return { state: late >= 0 ? "due" : "upcoming", index: done, total: SEQUENCE_STEPS.length, step, dueOn, daysLate: Math.max(0, late) };
}

// Cuántos contactos hay por prospecto, a partir de las filas del historial ([{ prospecto_id }]).
export function contactCounts(rows) {
  const counts = new Map();
  for (const row of rows || []) {
    if (row?.prospecto_id) counts.set(row.prospecto_id, (counts.get(row.prospecto_id) || 0) + 1);
  }
  return counts;
}

// El mensaje del paso, con las plantillas de i18n (`sequence.messages.<paso>`).
export function sequenceMessage(t, step, { name = "", propertyTitle = "", advisorName = "" } = {}) {
  const first = String(name).trim().split(/\s+/)[0] || "";
  // Sin propiedad de interés el primer mensaje no la menciona.
  const key = step.key === "first" && !propertyTitle ? "firstGeneric" : step.key;
  return t(`sequence.messages.${key}`, { name: first, property: propertyTitle, advisor: advisorName, defaultValue: "" });
}
