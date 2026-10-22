// Metas mensuales del asesor y su avance del mes. Funciones puras: la pantalla
// ("Mi mes" en Mi día) solo trae los datos y pinta el resultado.
//
// La meta es una sola por asesor y se repite cada mes hasta que la cambie
// (advisor_goals; no hay una por mes a propósito: así no hay que volver a
// capturarla cada primero de mes). Qué se mide y de dónde sale:
//   contacts     — contactos registrados en sus prospectos (prospecto_contactos)
//   visits       — visitas que registró (property_visits.visited_at)
//   newProspects — prospectos que captó (prospectos.created_at)
//   sales        — ventas que cerró (ventas.fecha_venta); solo con el apartado
//                  'reportes', que es quien puede leer esa tabla.

export const GOAL_METRICS = ["contacts", "visits", "newProspects", "sales"];
export const MAX_GOAL = 9999;

// Columna de advisor_goals de cada métrica.
const COLUMN = { contacts: "contacts", visits: "visits", newProspects: "new_prospects", sales: "sales" };

export const emptyGoals = () => ({ contacts: "", visits: "", newProspects: "", sales: "" });

// Fila de advisor_goals → valores del formulario ("" = sin meta).
export function goalsToForm(row) {
  const form = emptyGoals();
  if (!row) return form;
  for (const key of GOAL_METRICS) {
    const n = Number(row[COLUMN[key]]);
    if (n > 0) form[key] = String(n);
  }
  return form;
}

// Valores del formulario → columnas de advisor_goals (vacío o 0 = sin meta).
export function formToGoalColumns(form) {
  return Object.fromEntries(GOAL_METRICS.map((key) => [COLUMN[key], Math.min(MAX_GOAL, Math.max(0, Math.floor(Number(form[key]) || 0)))]));
}

// Errores por métrica (clave i18n); vacío si todo está bien. Se acepta dejar un
// campo vacío (sin meta en eso), pero no negativos, decimales ni números enormes.
export function validateGoals(form) {
  const errors = {};
  for (const key of GOAL_METRICS) {
    const raw = String(form[key] ?? "").trim();
    if (raw === "") continue;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0 || n > MAX_GOAL) errors[key] = "goals.errors.number";
  }
  return errors;
}

// Fecha o fecha-hora ISO → ¿cae en el mes de `now` (hora local)? Una fecha sola
// ("2026-10-05") se toma como ese día local, no como medianoche UTC.
export function inMonth(value, now = new Date()) {
  if (!value) return false;
  const text = String(value);
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T00:00:00` : text);
  return !Number.isNaN(date.getTime()) && date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

// Primer instante del mes (ISO, para pedirle a la base solo lo de este mes).
export const monthStartISO = (now = new Date()) => new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

// Cuánto llevas en el mes: solo lo del asesor. `contacts` ya viene contado.
export function countMonth({ visits = [], prospects = [], ventas = [], contacts = 0 }, advisorId, now = new Date()) {
  const mine = (row) => row.advisor_id === advisorId;
  return {
    contacts,
    visits: visits.filter((v) => mine(v) && inMonth(v.visited_at, now)).length,
    newProspects: prospects.filter((p) => mine(p) && inMonth(p.created_at, now)).length,
    sales: ventas.filter((v) => mine(v) && inMonth(v.fecha_venta, now)).length,
  };
}

// "done" (cumplida), "ahead" (vas por delante del ritmo del mes), "onTrack"
// (al corriente: al menos el 70 % de lo que tocaría a hoy) o "behind".
function statusOf(actual, target, expected) {
  if (actual >= target) return "done";
  if (actual >= expected) return "ahead";
  return actual >= expected * 0.7 ? "onTrack" : "behind";
}

// Avance de cada métrica con meta (las que no tienen meta no salen). `remaining`
// y `perDay` (cuántos al día, contando hoy, para llegar a la meta) solo si falta.
// `metrics`: las que este rol puede medir (cada una depende de un apartado).
export function goalProgress(goals, counts, now = new Date(), { metrics = GOAL_METRICS } = {}) {
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const day = now.getDate();
  const daysLeft = daysInMonth - day + 1;
  return GOAL_METRICS.filter((key) => metrics.includes(key) && Number(goals?.[COLUMN[key]]) > 0).map((key) => {
    const target = Number(goals[COLUMN[key]]);
    const actual = counts[key] || 0;
    const remaining = Math.max(0, target - actual);
    const expected = (target * day) / daysInMonth;
    return {
      key,
      target,
      actual,
      remaining,
      pct: Math.min(100, Math.round((actual / target) * 100)),
      perDay: remaining > 0 ? Math.ceil(remaining / daysLeft) : 0,
      status: statusOf(actual, target, expected),
    };
  });
}
