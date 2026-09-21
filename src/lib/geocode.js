// Búsqueda de direcciones para el mapa de valuación (Nominatim/OpenStreetMap,
// sin llave). Solo se llama cuando el asesor manda la búsqueda — nunca al
// teclear — porque la política de uso de Nominatim pide máximo 1 petición por
// segundo y prohíbe el autocompletado. El texto buscado sale hacia ese servicio.
const ENDPOINT = "https://nominatim.openstreetmap.org/search";

// Caja de La Comarca Lagunera (oeste,norte,este,sur). Con bounded=0 solo
// *prioriza* resultados de ahí, no descarta el resto de México.
const COMARCA_VIEWBOX = "-103.75,25.75,-103.20,25.35";

export async function searchAddress(query, { signal } = {}) {
  const params = new URLSearchParams({
    q: query.trim(),
    format: "jsonv2",
    limit: "5",
    countrycodes: "mx",
    viewbox: COMARCA_VIEWBOX,
    bounded: "0",
    "accept-language": "es",
  });
  const response = await fetch(`${ENDPOINT}?${params}`, { signal });
  if (!response.ok) throw new Error(`Geocoding failed (${response.status})`);
  const rows = await response.json();
  return rows.map((row) => ({
    id: row.place_id,
    label: row.display_name,
    lat: Number(row.lat),
    lng: Number(row.lon),
  }));
}
