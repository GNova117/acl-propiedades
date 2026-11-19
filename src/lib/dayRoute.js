// «Ruta de hoy»: las visitas que faltan hoy, en orden de hora, como paradas para abrir en Google Maps con varias
// escalas. Cada parada sale de las coordenadas de la propiedad de la cita (lo más exacto) o, si no hay, del texto
// del lugar. Citas sin lugar usable (o con un enlace en vez de una dirección) no son parada: se cuentan aparte.
// Google Maps acepta hasta 9 puntos intermedios más el destino.

import { hasCoordinates } from "./mapLinks";

export const MAX_STOPS = 10;

const isLink = (text) => /^https?:\/\//i.test(text);

// items: salida de todayAgenda (`{ cita, state }`). Solo entran las que aún no pasan.
export function buildDayRoute(items, properties = []) {
  const byId = new Map(properties.map((p) => [p.id, p]));
  const stops = [];
  const unplaced = [];
  for (const { cita, state } of items) {
    if (state === "past" || state === "allDay") continue;
    const property = cita.property_id ? byId.get(cita.property_id) : null;
    const lugar = String(cita.lugar || "").trim();
    let query = null;
    if (property && hasCoordinates(property)) query = `${Number(property.lat)},${Number(property.lng)}`;
    else if (lugar && !isLink(lugar)) query = lugar;
    if (!query) {
      unplaced.push(cita);
      continue;
    }
    const last = stops[stops.length - 1];
    // Dos visitas seguidas en el mismo lugar son una sola parada.
    if (last && last.query === query) {
      last.citas.push(cita);
      continue;
    }
    stops.push({ query, citas: [cita], hora: cita.hora ? String(cita.hora).slice(0, 5) : "", label: property?.title || lugar || cita.titulo });
  }
  return { stops: stops.slice(0, MAX_STOPS), truncated: Math.max(0, stops.length - MAX_STOPS), unplaced };
}

// Enlace de Google Maps desde donde esté la persona hasta la última parada, pasando por las demás en orden.
export function routeUrl(stops) {
  if (!stops || stops.length === 0) return null;
  const last = stops[stops.length - 1];
  const params = [`api=1`, `destination=${encodeURIComponent(last.query)}`, `travelmode=driving`];
  const waypoints = stops.slice(0, -1).map((s) => s.query);
  if (waypoints.length > 0) params.push(`waypoints=${waypoints.map(encodeURIComponent).join("%7C")}`);
  return `https://www.google.com/maps/dir/?${params.join("&")}`;
}
