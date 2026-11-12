// Línea de tiempo de un prospecto: todo lo que ha pasado con él en un solo historial por fecha —cuándo
// llegó, cada contacto, cada cambio de etapa, sus citas, sus visitas y las notas del equipo— con lo
// próximo (una cita que aún no ocurre) arriba. Funciones puras; la ficha solo las pinta.

import { citaStatus } from "./agendaCitas";
import { whatsappDigits } from "./format";

// La fecha en milisegundos, o null si falta o no es válida (new Date(null) daría 1970, no una fecha inválida).
const ms = (value) => {
  if (value == null || value === "") return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
};

// Los últimos 10 dígitos de un teléfono (sin lada de país): con esto se reconoce a la misma persona
// aunque lo hayan escrito distinto. null si no hay al menos 10 dígitos.
const phoneKey = (phone) => {
  const digits = whatsappDigits(phone);
  return digits.length >= 10 ? digits.slice(-10) : null;
};

// Cuándo ocurre una cita: su fecha y hora (sin hora, el inicio del día).
export const citaTime = (cita) => ms(`${cita.fecha}T${String(cita.hora || "00:00").slice(0, 5)}`);

// La cita es de este prospecto: ligada a él al agendarla, o de su cliente si ya lo es.
export const isProspectCita = (prospect, cita) =>
  cita.prospecto_id === prospect.id || Boolean(prospect.client_id && cita.client_id === prospect.client_id);

// La visita es de este prospecto: la de la que salió, la de una de sus citas, o una registrada con su mismo teléfono.
export function isProspectVisit(prospect, visit, citaIds = new Set()) {
  if (prospect.visit_id && visit.id === prospect.visit_id) return true;
  if (visit.cita_id && citaIds.has(visit.cita_id)) return true;
  const key = phoneKey(prospect.phone);
  return Boolean(key && phoneKey(visit.prospect_phone) === key);
}

// Un cambio de etapa dentro de la primera hora del alta es la etapa inicial, que ya cuenta «Capturado».
const INITIAL_STAGE_WINDOW_MS = 60 * 1000;

/**
 * Los eventos del prospecto, el más reciente (o más próximo) primero. Cada uno: { id, kind, at (ms), … }
 *   created     — { source }
 *   contact     — { channel, note, actor }
 *   stage       — { stage }
 *   appointment — { title, status, place, upcoming, citaId }
 *   visit       — { propertyId, interest, comments, visitId }
 *   note        — { body, author }
 * `stages`: el historial de etapas (de todos o de este prospecto); `citas`, `visits`: las listas completas
 * (se filtran aquí por las que son suyas); `notes`: las notas internas del prospecto.
 */
export function buildTimeline({ prospect, contacts = [], stages = [], citas = [], visits = [], notes = [], now = new Date() }) {
  const items = [];
  const created = ms(prospect.created_at);
  if (created != null) items.push({ id: "created", kind: "created", at: created, source: prospect.source });

  for (const c of contacts) {
    const at = ms(c.at);
    if (at != null) items.push({ id: `contact-${c.id}`, kind: "contact", at, channel: c.channel, note: c.note || "", actor: c.actor || "" });
  }

  const mine = stages
    .filter((s) => s.prospecto_id === prospect.id && ms(s.at) != null)
    .sort((a, b) => ms(a.at) - ms(b.at));
  mine.forEach((s, index) => {
    const at = ms(s.at);
    if (index === 0 && created != null && Math.abs(at - created) <= INITIAL_STAGE_WINDOW_MS) return;
    items.push({ id: `stage-${index}-${at}`, kind: "stage", at, stage: s.stage });
  });

  const myCitas = citas.filter((c) => isProspectCita(prospect, c));
  const nowMs = now.getTime();
  for (const cita of myCitas) {
    const at = citaTime(cita);
    if (at == null) continue;
    const status = citaStatus(cita);
    items.push({ id: `cita-${cita.id}`, kind: "appointment", at, citaId: cita.id, title: cita.titulo, status, place: cita.lugar || "", upcoming: at > nowMs && (status === "confirmada" || status === "solicitada") });
  }

  const citaIds = new Set(myCitas.map((c) => c.id));
  for (const visit of visits) {
    if (!isProspectVisit(prospect, visit, citaIds)) continue;
    const at = ms(visit.visited_at);
    if (at != null) items.push({ id: `visit-${visit.id}`, kind: "visit", at, visitId: visit.id, propertyId: visit.property_id, interest: visit.interest, comments: visit.comments || "" });
  }

  for (const note of notes) {
    const at = ms(note.created_at);
    if (at != null) items.push({ id: `note-${note.id}`, kind: "note", at, body: note.body, author: note.author_email || "" });
  }

  // Más reciente (o más próximo) primero; a la misma hora, un orden fijo para que no «baile».
  return items.sort((a, b) => b.at - a.at || (a.id < b.id ? -1 : 1));
}
