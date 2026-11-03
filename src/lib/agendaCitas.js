// Estatus y datos de contacto de las citas de la Agenda — funciones puras.
//
// Una cita puede venir de dos lados: la crea alguien del equipo a mano
// (source "admin", ligada a un cliente) o la reserva un visitante desde la ficha
// de una propiedad (source "sitio", con sus propios datos de contacto y un
// enlace de gestión). Las citas anteriores a "Agendar visita con horarios
// reales" no tienen `status`: cuentan como confirmadas.

export const CITA_STATUSES = ["confirmada", "realizada", "no_asistio", "cancelada"];

export const citaStatus = (cita) => cita?.status || "confirmada";
export const isCancelled = (cita) => citaStatus(cita) === "cancelada";
export const isFromSite = (cita) => cita?.source === "sitio";

// Lo que sigue pendiente de atender (ni cancelada ni ya cerrada).
export const isPending = (cita) => citaStatus(cita) === "confirmada";

// Citas que cuentan para el día a día (pendientes de hoy, panel, Mi día).
export const activeCitas = (citas) => citas.filter((c) => !isCancelled(c));

export function citaDuration(cita, fallback = 60) {
  return Number(cita?.duracion_min) > 0 ? Number(cita.duracion_min) : fallback;
}

// A quién se le escribe: el cliente ligado a la cita o, si la reservó un
// visitante, los datos que dejó al reservar.
export function citaContact(cita, client = null) {
  if (client) return { name: client.name || "", phone: client.phone || "", email: client.email || "" };
  return { name: cita?.contact_name || "", phone: cita?.contact_phone || "", email: cita?.contact_email || "" };
}

// Qué estatus se puede poner desde la Agenda a partir del actual.
export function statusActions(cita) {
  return isPending(cita) ? ["realizada", "no_asistio", "cancelada"] : ["confirmada"];
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
