// Reseñas de Google (Places API) para el inicio — ver api/google-reviews.js y
// server/googleReviews.js (la llamada). Aquí solo se interpreta la respuesta y
// se escogen las reseñas que se muestran; es puro y tiene pruebas.

export const MAX_REVIEWS_SHOWN = 3;
// Una reseña de "Excelente" sin texto, o de una palabra, no dice nada.
export const MIN_REVIEW_CHARS = 25;
export const MAX_REVIEW_CHARS = 320;

const clampRating = (n) => Math.min(5, Math.max(0, Math.round(Number(n) || 0)));

// Respuesta de Places API (New) → datos listos para pintar, o null si no trae
// calificación.
export function parsePlaceResponse(json) {
  const rating = Number(json?.rating);
  if (!Number.isFinite(rating) || rating <= 0) return null;
  const reviews = (Array.isArray(json.reviews) ? json.reviews : [])
    .map((r) => ({
      author: String(r?.authorAttribution?.displayName || "").trim(),
      authorUrl: String(r?.authorAttribution?.uri || ""),
      rating: clampRating(r?.rating),
      text: String(r?.text?.text || r?.originalText?.text || "").trim(),
      when: String(r?.relativePublishTimeDescription || ""),
    }))
    .filter((r) => r.author && r.rating > 0);
  return {
    rating: Math.round(rating * 10) / 10,
    total: Number(json.userRatingCount) > 0 ? Number(json.userRatingCount) : null,
    url: typeof json.googleMapsUri === "string" && json.googleMapsUri.startsWith("https://") ? json.googleMapsUri : null,
    reviews,
  };
}

// Solo reseñas de 4–5 estrellas con texto de longitud razonable. Se muestran
// con su calificación y autor reales (Google exige atribuirlas): no se
// reescriben; solo se recortan las muy largas, con "…".
export function pickReviews(reviews, max = MAX_REVIEWS_SHOWN) {
  return (reviews || [])
    .filter((r) => r.rating >= 4 && r.text.length >= MIN_REVIEW_CHARS)
    .slice(0, max)
    .map((r) => (r.text.length > MAX_REVIEW_CHARS ? { ...r, text: `${r.text.slice(0, MAX_REVIEW_CHARS).replace(/\s+\S*$/, "")}…` } : r));
}
