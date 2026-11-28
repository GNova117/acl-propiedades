// Avisos de Favoritos: cuántas de tus propiedades guardadas bajaron de precio (rebaja vigente) o ya no están disponibles.
import { getPriceDrop } from "./propertyBadges";

export function favoritesAlerts(properties, now = Date.now()) {
  let dropped = 0;
  let unavailable = 0;
  for (const property of properties || []) {
    if (property?.status && property.status !== "disponible") unavailable += 1;
    else if (getPriceDrop(property, now)) dropped += 1;
  }
  return { dropped, unavailable };
}
