// Estatus y datos de contacto de las citas de la Agenda — funciones puras.
//
// Una cita puede venir de dos lados: la crea alguien del equipo a mano
// (source "admin", ligada a un cliente) o la reserva un visitante desde la ficha
// de una propiedad (source "sitio", con sus propios datos de contacto y un
// enlace de gestión). Las citas anteriores a "Agendar visita con horarios
// reales" no tienen `status`: cuentan como confirmadas.

export const CITA_STATUSES = ["confirmada", "realizada", "no_asistio", "cancelada", "solicitada"];

// 'pendiente' es el estatus que algunas bases ya tenían antes de este modelo: equivale a 'confirmada' (por atender).
export const citaStatus = (cita) => (cita?.status === "pendiente" ? "confirmada" : cita?.status) || "confirmada";
export const isCancelled = (cita) => citaStatus(cita) === "cancelada";
export const isFromSite = (cita) => cita?.source === "sitio";

// Solicitud de visita sin asesor: el cliente pidió un día y una hora y nadie la ha tomado todavía
// (estatus "solicitada", sin asesor). Aparece en la Agenda de todos hasta que alguien la toma.
export const isOpenRequest = (cita) => citaStatus(cita) === "solicitada" && !cita?.advisor_id;

// Lo que sigue pendiente de atender (ni cancelada ni ya cerrada).
export const isPending = (cita) => citaStatus(cita) === "confirmada";

// Citas que cuentan para el día a día (pendientes de hoy, panel, Mi día).
// Una solicitud sin asesor todavía no es de nadie: no cuenta como cita del día.
export const activeCitas = (citas) => citas.filter((c) => !isCancelled(c) && !isOpenRequest(c));

export function citaDuration(cita, fallback = 60) {
  return Number(cita?.duracion_min) > 0 ? Number(cita.duracion_min) : fallback;
}

// A quién se le escribe: el cliente ligado a la cita o, si la reservó un
// visitante, los datos que dejó al reservar.
export function citaContact(cita, client = null) {
  if (client) return { name: client.name || "", phone: client.phone || "", email: client.email || "" };
  return { name: cita?.contact_name || "", phone: cita?.contact_phone || "", email: cita?.contact_email || "" };
}

// Enlace con el que el cliente confirma, cambia o cancela su visita
// (/visita/<token>). Solo las reservas del sitio lo tienen; las que se
// capturan a mano en la Agenda no (devuelve ""). `origin` es el del sitio
// público, que es el mismo desde el que se usa el panel.
export function visitLink(cita, origin) {
  if (!isFromSite(cita) || !/^[0-9a-f]{32}$/.test(cita?.booking_token || "")) return "";
  return `${String(origin || "").replace(/\/+$/, "")}/visita/${cita.booking_token}`;
}

// Qué estatus se puede poner desde la Agenda a partir del actual.
// Una solicitud sin asesor solo se cancela (para tomarla se usa "Tomar visita"); una cita cancelada
// que nunca tuvo asesor tampoco se reactiva: quedaría confirmada sin nadie que la atienda.
export function statusActions(cita) {
  if (citaStatus(cita) === "solicitada") return ["cancelada"];
  if (isPending(cita)) return ["realizada", "no_asistio", "cancelada"];
  return cita?.advisor_id === null ? [] : ["confirmada"];
}

const dateISO = (date) => date.toLocaleDateString("en-CA");

const minutesOfDay = (hora) => {
  const [h, m] = String(hora).split(":").map(Number);
  return h * 60 + (m || 0);
};

/**
 * Reservas del sitio que siguen sin que el cliente confirme asistencia, de hoy
 * a `withinDays` días adelante (ordenadas por fecha y hora). Las de hoy que ya
 * empezaron no cuentan: ya no tiene caso pedir confirmación.
 */
export function visitsToConfirm(citas, now = new Date(), withinDays = 2) {
  const today = dateISO(now);
  const last = new Date(now);
  last.setDate(last.getDate() + withinDays);
  const until = dateISO(last);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return citas
    .filter(
      (c) =>
        isFromSite(c) &&
        isPending(c) &&
        c.hora &&
        !c.client_confirmed_at &&
        c.fecha >= today &&
        c.fecha <= until &&
        (c.fecha > today || minutesOfDay(c.hora) > nowMin)
    )
    .sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
}

/**
 * Solicitudes de visita sin asesor que siguen abiertas (de hoy en adelante), las más próximas primero.
 * `Mi día` las muestra a todos los asesores con el botón "Tomar visita".
 */
export function openRequests(citas, now = new Date()) {
  const today = dateISO(now);
  return citas.filter((c) => isOpenRequest(c) && c.fecha >= today).sort((a, b) => (a.fecha + (a.hora || "")).localeCompare(b.fecha + (b.hora || "")));
}

// ── Cierre del ciclo (fase 6) ──

// Una visita (cita con propiedad) se puede registrar en Visitas, y solo una vez.
export const canRegisterVisit = (cita) => Boolean(cita?.property_id) && citaStatus(cita) !== "cancelada";

const localInput = (fecha, hora) => `${fecha}T${String(hora ?? "00:00").slice(0, 5)}`;

/**
 * Datos con los que se abre el formulario "Registrar visita" desde una cita: propiedad, asesor,
 * fecha y hora, y el nombre y teléfono de quien visitó. La cita viaja en `cita_id` (queda ligada
 * a la visita). Las visitas no admiten fecha futura: si la cita es de más tarde, se usa "ahora".
 */
export function citaToVisitPrefill(cita, client = null, now = new Date()) {
  const contact = citaContact(cita, client);
  const nowInput = `${dateISO(now)}T${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const when = localInput(cita.fecha, cita.hora);
  return {
    property_id: cita.property_id || "",
    advisor_id: cita.advisor_id || "",
    visited_at: when > nowInput ? nowInput : when,
    prospect_name: contact.name || "",
    prospect_phone: contact.phone || "",
    cita_id: cita.id,
  };
}

/**
 * Visitas que ya pasaron y nadie cerró (siguen "confirmada"): de los últimos `withinDays` días,
 * sin contar hoy (las de hoy salen en "Citas de hoy"). Las más viejas primero. Son las que hay
 * que marcar como realizada o "no asistió": sin eso las métricas de asistencia no cuadran.
 */
export function visitsToClose(citas, now = new Date(), withinDays = 7) {
  const today = dateISO(now);
  const first = new Date(now);
  first.setDate(first.getDate() - withinDays);
  const since = dateISO(first);
  return citas
    .filter((c) => c.property_id && isPending(c) && c.fecha < today && c.fecha >= since)
    .sort((a, b) => `${a.fecha}${a.hora || ""}`.localeCompare(`${b.fecha}${b.hora || ""}`));
}
