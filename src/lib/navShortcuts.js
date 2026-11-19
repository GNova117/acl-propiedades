// Atajos del menú del panel: lo que la persona FIJA arriba y lo que visitó hace poco. Se guardan en este dispositivo
// (localStorage), por persona. Funciones puras salvo load/save. Un elemento del menú se identifica por su ruta (`to`).

export const MAX_PINS = 8;
export const MAX_RECENTS = 4;

const key = (kind, email) => `acl.adminNav.${kind}.${String(email || "anon").toLowerCase()}`;

const readList = (kind, email, storage) => {
  try {
    const raw = JSON.parse(storage?.getItem(key(kind, email)) || "[]");
    return Array.isArray(raw) ? raw.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
};
const writeList = (kind, email, list, storage) => {
  try {
    storage?.setItem(key(kind, email), JSON.stringify(list));
  } catch {
    // sin almacenamiento: vale mientras la pantalla siga abierta
  }
};

const defaultStorage = () => (typeof localStorage !== "undefined" ? localStorage : null);
export const loadPins = (email, storage = defaultStorage()) => readList("pins", email, storage).slice(0, MAX_PINS);
export const savePins = (email, pins, storage = defaultStorage()) => writeList("pins", email, pins, storage);
export const loadRecents = (email, storage = defaultStorage()) => readList("recents", email, storage).slice(0, MAX_RECENTS);
export const saveRecents = (email, recents, storage = defaultStorage()) => writeList("recents", email, recents, storage);

// Fija o desfija. Con el tope lleno no se agrega otro (se devuelve la misma lista).
export function togglePin(pins, to) {
  if (pins.includes(to)) return pins.filter((p) => p !== to);
  return pins.length >= MAX_PINS ? pins : [...pins, to];
}

// La ruta visitada pasa al frente de «recientes» (sin repetirse).
export function pushRecent(recents, to) {
  return [to, ...recents.filter((r) => r !== to)].slice(0, MAX_RECENTS);
}

// La ruta del menú a la que pertenece la dirección actual (la más específica que la contiene), o null.
export function itemForPath(pathname, itemPaths) {
  const matches = itemPaths.filter((to) => pathname === to || pathname.startsWith(`${to}/`));
  return matches.sort((a, b) => b.length - a.length)[0] ?? null;
}

// Lo que se dibuja: `items` = todos los elementos visibles del menú ({ to, ... }) en su orden; `openPaths` = las rutas
// que ya se ven porque su carpeta está abierta. Los FIJADOS salen arriba (y ya no en su carpeta); los RECIENTES solo los
// que no están fijados ni a la vista (si ya se ven, repetirlos estorba) y que la persona todavía puede usar.
export function resolveShortcuts(items, pins, recents, openPaths = new Set()) {
  const byTo = new Map(items.map((i) => [i.to, i]));
  const pinned = pins.map((to) => byTo.get(to)).filter(Boolean);
  const pinnedSet = new Set(pinned.map((i) => i.to));
  const recent = recents.map((to) => byTo.get(to)).filter((i) => i && !pinnedSet.has(i.to) && !openPaths.has(i.to));
  return { pinned, recent };
}
