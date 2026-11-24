// Fotos que recorre el carrusel de la tarjeta del listado: la principal primero
// y luego las demás, sin repetir. La ficha tiene la galería completa.
export const CARD_MAX_SLIDES = 6;

export function cardImages(property) {
  const main = property.main_image || property.images?.[0] || "";
  if (!main) return [];
  const rest = (property.images || []).filter((src) => src && src !== main);
  return [main, ...rest].slice(0, CARD_MAX_SLIDES);
}
