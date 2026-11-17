// Encuesta tras la visita (/opinion/<token>): qué se le dice a quien ya calificó.
//
// A quien califica 4 o 5 se le invita a contarlo también en Google (solo si hay un enlace de reseña configurado:
// VITE_GOOGLE_REVIEW_URL); a quien califica menos NO se le empuja a una reseña pública: se le agradece la franqueza y
// el equipo ve su opinión en la Agenda. Es invitar, no condicionar ni pagar por reseñas.
export const REVIEW_INVITE_MIN_RATING = 4;

export function surveyOutcome(rating, { googleReviewUrl = "" } = {}) {
  const url = String(googleReviewUrl || "").trim();
  const isHttps = /^https:\/\/[^\s]+$/i.test(url);
  return { invite: Number(rating) >= REVIEW_INVITE_MIN_RATING && isHttps };
}
