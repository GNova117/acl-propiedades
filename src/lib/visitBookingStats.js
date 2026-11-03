// Métricas de las visitas reservadas desde el sitio (fase 6) — función pura. Recibe las citas de la
// Agenda (ya recortadas por RLS: un asesor ve las suyas, la oficina todas) y devuelve las cifras que
// pinta /admin/estadisticas. Solo cuentan las reservas del sitio (agenda_citas.source = "sitio").
//
// Una reserva termina en uno de estos estados: PRÓXIMA (confirmada, todavía no llega la hora),
// POR CERRAR (confirmada pero la hora ya pasó y nadie la marcó), REALIZADA, NO ASISTIÓ o CANCELADA.
// La tasa de asistencia se calcula solo sobre las CERRADAS (realizada + no asistió): lo próximo y lo
// que está por cerrar todavía no dice nada, y contarlo como inasistencia la falsearía.

import { citaDuration, citaStatus, isFromSite } from "./agendaCitas";

const DAY_MS = 86400000;
const round1 = (n) => Math.round(n * 10) / 10;
const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : null);

const startOf = (cita) => {
  const [y, m, d] = String(cita.fecha).split("-").map(Number);
  const [hh, mm] = String(cita.hora || "00:00").split(":").map(Number);
  return new Date(y, m - 1, d, hh || 0, mm || 0);
};

const dateOnly = (iso) => new Date(iso).toLocaleDateString("en-CA");
const daysBetween = (fromDate, toDate) => Math.round((new Date(`${toDate}T12:00:00Z`) - new Date(`${fromDate}T12:00:00Z`)) / DAY_MS);

const emptyCounts = () => ({ booked: 0, attended: 0, noShow: 0, cancelled: 0 });

/**
 * `periodDays`: solo reservas hechas en los últimos N días (null/0 = todas). `advisorId`: solo las de ese asesor.
 */
export function computeVisitBookingStats(citas, { periodDays = null, advisorId = null, now = new Date() } = {}) {
  const since = periodDays ? now.getTime() - periodDays * DAY_MS : null;
  const rows = citas.filter((c) => isFromSite(c) && (!advisorId || c.advisor_id === advisorId) && (since == null || new Date(c.created_at).getTime() >= since));

  const total = emptyCounts();
  const byAdvisor = new Map();
  const confirmedGroup = { attended: 0, closed: 0 };
  const unconfirmedGroup = { attended: 0, closed: 0 };
  const leadDays = [];
  let upcoming = 0;
  let toClose = 0;
  let cancelledByClient = 0;
  let cancelledByAdvisor = 0;
  let rescheduled = 0;

  for (const cita of rows) {
    const status = citaStatus(cita);
    const advisor = byAdvisor.get(cita.advisor_id) || { advisorId: cita.advisor_id, ...emptyCounts() };
    total.booked += 1;
    advisor.booked += 1;
    if (Number(cita.reschedule_count) > 0) rescheduled += 1;
    if (cita.created_at && cita.fecha) leadDays.push(Math.max(0, daysBetween(dateOnly(cita.created_at), cita.fecha)));

    if (status === "cancelada") {
      total.cancelled += 1;
      advisor.cancelled += 1;
      if (cita.cancelled_by === "asesor") cancelledByAdvisor += 1;
      else cancelledByClient += 1;
    } else if (status === "realizada" || status === "no_asistio") {
      const attended = status === "realizada";
      total[attended ? "attended" : "noShow"] += 1;
      advisor[attended ? "attended" : "noShow"] += 1;
      const group = cita.client_confirmed_at ? confirmedGroup : unconfirmedGroup;
      group.closed += 1;
      if (attended) group.attended += 1;
    } else if (startOf(cita).getTime() + citaDuration(cita) * 60000 > now.getTime()) {
      upcoming += 1;
    } else {
      toClose += 1;
    }
    byAdvisor.set(cita.advisor_id, advisor);
  }

  const closed = total.attended + total.noShow;
  return {
    booked: total.booked,
    upcoming,
    toClose,
    attended: total.attended,
    noShow: total.noShow,
    cancelled: total.cancelled,
    cancelledByClient,
    cancelledByAdvisor,
    closed,
    attendanceRate: pct(total.attended, closed),
    cancellationRate: pct(total.cancelled, total.booked),
    // ¿Sirve que el cliente confirme? Asistencia de quienes confirmaron vs. de quienes no.
    attendanceConfirmed: pct(confirmedGroup.attended, confirmedGroup.closed),
    attendanceUnconfirmed: pct(unconfirmedGroup.attended, unconfirmedGroup.closed),
    avgLeadDays: leadDays.length ? round1(leadDays.reduce((a, b) => a + b, 0) / leadDays.length) : null,
    rescheduled,
    reschedulePct: pct(rescheduled, total.booked),
    byAdvisor: [...byAdvisor.values()]
      .map((a) => ({ ...a, attendanceRate: pct(a.attended, a.attended + a.noShow) }))
      .sort((a, b) => b.booked - a.booked),
  };
}
