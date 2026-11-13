// Lista de Asesores (la oficina): por cada asesor, de un vistazo, cómo va —prospectos abiertos y cuántos piden atención, propiedades
// disponibles, visitas del mes, lo que le queda hoy en la agenda y si está ausente— para decidir a quién cargarle o quitarle trabajo.
// Funciones puras que reutilizan las reglas de Mi día y Equipo hoy: lo que aquí cuenta es lo mismo que cada asesor ve en su día.
//
// Las metas mensuales NO entran: cada asesor lee solo la suya (RLS de advisor_goals) y la oficina no las puede ver.

import { absentUntil, todayISO } from "./absences";
import { advisorProperties } from "./advisorPage";
import { todayAgenda } from "./dayPlan";
import { inMonth } from "./goals";
import { followUpState, isOpenStage, unattendedState } from "./prospects";

/**
 * → { rows, totals }
 *   rows   — un renglón por asesor (activos o no), en el orden recibido:
 *            { advisor, openProspects, unattended (entrantes sin atender), late (de esos, los que ya van tarde), overdue (seguimientos
 *              vencidos), properties (disponibles), visitsMonth, agendaToday (citas que le quedan hoy), absentUntil, needsAttention }
 *   totals — la suma de cada número.
 * `needsAttention`: tiene prospectos sin atender o seguimientos vencidos (para resaltarlo en la lista).
 */
export function buildAdvisorStats({ advisors = [], prospects = [], properties = [], visits = [], citas = [], timeOff = [], now = new Date() } = {}) {
  const today = todayISO(now);
  const rows = advisors.map((advisor) => {
    const open = prospects.filter((p) => p.advisor_id === advisor.id && isOpenStage(p.stage));
    const unattendedList = open.map((p) => unattendedState(p, now)).filter(Boolean);
    const overdue = open.filter((p) => followUpState(p) === "overdue").length;
    return {
      advisor,
      openProspects: open.length,
      unattended: unattendedList.length,
      late: unattendedList.filter((u) => u.level === "late").length,
      overdue,
      properties: advisorProperties(properties, advisor.id).length,
      visitsMonth: visits.filter((v) => v.advisor_id === advisor.id && inMonth(v.visited_at, now)).length,
      agendaToday: todayAgenda(citas.filter((c) => c.advisor_id === advisor.id), now).filter((item) => item.state !== "past").length,
      absentUntil: absentUntil(timeOff, advisor.id, today),
      needsAttention: unattendedList.length > 0 || overdue > 0,
    };
  });
  const sum = (key) => rows.reduce((total, row) => total + row[key], 0);
  const totals = Object.fromEntries(["openProspects", "unattended", "late", "overdue", "properties", "visitsMonth", "agendaToday"].map((key) => [key, sum(key)]));
  return { rows, totals };
}
