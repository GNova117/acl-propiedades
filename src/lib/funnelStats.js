// Estadísticas del embudo de prospectos. Función pura: recibe los prospectos y
// su historial de etapas (prospecto_etapas) y devuelve los números que pinta
// /admin/estadisticas. Sin acceso a datos ni al navegador, así se prueba aparte.
//
// Un prospecto "llegó" a una etapa si pasó por ella o por una posterior (uno que
// llegó a "cerrado" también pasó por contactado, interesado y negociación aunque
// nadie lo haya marcado paso a paso). "Perdido" no es una etapa del embudo: el
// prospecto cuenta hasta la más avanzada que alcanzó antes de perderse.

export const FUNNEL_STAGES = ["nuevo", "contactado", "interesado", "negociacion", "cerrado"];
const OPEN_STAGES = ["nuevo", "contactado", "interesado", "negociacion"];
const DAY_MS = 86400000;

const stageIndex = (stage) => FUNNEL_STAGES.indexOf(stage);
const round1 = (n) => Math.round(n * 10) / 10;
const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);

function median(values) {
  if (values.length === 0) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Agrupa por una llave y saca total, cerrados, perdidos y tasa de cierre.
function groupBy(rows, keyOf) {
  const map = new Map();
  for (const row of rows) {
    const key = keyOf(row);
    const entry = map.get(key) || { key, total: 0, closed: 0, lost: 0, active: 0, daysToClose: [] };
    entry.total += 1;
    if (row.closed) {
      entry.closed += 1;
      if (row.daysToClose != null) entry.daysToClose.push(row.daysToClose);
    } else if (row.lost) entry.lost += 1;
    else entry.active += 1;
    map.set(key, entry);
  }
  return Array.from(map.values())
    .map(({ daysToClose, ...e }) => ({ ...e, rate: pct(e.closed, e.total), avgDaysToClose: daysToClose.length ? round1(daysToClose.reduce((a, b) => a + b, 0) / daysToClose.length) : null }))
    .sort((a, b) => b.total - a.total);
}

// `periodDays`: solo prospectos creados en los últimos N días (null/0 = todos).
export function computeFunnel({ prospects, history, periodDays = null, now = new Date() }) {
  const since = periodDays ? now.getTime() - periodDays * DAY_MS : null;
  const historyByProspect = new Map();
  for (const h of history || []) {
    const list = historyByProspect.get(h.prospecto_id) || [];
    list.push(h);
    historyByProspect.set(h.prospecto_id, list);
  }

  const rows = (prospects || [])
    .filter((p) => since == null || new Date(p.created_at).getTime() >= since)
    .map((p) => {
      const steps = historyByProspect.get(p.id) || [];
      const lost = p.stage === "perdido";
      const closed = p.stage === "cerrado" || steps.some((s) => s.stage === "cerrado");
      // Etapa más avanzada alcanzada (todos pasan por "nuevo").
      let reached = 0;
      for (const s of steps) reached = Math.max(reached, stageIndex(s.stage));
      reached = Math.max(reached, stageIndex(p.stage));
      if (closed) reached = stageIndex("cerrado");

      let daysToClose = null;
      if (closed) {
        const closedStep = steps.filter((s) => s.stage === "cerrado").sort((a, b) => new Date(a.at) - new Date(b.at))[0];
        if (closedStep) daysToClose = Math.max(0, (new Date(closedStep.at) - new Date(p.created_at)) / DAY_MS);
      }
      return { ...p, lost: lost && !closed, closed, reached, daysToClose };
    });

  const total = rows.length;
  const closed = rows.filter((r) => r.closed).length;
  const lost = rows.filter((r) => r.lost).length;
  const active = rows.filter((r) => !r.closed && !r.lost && OPEN_STAGES.includes(r.stage)).length;
  const closeDays = rows.filter((r) => r.closed && r.daysToClose != null).map((r) => r.daysToClose);

  const funnel = FUNNEL_STAGES.map((stage, i) => {
    const reachedCount = rows.filter((r) => r.reached >= i).length;
    const prevCount = i === 0 ? total : rows.filter((r) => r.reached >= i - 1).length;
    return { stage, reached: reachedCount, pctOfTotal: pct(reachedCount, total), conversionFromPrev: i === 0 ? null : pct(reachedCount, prevCount) };
  });

  // Motivos de pérdida (sin distinguir mayúsculas ni espacios de más).
  const reasons = new Map();
  for (const r of rows.filter((x) => x.lost)) {
    const raw = String(r.lost_reason || "").trim().replace(/\s+/g, " ");
    const key = raw ? raw.toLowerCase() : "";
    const entry = reasons.get(key) || { reason: raw, count: 0 };
    entry.count += 1;
    reasons.set(key, entry);
  }
  const lostReasons = Array.from(reasons.values()).sort((a, b) => b.count - a.count);

  return {
    total,
    active,
    closed,
    lost,
    closeRate: pct(closed, total),
    avgDaysToClose: closeDays.length ? round1(closeDays.reduce((a, b) => a + b, 0) / closeDays.length) : null,
    medianDaysToClose: closeDays.length ? round1(median(closeDays)) : null,
    funnel,
    lostReasons,
    bySource: groupBy(rows, (r) => r.source || "manual"),
    byAdvisor: groupBy(rows, (r) => r.advisor_id || ""),
  };
}
