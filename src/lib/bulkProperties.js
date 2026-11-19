// Edición masiva de propiedades (Propiedades → casillas → barra de acciones): cálculo del nuevo precio y de los asesores.
// Funciones puras; las llama AdminProperties y se prueban aquí.

export const PRICE_MODES = ["percentUp", "percentDown", "exact"];
export const MAX_PERCENT = 50;

// Redondeo del precio resultante: a pesos enteros para un precio exacto y a la centena para un cambio por porcentaje
// (un precio de lista como $2,327,500 se ve bien; $2,327,512.5 no).
const roundTo = (value, step) => Math.round(value / step) * step;

/**
 * → { price } o { error }  — `amount`: el % (0.1 a 50) o el precio exacto (> 0); `current`: el precio de hoy.
 * Un cambio que no mueve el precio (o lo deja en 0) también es un error: no se guarda por guardar.
 */
export function bulkPriceValue(mode, amount, current) {
  if (!PRICE_MODES.includes(mode)) return { error: "mode" };
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return { error: "amount" };
  const now = Number(current);
  if (mode === "exact") return { price: roundTo(n, 1) };
  if (n > MAX_PERCENT) return { error: "percent" };
  if (!(now > 0)) return { error: "current" };
  const price = roundTo(now * (mode === "percentUp" ? 1 + n / 100 : 1 - n / 100), 100);
  return price > 0 && price !== now ? { price } : { error: "nochange" };
}

// Asesores de la propiedad tras asignar `advisorId`: «add» lo agrega (sin quitar a nadie) y «replace» deja solo a ese.
export function bulkAdvisorIds(mode, current, advisorId) {
  if (!advisorId) return null;
  const ids = Array.isArray(current) ? current : [];
  if (mode === "replace") return ids.length === 1 && ids[0] === advisorId ? null : [advisorId];
  return ids.includes(advisorId) ? null : [...ids, advisorId];
}
