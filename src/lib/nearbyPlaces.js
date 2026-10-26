// Lugares de interés cerca de una propiedad (escuelas, salud, comercio,
// parques), a partir de OpenStreetMap vía Overpass. Esta parte es pura y la
// comparten el servidor (arma la consulta e interpreta la respuesta) y el
// navegador (valida lo que recibe); la llamada de red vive en
// server/nearbyPlaces.js y api/nearby-places.js.

export const NEARBY_RADIUS_M = 1500;
export const NEARBY_MAX_PER_CATEGORY = 3;

// Cada categoría: filtros de OSM (clave/valores) que la definen.
export const NEARBY_CATEGORIES = [
  { key: "schools", filters: [["amenity", ["school", "kindergarten", "college", "university"]]] },
  { key: "health", filters: [["amenity", ["hospital", "clinic"]]] },
  { key: "shopping", filters: [["shop", ["supermarket", "mall", "department_store"]]] },
  { key: "parks", filters: [["leisure", ["park"]]] },
];

export function buildOverpassQuery(lat, lng, radius = NEARBY_RADIUS_M) {
  const around = `(around:${Math.round(radius)},${Number(lat).toFixed(5)},${Number(lng).toFixed(5)})`;
  const parts = NEARBY_CATEGORIES.flatMap((category) =>
    category.filters.map(([key, values]) => `nwr${around}[${key}~"^(${values.join("|")})$"];`),
  );
  return `[out:json][timeout:15];(${parts.join("")});out center tags 300;`;
}

export function categoryOf(tags = {}) {
  for (const category of NEARBY_CATEGORIES) {
    for (const [key, values] of category.filters) {
      if (values.includes(tags[key])) return category.key;
    }
  }
  return null;
}

// Distancia en metros entre dos puntos (haversine).
export function distanceMeters(lat1, lng1, lat2, lng2) {
  const rad = (deg) => (deg * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(a));
}

// Convierte los elementos de Overpass en { categoría: { count, nearest[] } }.
// Sin nombre no se lista (pero sí cuenta); un mismo nombre solo sale una vez
// (un colegio suele venir como varios edificios). Los de la misma categoría
// se ordenan por cercanía.
export function summarizeNearby(elements, lat, lng, { maxPerCategory = NEARBY_MAX_PER_CATEGORY, radius = NEARBY_RADIUS_M } = {}) {
  const result = Object.fromEntries(NEARBY_CATEGORIES.map((c) => [c.key, { count: 0, nearest: [] }]));
  const seen = new Set();

  const found = [];
  for (const el of elements || []) {
    const category = categoryOf(el.tags);
    const elLat = el.lat ?? el.center?.lat;
    const elLng = el.lon ?? el.center?.lon;
    if (!category || typeof elLat !== "number" || typeof elLng !== "number") continue;
    const dist = distanceMeters(lat, lng, elLat, elLng);
    if (dist > radius * 1.05) continue;
    found.push({ category, name: (el.tags?.name || "").trim(), distanceM: Math.round(dist) });
  }
  found.sort((a, b) => a.distanceM - b.distanceM);

  for (const item of found) {
    const dedupeKey = `${item.category}:${item.name.toLowerCase() || `__${seen.size}_${item.distanceM}`}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    const bucket = result[item.category];
    bucket.count += 1;
    if (item.name && bucket.nearest.length < maxPerCategory) bucket.nearest.push({ name: item.name, distanceM: Math.round(item.distanceM / 10) * 10 });
  }
  return result;
}

export function hasNearbyData(summary) {
  return Boolean(summary) && NEARBY_CATEGORIES.some((c) => summary[c.key]?.count > 0);
}

export function formatDistance(meters) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters / 10) * 10} m`;
}

// Caja que cubre México: fuera de ella no se consulta (evita usar el
// endpoint como proxy genérico de Overpass).
const MEXICO_BOUNDS = { minLat: 14, maxLat: 33, minLng: -119, maxLng: -86 };

// Valida y redondea (a ~110 m, para compartir caché entre propiedades vecinas)
// las coordenadas que llegan a api/nearby-places.js. null si no son válidas.
export function parseCoords(query = {}) {
  const lat = Number(query.lat);
  const lng = Number(query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < MEXICO_BOUNDS.minLat || lat > MEXICO_BOUNDS.maxLat || lng < MEXICO_BOUNDS.minLng || lng > MEXICO_BOUNDS.maxLng) return null;
  return { lat: Math.round(lat * 1000) / 1000, lng: Math.round(lng * 1000) / 1000 };
}
