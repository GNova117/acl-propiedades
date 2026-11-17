// Asignación automática de prospectos sin asesor (lo que la oficina ve en «Equipo hoy», tarjeta «Sin asesor»).
//
// Reglas, en este orden:
//  1. Solo asesores activos.
//  2. Si el prospecto viene de una propiedad que tiene asesores activos, se reparte entre ESOS (conoce la propiedad).
//  3. Entre los candidatos gana el que menos prospectos abiertos tiene (la carga); si empatan, el que menos recibió esta
//     semana, y al final el nombre (para que el resultado sea siempre el mismo).
//  4. Cada asignación cuenta para la siguiente: 10 prospectos nuevos no caen todos en el mismo asesor.
// No guarda nada: devuelve el plan para que la oficina lo revise y lo confirme.
import { isOpenStage } from "./prospects";

const WEEK_MS = 7 * 86400000;

// Prospectos que necesitan dueño: abiertos y sin asesor (o de uno que ya no está activo).
export function unassignedOpen(prospects, advisors) {
  const active = new Set((advisors || []).filter((a) => a.active !== false).map((a) => a.id));
  return (prospects || []).filter((p) => isOpenStage(p.stage) && (!p.advisor_id || !active.has(p.advisor_id)));
}

/**
 * → [{ prospect, advisor, reason: "property" | "load" }] en el orden de los prospectos recibidos (los más viejos primero).
 * `properties`: para saber qué asesores tiene cada propiedad (advisor_ids).
 */
export function planAssignments(prospects, { advisors = [], properties = [], now = new Date() } = {}) {
  const active = advisors.filter((a) => a.active !== false);
  if (active.length === 0) return [];
  const activeIds = new Set(active.map((a) => a.id));
  const byId = new Map(active.map((a) => [a.id, a]));
  const propertyById = new Map((properties || []).map((p) => [p.id, p]));

  const load = new Map(active.map((a) => [a.id, 0]));
  const recent = new Map(active.map((a) => [a.id, 0]));
  for (const p of prospects) {
    if (!p.advisor_id || !activeIds.has(p.advisor_id)) continue;
    if (isOpenStage(p.stage)) load.set(p.advisor_id, load.get(p.advisor_id) + 1);
    if (now - new Date(p.created_at) <= WEEK_MS) recent.set(p.advisor_id, recent.get(p.advisor_id) + 1);
  }

  const orphans = unassignedOpen(prospects, advisors).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  return orphans.map((prospect) => {
    const ofProperty = (propertyById.get(prospect.property_id)?.advisor_ids || []).filter((id) => activeIds.has(id));
    const reason = ofProperty.length > 0 ? "property" : "load";
    const candidates = (reason === "property" ? ofProperty.map((id) => byId.get(id)) : active).slice();
    candidates.sort(
      (a, b) =>
        load.get(a.id) - load.get(b.id) ||
        recent.get(a.id) - recent.get(b.id) ||
        String(a.name).localeCompare(String(b.name), "es") ||
        String(a.id).localeCompare(String(b.id))
    );
    const advisor = candidates[0];
    load.set(advisor.id, load.get(advisor.id) + 1);
    recent.set(advisor.id, recent.get(advisor.id) + 1);
    return { prospect, advisor, reason };
  });
}

// El plan agrupado por asesor, para aplicarlo en lote: [{ advisor, prospects: [...] }] en el orden de aparición.
export function groupPlan(plan) {
  const groups = new Map();
  for (const { prospect, advisor } of plan) {
    if (!groups.has(advisor.id)) groups.set(advisor.id, { advisor, prospects: [] });
    groups.get(advisor.id).prospects.push(prospect);
  }
  return [...groups.values()];
}
