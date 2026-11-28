// "Qué hay cerca" de una propiedad (escuelas, salud, comercio, parques) para
// la ficha pública. Pública y de solo lectura: el único dato que recibe son
// coordenadas de una propiedad que ya es pública, y no hay llave ni gasto por
// consulta — pero sí un servicio externo gratuito (Overpass) al que hay que
// cuidar, por eso: (1) las coordenadas se redondean a ~110 m para que
// propiedades vecinas compartan respuesta, y (2) Cache-Control deja que el
// CDN de Vercel conteste casi todas las visitas sin volver a consultarlo (los
// comercios cambian poco; una semana es de sobra).
import { fetchNearbyPlaces, NearbyError } from "../server/nearbyPlaces.js";
import { nearbyPropertyBox, parseCoords } from "../src/lib/nearbyPlaces.js";

// true/false si se pudo consultar; null si no hay base configurada o falló (entonces solo vale la caja de México).
async function hasPublishedPropertyNear(coords) {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const box = nearbyPropertyBox(coords);
  const query = `${url}/rest/v1/properties?select=id&active=eq.true&lat=gte.${box.minLat}&lat=lte.${box.maxLat}&lng=gte.${box.minLng}&lng=lte.${box.maxLng}&limit=1`;
  try {
    const res = await fetch(query, { headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const rows = await res.json();
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "method" });
    return;
  }

  const coords = parseCoords(req.query);
  if (!coords) {
    res.setHeader("Cache-Control", "no-store");
    res.status(400).json({ error: "coords" });
    return;
  }

  // Solo alrededor de una propiedad publicada (ver nearbyPropertyBox). Si no se puede consultar la base, se queda la validación de la caja.
  if ((await hasPublishedPropertyNear(coords)) === false) {
    res.setHeader("Cache-Control", "no-store");
    res.status(400).json({ error: "coords" });
    return;
  }

  try {
    const places = await fetchNearbyPlaces(coords);
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000");
    res.status(200).json({ available: true, places });
  } catch (err) {
    res.setHeader("Cache-Control", "no-store");
    const code = err instanceof NearbyError ? err.code : "upstream";
    res.status(200).json({ available: false, error: code });
  }
}
