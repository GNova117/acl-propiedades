// Ruta del día: las citas que le quedan al asesor hoy, en el orden de la agenda, con el enlace que abre la ruta completa en
// Google Maps y un aviso cuando no alcanza el tiempo entre una cita y la siguiente. Funciones puras; Mi día pinta el resultado.
//
// El orden es el de la hora, no el de cercanía: las citas ya tienen hora con el cliente, optimizar el recorrido las movería.
//
// De dónde sale cada parada: el lugar escrito en la cita (si es texto) o, si no hay, la dirección de la propiedad de la cita.
// La ubicación exacta (lat/lng de la propiedad) se usa para el mapa y para calcular distancias, y para el enlace cuando el lugar
// de la cita es la propiedad misma. Un enlace de mapa pegado en «lugar» no sirve como parada de una ruta (no se sabe a dónde
// apunta): esa cita queda fuera (se avisa) y conserva su botón «Cómo llegar».

import { DEFAULT_DURATION_MINUTES } from "./calendarEvent";
import { citaDuration } from "./agendaCitas";

// Google Maps acepta hasta 9 paradas intermedias + el destino en el enlace.
export const MAX_ROUTE_STOPS = 10;

// Las distancias son en línea recta (no hay servicio de rutas aquí); un factor para acercarlas a la distancia por calle y una
// velocidad media de ciudad. Es un cálculo para avisar «ojo, va justo», no un tiempo de navegación: siempre se muestra como «≈».
const ROAD_FACTOR = 1.3;
const CITY_KMH = 30;
// Margen para estacionarse, llegar al lugar y saludar: por debajo de esto, «va justo».
const BUFFER_MINUTES = 10;

const normalize = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const isLink = (text) => /^https?:\/\//i.test(text);
const hasCoords = (property) => Number.isFinite(Number(property?.lat)) && Number.isFinite(Number(property?.lng)) && property?.lat != null && property?.lng != null;

const minutesOfDay = (hora) => {
  const [h, m] = String(hora).split(":").map(Number);
  return h * 60 + (m || 0);
};

// Dónde es la cita: { label, query, pin } o null si no se puede ubicar.
//   label — lo que se lee en pantalla.
//   query — lo que se manda a Google Maps (coordenadas si el lugar es la propiedad; si no, el texto).
//   pin   — { lat, lng } para el mapa y las distancias; solo cuando el lugar ES la propiedad (si el asesor escribió «Café Plaza»,
//           ponerle la ubicación de la propiedad sería mentirle).
export function citaPlace(cita, property = null) {
  const lugar = String(cita?.lugar || "").trim();
  const placeIsText = lugar && !isLink(lugar);
  const coords = hasCoords(property) ? { lat: Number(property.lat), lng: Number(property.lng) } : null;
  const sameAsProperty = !lugar || (property && [property.address, property.title].some((v) => v && normalize(v) === normalize(lugar)));
  const pin = coords && sameAsProperty ? coords : null;

  if (lugar && !placeIsText) return null; // enlace de mapa: no entra a la ruta
  const label = placeIsText ? lugar : property?.address || property?.title || "";
  if (!label && !pin) return null;
  if (pin) return { label: label || property?.title || "", query: `${pin.lat},${pin.lng}`, pin };
  const query = placeIsText ? lugar : property?.address || "";
  return query ? { label, query, pin: null } : null;
}

// Kilómetros en línea recta entre dos puntos { lat, lng } (haversine).
export function distanceKm(a, b) {
  const rad = (deg) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

// Tramo entre dos paradas con ubicación: { km, minutes } estimados por calle, o null si falta alguna.
export function estimateLeg(from, to) {
  if (!from?.pin || !to?.pin) return null;
  const km = distanceKm(from.pin, to.pin) * ROAD_FACTOR;
  return { km: Math.round(km * 10) / 10, minutes: Math.max(1, Math.round((km / CITY_KMH) * 60)) };
}

// Estado del tramo: el tiempo que queda entre que termina una cita y empieza la siguiente contra lo que cuesta llegar.
//   "late"  — no alcanza (el hueco es menor al trayecto)
//   "tight" — alcanza pero sin margen (menos de BUFFER_MINUTES de sobra)
//   null    — con tiempo, o sin horas/ubicación para saberlo
function legLevel(from, to, leg) {
  if (!leg || !from.cita.hora || !to.cita.hora) return { gap: null, level: null };
  const end = minutesOfDay(from.cita.hora) + citaDuration(from.cita, DEFAULT_DURATION_MINUTES);
  const gap = minutesOfDay(to.cita.hora) - end;
  if (gap < leg.minutes) return { gap, level: "late" };
  if (gap < leg.minutes + BUFFER_MINUTES) return { gap, level: "tight" };
  return { gap, level: null };
}

// Enlace de Google Maps con toda la ruta, saliendo de donde esté el asesor (sin `origin` Maps usa la ubicación actual).
export function directionsUrl(stops, { max = MAX_ROUTE_STOPS } = {}) {
  const used = stops.slice(0, max);
  if (used.length === 0) return null;
  const params = new URLSearchParams({ api: "1", travelmode: "driving", destination: used[used.length - 1].query });
  if (used.length > 1) params.set("waypoints", used.slice(0, -1).map((stop) => stop.query).join("|"));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

// `items`: lo que devuelve todayAgenda() de dayPlan.js ({ cita, state }), ya en orden de hora.
// → { stops, unplaced, url, truncated, totalKm }
//   stops    — las paradas que quedan hoy (no las ya terminadas) con su lugar y el tramo desde la anterior (`leg`:
//              { km, minutes, gap, level }); `number` es su número en la lista y en el mapa.
//   unplaced — citas que quedan hoy pero no se pueden poner en la ruta (sin lugar, o con un enlace de mapa).
//   truncated — hay más paradas de las que caben en el enlace (se abre con las primeras MAX_ROUTE_STOPS).
export function planDayRoute(items, properties = []) {
  const byId = new Map(properties.map((p) => [p.id, p]));
  const stops = [];
  const unplaced = [];
  for (const item of items || []) {
    if (item.state === "past") continue;
    const property = item.cita.property_id ? byId.get(item.cita.property_id) : null;
    const place = citaPlace(item.cita, property);
    if (place) stops.push({ ...item, property, ...place });
    else unplaced.push(item);
  }

  let totalKm = 0;
  const numbered = stops.map((stop, index) => {
    const previous = stops[index - 1];
    const leg = previous ? estimateLeg(previous, stop) : null;
    if (leg) totalKm += leg.km;
    return { ...stop, number: index + 1, leg: leg ? { ...leg, ...legLevel(previous, stop, leg) } : null };
  });

  return {
    stops: numbered,
    unplaced,
    url: directionsUrl(numbered),
    truncated: numbered.length > MAX_ROUTE_STOPS,
    totalKm: Math.round(totalKm * 10) / 10,
  };
}
