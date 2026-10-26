// Consulta a Google Places API (New) de la calificación y reseñas de la
// inmobiliaria — ver api/google-reviews.js y src/lib/googleReviews.js
// (interpretación, con pruebas). Vive fuera de api/ por la misma razón que
// mortgageRate.js: todo archivo en api/ es una ruta pública de Vercel.
// GOOGLE_PLACES_API_KEY nunca sale de aquí.
import { parsePlaceResponse } from "../src/lib/googleReviews.js";

const FIELD_MASK = "rating,userRatingCount,googleMapsUri,reviews";

export class GoogleReviewsError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export async function fetchPlaceReviews({ apiKey, placeId, fetchImpl = fetch, timeoutMs = 8000 } = {}) {
  if (!apiKey || !placeId) throw new GoogleReviewsError("bad_key", "Faltan GOOGLE_PLACES_API_KEY o GOOGLE_PLACE_ID.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetchImpl(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=es`, {
      headers: { Accept: "application/json", "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": FIELD_MASK },
      signal: controller.signal,
    });
  } catch (err) {
    throw new GoogleReviewsError(err?.name === "AbortError" ? "timeout" : "upstream", err?.message || "No se pudo consultar Google.");
  } finally {
    clearTimeout(timeout);
  }

  if (res.status === 400 || res.status === 401 || res.status === 403) throw new GoogleReviewsError("bad_key", "La llave de Google no es válida o no tiene Places API habilitada.");
  if (res.status === 404) throw new GoogleReviewsError("not_found", "No se encontró el lugar (revisa GOOGLE_PLACE_ID).");
  if (res.status === 429) throw new GoogleReviewsError("rate_limited", "Google está limitando las consultas.");
  if (!res.ok) throw new GoogleReviewsError("upstream", `Google respondió ${res.status}.`);

  const json = await res.json().catch(() => null);
  const parsed = parsePlaceResponse(json);
  if (!parsed) throw new GoogleReviewsError("no_data", "El lugar no tiene calificación todavía.");
  return parsed;
}
