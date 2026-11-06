// Cierre del ciclo de "Agendar visita" (fase 6) — funciones puras.
//
// Quien reserva una visita desde el sitio ya es un prospecto. En Supabase lo hace
// visit_promote_prospect() dentro de book_visit() (supabase/schema.sql, "fase 6"); aquí
// están las mismas reglas para el modo demo y para lo que sí corre en el navegador:
// actualizar al prospecto cuando se registra la visita hecha.
//
// Reglas (iguales en SQL):
//  · prospecto nuevo: fuente "visita_agendada", etapa "interesado", último contacto = ahora y
//    seguimiento el día DESPUÉS de la visita (ahí el asesor llama a preguntar qué le pareció);
//  · si ya hay un prospecto ABIERTO con ese teléfono (últimos 10 dígitos) o correo, se actualiza
//    en vez de duplicarlo: de "nuevo"/"contactado" sube a "interesado"; "negociación" no
//    retrocede; un prospecto cerrado o perdido no cuenta como existente;
//  · el seguimiento solo se mueve si no tenía, ya venció o es posterior a la visita;
//  · si la visita se mueve, el seguimiento automático se mueve con ella; si se cancela o el
//    cliente no asiste, se pone para mañana (recontactar pronto). Un seguimiento que el asesor
//    puso a mano nunca se pisa.

import { OPEN_STAGES } from "./prospects";
import { addDays, hhmm, samePhone } from "./visitSlots";

const STAGE_ORDER = ["nuevo", "contactado", "interesado", "negociacion"];
const isOpen = (prospect) => OPEN_STAGES.includes(prospect?.stage);

// Seguimiento automático: el día después de la visita.
export const followupAfterVisit = (fecha) => addDays(fecha, 1);

const dmy = (fecha) => String(fecha).split("-").reverse().join("/");

// `requested`: solicitud de visita sin asesor (request_visit) — el texto dice "Solicitó" y no "Agendó".
export function bookingProspectNote({ label, fecha, hora, note, requested = false }) {
  let line = `${requested ? "Solicitó" : "Agendó"} una visita a ${label} el ${dmy(fecha)} a las ${hhmm(hora)}`;
  if (String(note ?? "").trim()) line += `. Nota: ${String(note).trim()}`;
  return line;
}

// El prospecto abierto más reciente que coincide por teléfono o por correo (o null).
export function findOpenProspect(prospects, { phone, email }) {
  const mail = String(email ?? "").trim().toLowerCase();
  return (
    prospects
      .filter((p) => isOpen(p) && (samePhone(p.phone, phone) || (mail && String(p.email ?? "").trim().toLowerCase() === mail)))
      .sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))[0] || null
  );
}

// Campos del prospecto nuevo (insert).
export function prospectFieldsFromBooking({ name, phone, email, advisorId, propertyId, messageId, label, fecha, hora, note, nowISO, requested = false }) {
  return {
    name,
    phone: phone || null,
    email: email || null,
    source: "visita_agendada",
    stage: "interesado",
    advisor_id: advisorId || null,
    property_id: propertyId || null,
    message_id: messageId || null,
    notes: bookingProspectNote({ label, fecha, hora, note, requested }),
    last_contact_at: nowISO,
    next_followup_at: followupAfterVisit(fecha),
    lost_reason: null,
  };
}

// Campos a actualizar en un prospecto abierto que acaba de reservar otra visita.
export function mergeBookingIntoProspect(existing, { propertyId, label, fecha, hora, note, today, nowISO, requested = false }) {
  const follow = followupAfterVisit(fecha);
  const line = bookingProspectNote({ label, fecha, hora, note, requested });
  const current = existing.next_followup_at;
  return {
    stage: ["nuevo", "contactado"].includes(existing.stage) ? "interesado" : existing.stage,
    last_contact_at: nowISO,
    next_followup_at: !current || current < today || current > follow ? follow : current,
    property_id: existing.property_id || propertyId || null,
    notes: existing.notes ? `${existing.notes}\n${line}` : line,
  };
}

/**
 * Qué pasa con el seguimiento cuando cambia la cita. `kind`:
 *  - "moved": la visita cambió de fecha (oldFecha → fecha);
 *  - "lost": se canceló o el cliente no asistió (fecha = la de la visita).
 * Devuelve los campos a actualizar o null si no hay nada que mover (prospecto cerrado, o con un
 * seguimiento distinto del automático, o sea, puesto a mano).
 */
export function syncProspectFollowup(prospect, { kind, oldFecha, fecha, today }) {
  if (!isOpen(prospect)) return null;
  if (kind === "moved") {
    return prospect.next_followup_at === followupAfterVisit(oldFecha) ? { next_followup_at: followupAfterVisit(fecha) } : null;
  }
  if (kind === "lost") {
    return prospect.next_followup_at === followupAfterVisit(fecha) ? { next_followup_at: addDays(today, 1) } : null;
  }
  return null;
}

// Etapa a la que apunta el interés registrado en la visita (descartó ESA propiedad: no cambia nada).
const VISIT_INTEREST_TO_STAGE = { muy_interesado: "interesado", interesado: "interesado", oferta_realizada: "negociacion" };

/**
 * Qué actualizar en el prospecto cuando se registra la visita hecha: último contacto = la visita; la
 * etapa solo avanza (según el interés); queda ligado a la visita (así importarla desde Visitas no
 * lo duplica) y, si no tenía seguimiento, se agenda el día después de la visita. Null si el
 * prospecto ya está cerrado o perdido.
 */
export function prospectAfterVisit(prospect, visit) {
  if (!isOpen(prospect)) return null;
  const fields = { last_contact_at: visit.visited_at };
  const target = VISIT_INTEREST_TO_STAGE[visit.interest];
  if (target && STAGE_ORDER.indexOf(target) > STAGE_ORDER.indexOf(prospect.stage)) fields.stage = target;
  if (!prospect.visit_id && visit.id) fields.visit_id = visit.id;
  if (!prospect.next_followup_at && visit.visited_at) fields.next_followup_at = followupAfterVisit(new Date(visit.visited_at).toLocaleDateString("en-CA"));
  return fields;
}

/**
 * Lo que sigue de registrar una visita que salió de una cita (mejor esfuerzo: si falta un permiso o
 * algo falla, la visita ya quedó guardada y no se deshace): marca la cita como realizada si seguía
 * pendiente y actualiza al prospecto ligado. `can`: { agenda, prospectos } según los apartados del rol.
 */
export async function closeLoopAfterVisit(db, visit, citaId, can = {}) {
  const result = { citaClosed: false, prospectUpdated: false };
  let cita = null;
  try {
    if (can.agenda) {
      cita = await db.getAgendaCitaById(citaId);
      if (cita && (cita.status || "confirmada") === "confirmada") {
        await db.setAgendaCitaStatus(cita.id, "realizada");
        result.citaClosed = true;
      }
    }
  } catch {
    /* la visita ya está guardada */
  }
  try {
    if (can.prospectos) {
      const prospectId = cita?.prospecto_id;
      const prospect = prospectId ? (await db.getProspects()).find((p) => p.id === prospectId) : null;
      const fields = prospect ? prospectAfterVisit(prospect, visit) : null;
      if (fields) {
        await db.updateProspect(prospect.id, fields);
        result.prospectUpdated = true;
      }
    }
  } catch {
    /* idem */
  }
  return result;
}
