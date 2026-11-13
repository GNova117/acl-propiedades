// Equipo hoy: lo que la oficina necesita ver de un vistazo para que nada se quede sin atender —por cada asesor, los prospectos
// entrantes sin atender, los seguimientos vencidos y de hoy, los que nadie ha tocado en una semana, las citas que quedan hoy y las
// visitas por cerrar o confirmar—, más lo que no tiene dueño (prospectos sin asesor y solicitudes de visita sin tomar).
// Funciones puras que reutilizan las reglas de Mi día (dayPlan.js): lo que aquí cuenta es lo mismo que cada asesor ve en su día.

import { openRequests, visitsToClose, visitsToConfirm } from "./agendaCitas";
import { prospectsToContact, todayAgenda } from "./dayPlan";
import { isForgotten, isOpenStage } from "./prospects";

// Qué pesa más al ordenar: lo urgente primero. Un asesor sin nada pendiente queda al final con «al día».
const WEIGHTS = { late: 4, warn: 2, overdue: 2, forgotten: 1, toClose: 1, toConfirm: 1 };

function summarize(prospects, citas, now) {
  const open = prospects.filter((p) => isOpenStage(p.stage));
  const contact = prospectsToContact(open, now);
  const counts = {
    open: open.length,
    late: contact.urgent.filter((e) => e.level === "late").length,
    unattended: contact.urgent.length,
    overdue: contact.overdue.length,
    dueToday: contact.today.length,
    forgotten: open.filter((p) => isForgotten(p, now)).length,
    agendaToday: todayAgenda(citas, now).filter((i) => i.state !== "past").length,
    toClose: visitsToClose(citas, now).length,
    toConfirm: visitsToConfirm(citas, now).length,
  };
  const attention =
    counts.late * WEIGHTS.late +
    (counts.unattended - counts.late) * WEIGHTS.warn +
    counts.overdue * WEIGHTS.overdue +
    counts.forgotten * WEIGHTS.forgotten +
    counts.toClose * WEIGHTS.toClose +
    counts.toConfirm * WEIGHTS.toConfirm;
  return { ...counts, attention };
}

const TOTAL_KEYS = ["open", "late", "unattended", "overdue", "dueToday", "forgotten", "agendaToday", "toClose", "toConfirm", "attention"];

/**
 * → { rows, unassigned, requests, totals }
 *   rows       — un renglón por asesor activo: { advisor, open, late, unattended (incluye los late), overdue, dueToday,
 *                forgotten, agendaToday, toClose, toConfirm, attention }, el que más atención pide primero (y por nombre);
 *   unassigned — lo mismo para los prospectos sin asesor (o de un asesor que ya no está): { open, unattended, overdue, … };
 *   requests   — solicitudes de visita del sitio que nadie ha tomado;
 *   totals     — la suma de rows + unassigned.
 */
export function buildTeamDay({ prospects = [], citas = [], advisors = [], now = new Date() } = {}) {
  const active = advisors.filter((a) => a.active !== false);
  // Los prospectos de un asesor dado de baja necesitan dueño igual que los que nunca lo tuvieron.
  const known = new Set(active.map((a) => a.id));
  const rows = active
    .map((advisor) =>
      ({ advisor, ...summarize(prospects.filter((p) => p.advisor_id === advisor.id), citas.filter((c) => c.advisor_id === advisor.id), now) })
    )
    .sort((a, b) => b.attention - a.attention || String(a.advisor.name).localeCompare(String(b.advisor.name), "es"));
  const orphans = prospects.filter((p) => !p.advisor_id || !known.has(p.advisor_id));
  const unassigned = summarize(orphans, [], now);
  const totals = Object.fromEntries(TOTAL_KEYS.map((key) => [key, [...rows, unassigned].reduce((sum, r) => sum + r[key], 0)]));
  return { rows, unassigned, requests: openRequests(citas, now).length, totals };
}
