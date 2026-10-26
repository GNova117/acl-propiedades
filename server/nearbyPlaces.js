// Consulta a Overpass (OpenStreetMap) de lugares cerca de una propiedad — ver
// api/nearby-places.js y src/lib/nearbyPlaces.js (consulta e interpretación,
// que sí tienen pruebas). Vive fuera de api/ por la misma razón que
// mortgageRate.js: todo archivo en api/ es una ruta pública de Vercel.
// Overpass es un servicio público y gratuito sin llave: se intenta con dos
// servidores y, si ninguno responde, la ficha simplemente no muestra el bloque.
import { buildOverpassQuery, summarizeNearby, NEARBY_RADIUS_M } from "../src/lib/nearbyPlaces.js";

export const OVERPASS_ENDPOINTS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
// La política de uso de OSM pide identificar la aplicación.
const USER_AGENT = "acl-propiedades/1.0 (https://acl-propiedades.vercel.app)";

export class NearbyError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

async function queryEndpoint(url, query, fetchImpl, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json", "User-Agent": USER_AGENT },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });
    if (res.status === 429) throw new NearbyError("rate_limited", "Overpass está limitando las consultas.");
    if (!res.ok) throw new NearbyError("upstream", `Overpass respondió ${res.status}.`);
    const json = await res.json().catch(() => null);
    if (!json || !Array.isArray(json.elements)) throw new NearbyError("bad_response", "Respuesta inesperada de Overpass.");
    return json.elements;
  } catch (err) {
    if (err instanceof NearbyError) throw err;
    throw new NearbyError(err?.name === "AbortError" ? "timeout" : "upstream", err?.message || "No se pudo consultar Overpass.");
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchNearbyPlaces({ lat, lng, radius = NEARBY_RADIUS_M, fetchImpl = fetch, timeoutMs = 9000, endpoints = OVERPASS_ENDPOINTS } = {}) {
  const query = buildOverpassQuery(lat, lng, radius);
  let lastError = new NearbyError("upstream", "Sin servidores de Overpass.");
  for (const url of endpoints) {
    try {
      const elements = await queryEndpoint(url, query, fetchImpl, timeoutMs);
      return summarizeNearby(elements, lat, lng, { radius });
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}
