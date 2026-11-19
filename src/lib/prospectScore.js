// Calificación automática de un prospecto: «caliente», «tibio» o «frío» según lo que ya se sabe de él, para que el
// asesor empiece por los que más probabilidad tienen de avanzar. Es una guía heurística (no aprende de nada): suma
// puntos por la etapa, por lo que hizo antes de llegar (pidió una visita, usó un simulador…), por lo que dejó dicho
// (propiedad de interés, presupuesto), por señales de interés (abrió su selección, hay propiedades que le encajan) y resta por
// enfriamiento (sin contacto hace semanas, seguimiento vencido). Cerrados y perdidos no se califican.
import { daysSince, followUpState, isOpenStage } from "./prospects";

export const HOT_FROM = 60;
export const WARM_FROM = 35;

const STAGE_POINTS = { nuevo: 10, contactado: 20, interesado: 40, negociacion: 60 };
// Qué tan clara es la intención de quien llega por cada origen.
const SOURCE_POINTS = { visita_agendada: 20, simulador: 15, estimacion: 15, comparador: 15, whatsapp: 10, chatbot: 10, visita: 10, alerta: 8, sitio: 5 };
const STALE_DAYS = 14;
const RECENT_CONTACT_DAYS = 3;
const SELECTION_RECENT_DAYS = 7;

const hasBudget = (criteria) => Boolean(criteria && (Number(criteria.max_price) > 0 || Number(criteria.min_price) > 0));

/**
 * → null (cerrado o perdido) o { score: 0-100, level: "hot" | "warm" | "cold", reasons: [{ key, points }] }.
 * `reasons` guarda cada factor con sus puntos (positivos o negativos) para explicar la calificación.
 * `matchCount`: propiedades disponibles que encajan con lo que busca; `selectionOpenedAt`: cuándo abrió una selección.
 */
export function prospectScore(prospect, { now = new Date(), matchCount = 0, selectionOpenedAt = null } = {}) {
  if (!isOpenStage(prospect.stage)) return null;
  const reasons = [];
  const add = (key, points) => points !== 0 && reasons.push({ key, points });

  add(`stage_${prospect.stage}`, STAGE_POINTS[prospect.stage] ?? 0);
  add(`source_${prospect.source}`, SOURCE_POINTS[prospect.source] ?? 0);
  if (prospect.property_id) add("hasProperty", 10);
  if (hasBudget(prospect.search_criteria)) add("hasBudget", 10);
  if (matchCount > 0) add("hasMatches", 5);

  if (selectionOpenedAt) {
    const age = (now - new Date(selectionOpenedAt)) / 86400000;
    if (age >= 0 && age <= SELECTION_RECENT_DAYS) add("openedSelection", 15);
  }

  const lastTouch = prospect.last_contact_at || prospect.created_at;
  const idle = daysSince(lastTouch);
  if (prospect.last_contact_at && idle != null && idle <= RECENT_CONTACT_DAYS) add("recentContact", 10);
  if (idle != null && idle >= STALE_DAYS) add("stale", -15);
  if (followUpState(prospect) === "overdue") add("followOverdue", -10);

  const score = Math.max(0, Math.min(100, reasons.reduce((sum, r) => sum + r.points, 0)));
  const level = score >= HOT_FROM ? "hot" : score >= WARM_FROM ? "warm" : "cold";
  return { score, level, reasons };
}

// Orden «temperatura»: de mayor a menor puntaje; los que no se califican (cerrados…) al final; empate por el más reciente.
export function sortByScore(prospects, scoreOf) {
  return prospects
    .map((p, index) => ({ p, index, score: scoreOf(p)?.score ?? -1 }))
    .sort((a, b) => b.score - a.score || String(b.p.created_at).localeCompare(String(a.p.created_at)) || a.index - b.index)
    .map((e) => e.p);
}
