// Calificación y reseñas de Google de la inmobiliaria para el inicio. Pública
// y de solo lectura (no recibe nada del visitante), pero cada consulta a
// Places API cuesta dinero, por eso Cache-Control deja que el CDN de Vercel
// conteste casi todas las visitas: una consulta a Google por hora, no una por
// visitante. Sin GOOGLE_PLACES_API_KEY y GOOGLE_PLACE_ID el sitio funciona
// igual, solo sin ese bloque.
import { fetchPlaceReviews, GoogleReviewsError } from "../server/googleReviews.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "method" });
    return;
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const placeId = process.env.GOOGLE_PLACE_ID;
  if (!apiKey || !placeId) {
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ configured: false });
    return;
  }

  try {
    const place = await fetchPlaceReviews({ apiKey, placeId });
    res.setHeader("Cache-Control", "public, max-age=1800, s-maxage=3600, stale-while-revalidate=600");
    res.status(200).json({ configured: true, available: true, ...place });
  } catch (err) {
    res.setHeader("Cache-Control", "no-store");
    const code = err instanceof GoogleReviewsError ? err.code : "upstream";
    res.status(200).json({ configured: true, available: false, error: code });
  }
}
