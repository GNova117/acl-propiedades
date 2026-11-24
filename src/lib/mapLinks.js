// Enlaces para llegar a una propiedad y verla desde la calle. Son direcciones
// públicas de Google Maps y Waze: no piden llave de API ni cargan nada de
// terceros hasta que la persona toca el botón.

export function hasCoordinates(property) {
  const lat = Number(property?.lat);
  const lng = Number(property?.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

const point = (property) => `${Number(property.lat)},${Number(property.lng)}`;

// Indicaciones desde donde esté la persona hasta la propiedad.
export function directionsUrl(property) {
  if (!hasCoordinates(property)) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(point(property))}&travelmode=driving`;
}

// Street View en ese punto (si Google no tiene imágenes ahí, abre el mapa).
export function streetViewUrl(property) {
  if (!hasCoordinates(property)) return null;
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${encodeURIComponent(point(property))}`;
}

export function wazeUrl(property) {
  if (!hasCoordinates(property)) return null;
  return `https://waze.com/ul?ll=${encodeURIComponent(point(property))}&navigate=yes`;
}
