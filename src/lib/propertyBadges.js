// Etiquetas públicas de una propiedad ("Nuevo", "Bajó de precio") y la
// selección de destacadas del inicio. Funciones puras: reciben `now` para
// poder probarlas sin depender del reloj.

export const NEW_PROPERTY_DAYS = 14;
export const PRICE_DROP_DAYS = 30;
export const MAX_FEATURED = 6;

const DAY_MS = 86400000;

function ageInDays(iso, now) {
  const time = iso ? new Date(iso).getTime() : NaN;
  if (Number.isNaN(time)) return Infinity;
  return (now - time) / DAY_MS;
}

// Rebaja vigente: la base guarda el precio anterior y cuándo cambió (ver el
// trigger set_price_drop en schema.sql). Solo cuenta si el precio realmente
// bajó y fue hace poco; pasado el plazo la etiqueta se apaga sola.
export function getPriceDrop(property, now = Date.now()) {
  const previous = Number(property?.previous_price);
  const current = Number(property?.price);
  if (!(previous > current) || !(current > 0)) return null;
  if (ageInDays(property.price_changed_at, now) > PRICE_DROP_DAYS) return null;
  return { previousPrice: previous, percent: Math.round(((previous - current) / previous) * 100) };
}

// Una sola etiqueta por propiedad (la rebaja pesa más que "Nuevo"). Solo se
// muestran en propiedades disponibles: en una apartada o vendida ya dice su
// estatus y "Nuevo" o "Bajó de precio" sería engañoso.
export function getPropertyBadge(property, now = Date.now()) {
  if (property?.status !== "disponible") return null;
  const drop = getPriceDrop(property, now);
  if (drop) return { kind: "priceDrop", ...drop };
  if (ageInDays(property.created_at, now) <= NEW_PROPERTY_DAYS) return { kind: "new" };
  return null;
}

// Valores de rebaja que hay que guardar al cambiar el precio. Es el espejo en
// JS del trigger de la base (lo usa el modo demo): bajar guarda el precio
// anterior, subir lo borra, y sin cambio no se toca nada.
export function applyPriceChange(current, newPrice, now = Date.now()) {
  const keep = { previous_price: current.previous_price ?? null, price_changed_at: current.price_changed_at ?? null };
  const next = Number(newPrice);
  if (!(next > 0) || next === Number(current.price)) return keep;
  const changedAt = new Date(now).toISOString();
  if (next < Number(current.price)) return { previous_price: Number(current.price), price_changed_at: changedAt };
  return { previous_price: null, price_changed_at: changedAt };
}

// Destacadas del inicio: solo disponibles y activas, con foto; primero las
// que bajaron de precio y luego las más recientes. Así la sección nunca queda
// vacía mientras haya inventario, y lo que se ve arriba es lo más atractivo.
export function pickFeaturedProperties(properties, { limit = MAX_FEATURED, now = Date.now() } = {}) {
  return (properties || [])
    .filter((p) => p.status === "disponible" && p.active !== false && p.main_image)
    .map((p) => ({ property: p, dropped: getPriceDrop(p, now) ? 0 : 1, created: new Date(p.created_at).getTime() || 0 }))
    .sort((a, b) => a.dropped - b.dropped || b.created - a.created)
    .slice(0, limit)
    .map((entry) => entry.property);
}
