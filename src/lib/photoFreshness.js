// 470: recordatorio de actualizar las fotos de una propiedad que lleva meses publicada sin cambios.
// No hay fecha propia de «última foto», así que se usa la última modificación de la ficha: si una propiedad disponible no se
// ha tocado en STALE_PHOTO_DAYS, se sugiere revisar sus fotos (o confirmar que siguen vigentes guardándola).
export const STALE_PHOTO_DAYS = 180;

export function staleListingDays(property, now = new Date()) {
  if (!property || property.status !== "disponible" || property.active === false) return null;
  const since = new Date(property.updated_at || property.created_at);
  if (Number.isNaN(since.getTime())) return null;
  const days = Math.floor((now - since) / 86400000);
  return days >= STALE_PHOTO_DAYS ? days : null;
}
