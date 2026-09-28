// Seguimiento posventa: a los 30 días y a los 6 meses de cerrar un prospecto se
// le escribe para saber cómo va, pedir un comentario y una recomendación.
// Funciones puras; qué está hecho se guarda en prospectos.postsale_30_done_at y
// prospectos.postsale_180_done_at (ver schema.sql).

import { daysSince } from "./prospects";

export const POSTSALE_STEPS = [
  { key: "30", days: 30, column: "postsale_30_done_at" },
  { key: "180", days: 180, column: "postsale_180_done_at" },
];

// Cuándo se cerró: la primera vez que pasó a "cerrado" según el historial de
// etapas; si no hay historial (prospectos anteriores), la última edición.
export function closedAt(prospect, history = []) {
  const steps = history.filter((h) => h.prospecto_id === prospect.id && h.stage === "cerrado").sort((a, b) => String(a.at).localeCompare(String(b.at)));
  return steps[0]?.at || prospect.updated_at || prospect.created_at || null;
}

// Devuelve { key, days, since } del primer paso pendiente cuya fecha ya llegó, o
// null. El de 6 meses solo aparece cuando el de 30 días ya se atendió.
export function postsaleDue(prospect, history = []) {
  if (prospect.stage !== "cerrado") return null;
  const since = daysSince(closedAt(prospect, history));
  if (since == null) return null;
  for (const step of POSTSALE_STEPS) {
    if (prospect[step.column]) continue;
    return since >= step.days ? { key: step.key, days: step.days, since } : null;
  }
  return null;
}

const firstName = (name) => String(name || "").trim().split(/\s+/)[0] || "";

// Mensaje de WhatsApp sugerido (se puede editar antes de enviar).
export function postsaleMessage(prospect, stepKey, propertyTitle) {
  const name = firstName(prospect.name);
  const where = propertyTitle ? ` (${propertyTitle})` : "";
  if (stepKey === "180") {
    return `Hola ${name}, ya son seis meses desde tu compra${where}. ¿Cómo te ha ido? Recuerda que también te ayudamos si más adelante quieres vender, rentar o remodelar. Y si conoces a alguien que busque propiedad, con gusto lo atendemos con el mismo cuidado. ¡Gracias por tu confianza!`;
  }
  return `Hola ${name}, ¡qué gusto saludarte! Ya pasó un mes desde que concretaste tu compra${where}. ¿Cómo va todo? Si necesitas cualquier cosa, aquí estamos. Y si te sentiste bien atendido, ¿nos recomendarías con un familiar o amigo que busque casa? También nos ayudaría mucho un comentario tuyo sobre nuestro servicio. ¡Gracias!`;
}
