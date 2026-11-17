// Foto o video PROPIO (de La Laguna) para el primer panel de la portada del inicio. Se configura con variables de entorno
// del build (nada de esto va en el código):
//   VITE_HERO_IMAGE_URL   foto que reemplaza la de stock (https://… o una ruta del propio sitio, p. ej. /hero/laguna.jpg)
//   VITE_HERO_VIDEO_URL   video corto en bucle (.mp4 o .webm), sin sonido; se muestra encima de la foto
//   VITE_HERO_POSTER_URL  foto que se ve mientras carga el video (si no, se usa la de arriba)
// Sin ninguna, la portada se ve como siempre. Funciones puras.

const VIDEO_EXT = /\.(mp4|webm)(\?.*)?$/i;

// Solo https o rutas del propio sitio (nunca javascript:, data: ni http suelto).
export function safeMediaUrl(value) {
  const url = String(value ?? "").trim();
  if (!url) return null;
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  try {
    return new URL(url).protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

export function heroMedia(env = {}) {
  const image = safeMediaUrl(env.VITE_HERO_IMAGE_URL);
  const videoCandidate = safeMediaUrl(env.VITE_HERO_VIDEO_URL);
  const video = videoCandidate && VIDEO_EXT.test(videoCandidate) ? videoCandidate : null;
  const poster = safeMediaUrl(env.VITE_HERO_POSTER_URL) || image;
  return { image, video, poster };
}

// ¿Conviene reproducir el video? No con «reducir movimiento» (accesibilidad), ni con ahorro de datos, ni con conexión
// lenta: en esos casos se queda la foto.
export function shouldPlayVideo({ reducedMotion = false, saveData = false, effectiveType = "4g" } = {}) {
  if (reducedMotion || saveData) return false;
  return !["slow-2g", "2g", "3g"].includes(String(effectiveType));
}

// Lee lo del navegador (con comprobaciones: no todos los navegadores traen la API de conexión).
export function browserVideoConditions(win = typeof window !== "undefined" ? window : undefined) {
  const connection = win?.navigator?.connection;
  return {
    reducedMotion: Boolean(win?.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches),
    saveData: Boolean(connection?.saveData),
    effectiveType: connection?.effectiveType || "4g",
  };
}
