// «A X min de tu trabajo»: la persona escribe una dirección (trabajo, escuela…) y la ficha le dice cuánto
// tarda en auto hasta la propiedad.
//
// Cómo se calcula, de mejor a peor:
//  1. Ruta real en auto (OSRM, servidor público de demostración): duración y kilómetros por calle.
//  2. Si ese servicio no contesta a tiempo: estimación a partir de la distancia en línea recta
//     (ver estimateDrivingMinutes), y la pantalla lo dice («aprox.»).
//
// Privacidad: la dirección que se escribe sale hacia OpenStreetMap (búsqueda) y OSRM (ruta), solo cuando la
// persona toca «Calcular» —nunca al teclear—. Aquí no se guarda en ningún servidor; la pantalla la recuerda
// solo en el dispositivo (localStorage) y se puede quitar.

const OSRM = "https://router.project-osrm.org/route/v1/driving";
export const ROUTE_TIMEOUT_MS = 5000;
// Ciudad de La Laguna: las calles no van en línea recta y el tráfico urbano es lento.
const ROAD_FACTOR = 1.35;
const AVERAGE_SPEED_KMH = 35;
const STORAGE_KEY = "acl_travel_place";

const toRad = (deg) => (deg * Math.PI) / 180;

export function haversineKm(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Minutos en auto a partir de kilómetros en línea recta (estimación gruesa, nunca menos de 1).
export function estimateDrivingMinutes(straightKm) {
  return Math.max(1, Math.round(((straightKm * ROAD_FACTOR) / AVERAGE_SPEED_KMH) * 60));
}

// Lo que se muestra: de 1 a 9 min tal cual; de ahí en adelante de 5 en 5 (no aparentar precisión que no hay).
export function roundMinutes(minutes) {
  const m = Math.max(1, Math.round(minutes));
  return m < 10 ? m : Math.round(m / 5) * 5;
}

export function formatDuration(minutes) {
  const m = roundMinutes(minutes);
  if (m < 60) return { hours: 0, minutes: m };
  return { hours: Math.floor(m / 60), minutes: m % 60 };
}

async function fetchRoute(from, to, { fetchImpl = fetch, timeoutMs = ROUTE_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = `${OSRM}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`;
    const response = await fetchImpl(url, { signal: controller.signal });
    if (!response.ok) return null;
    const body = await response.json();
    const route = body?.routes?.[0];
    if (body?.code !== "Ok" || !route || !Number.isFinite(route.duration) || !Number.isFinite(route.distance)) return null;
    return { minutes: route.duration / 60, km: route.distance / 1000 };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// { minutes, km, source: "route" | "estimate" }. `from` y `to`: { lat, lng }.
export async function travelTimeBetween(from, to, deps = {}) {
  const route = await fetchRoute(from, to, deps);
  if (route) return { ...route, source: "route" };
  const km = haversineKm(from, to);
  return { minutes: estimateDrivingMinutes(km), km: km * ROAD_FACTOR, source: "estimate" };
}

// Nombre corto para mostrar (Nominatim devuelve direcciones larguísimas): las tres primeras partes.
export function shortPlaceLabel(label) {
  return String(label ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(", ");
}

export function readSavedPlace(storage = typeof window !== "undefined" ? window.localStorage : null) {
  try {
    const place = JSON.parse(storage?.getItem(STORAGE_KEY) || "null");
    return place && Number.isFinite(place.lat) && Number.isFinite(place.lng) && typeof place.label === "string" ? place : null;
  } catch {
    return null;
  }
}

export function savePlace(place, storage = typeof window !== "undefined" ? window.localStorage : null) {
  try {
    if (place) storage?.setItem(STORAGE_KEY, JSON.stringify({ label: place.label, lat: place.lat, lng: place.lng }));
    else storage?.removeItem(STORAGE_KEY);
  } catch {
    /* sin almacenamiento: solo no se recuerda */
  }
}
