// "Vistos recientemente": solo se guardan ids + cuándo (localStorage, por
// navegador, nunca sale de ahí) — los datos de la propiedad en sí (precio,
// fotos, estatus) se piden siempre frescos a la base al mostrarlos, para no
// enseñar un precio viejo o una propiedad que ya se vendió/borró.
const STORAGE_KEY = "acl_recently_viewed";
export const MAX_RECENTLY_VIEWED = 8;

// Función pura: mete el id al frente (si ya estaba, se mueve, no se
// duplica) y recorta al tope.
export function mergeRecentlyViewedIds(ids, propertyId, maxItems = MAX_RECENTLY_VIEWED) {
  if (!propertyId) return (ids || []).slice(0, maxItems);
  const withoutDupe = (ids || []).filter((id) => id !== propertyId);
  return [propertyId, ...withoutDupe].slice(0, maxItems);
}

function readIds() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeIds(ids) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // localStorage lleno/bloqueado (o modo privado): no es grave, solo no
    // queda guardado el historial de esta visita.
  }
}

export function recordPropertyView(propertyId) {
  writeIds(mergeRecentlyViewedIds(readIds(), propertyId));
}

export function getRecentlyViewedIds({ excludeId } = {}) {
  return readIds().filter((id) => id !== excludeId);
}
