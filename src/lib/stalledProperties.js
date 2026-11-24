// «Propiedades estancadas»: disponibles y activas que llevan X días sin movimiento. Movimiento = cualquier cambio en la
// ficha (precio, fotos, datos), una visita registrada, una cita en la Agenda o un prospecto nuevo que preguntó por ella.
// Funciones puras. OJO: un asesor solo ve sus propias visitas, citas y prospectos (RLS), así que con esos datos parciales
// una propiedad parecería estancada sin estarlo; la pantalla solo usa esto cuando quien mira ve todo (la oficina).

export const STALL_DAY_OPTIONS = [14, 30, 60];
export const DEFAULT_STALL_DAYS = 30;
const DAY_MS = 86400000;

const ms = (value) => {
  if (!value) return null;
  // «YYYY-MM-DD» (fecha de una cita) cuenta como el final de ese día en hora local: una visita de hoy es movimiento de hoy.
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T23:59:59`) : new Date(value);
  const t = date.getTime();
  return Number.isFinite(t) ? t : null;
};

// Índice property_id → momento (ms) del último movimiento fuera de la propia ficha. Citas canceladas no cuentan.
export function buildActivityIndex({ visits = [], citas = [], prospects = [] } = {}) {
  const latest = new Map();
  const bump = (propertyId, when) => {
    if (!propertyId || when == null) return;
    if (!(latest.get(propertyId) >= when)) latest.set(propertyId, when);
  };
  for (const v of visits) bump(v.property_id, ms(v.visited_at));
  for (const c of citas) if (c.status !== "cancelada") bump(c.property_id, ms(c.fecha));
  for (const p of prospects) bump(p.property_id, ms(p.created_at));
  return latest;
}

// → { stalled, daysIdle } o null si no aplica (no está disponible y activa, o no hay ninguna fecha).
// Una cita futura es movimiento «de mañana»: no puede dar días negativos.
export function stalledInfo(property, index, { now = new Date(), days = DEFAULT_STALL_DAYS } = {}) {
  if (!property || property.active === false || (property.status ?? "disponible") !== "disponible") return null;
  const moments = [ms(property.updated_at), ms(property.created_at), index.get(property.id)].filter((m) => m != null);
  if (moments.length === 0) return null;
  const last = Math.max(...moments);
  const daysIdle = Math.max(0, Math.floor((now.getTime() - last) / DAY_MS));
  return { stalled: daysIdle >= days, daysIdle };
}
