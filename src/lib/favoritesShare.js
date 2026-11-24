// Lista de favoritos compartible por enlace: /favoritos?lista=<id>,<id>,… Los favoritos viven en el
// dispositivo (sin cuenta), así que el enlace es también la forma de pasar la lista a otro
// dispositivo o a otra persona: quien lo abre ve la lista y puede guardarla en SUS favoritos.
//
// El enlace solo lleva ids de propiedades públicas (lo mismo que ya muestra el sitio), nada personal.

export const SHARED_MAX = 30;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export function buildFavoritesShareUrl(origin, ids) {
  const clean = [...new Set((ids || []).filter((id) => ID_PATTERN.test(String(id))))].slice(0, SHARED_MAX);
  return clean.length === 0 ? `${origin}/favoritos` : `${origin}/favoritos?lista=${clean.join(",")}`;
}

// Ids válidos, sin repetir y como mucho SHARED_MAX; lo que no parezca un id se descarta.
export function parseSharedIds(search) {
  const raw = new URLSearchParams(search || "").get("lista");
  if (!raw) return [];
  return [...new Set(raw.split(",").map((id) => id.trim()).filter((id) => ID_PATTERN.test(id)))].slice(0, SHARED_MAX);
}

// Une la lista compartida con los favoritos que ya había, sin repetir y respetando el orden.
export function mergeFavorites(current, incoming) {
  return [...new Set([...(current || []), ...(incoming || [])])];
}
