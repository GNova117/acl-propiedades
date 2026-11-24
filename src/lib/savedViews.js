// Vistas guardadas de una lista (Prospectos, Propiedades): «mis filtros de siempre» a un toque. Se guardan EN ESTE
// DISPOSITIVO (localStorage), por lista; no viajan a otro dispositivo ni a otra persona. Funciones puras salvo load/save.

export const MAX_VIEWS = 8;
export const NAME_MAX = 40;

const storageKey = (list) => `acl.savedViews.${list}`;

// `schema`: { campo: "string" | "boolean" | "number" } — lo único que puede entrar o salir de una vista. Lo demás se
// descarta (una vista vieja con un filtro que ya no existe, o con un valor del tipo equivocado, no rompe la lista).
export function sanitizeFilters(filters, schema) {
  const out = {};
  for (const [key, type] of Object.entries(schema)) {
    const value = filters?.[key];
    if (typeof value === type && (type !== "number" || Number.isFinite(value))) out[key] = value;
  }
  return out;
}

// ¿Hay algo distinto de «sin filtros»? Guardar una vista vacía no sirve.
export const hasActiveFilters = (filters, defaults = {}) => Object.entries(filters).some(([k, v]) => v !== (defaults[k] ?? (typeof v === "boolean" ? false : "")));

// → { views } con la vista nueva (o { error }): nombre de 1 a 40 caracteres, sin repetir (sin importar mayúsculas)
// y con tope. Guardar con un nombre que ya existe la reemplaza si `replace` es true.
export function addView(views, name, filters, schema, { replace = false } = {}) {
  const clean = String(name ?? "").trim().slice(0, NAME_MAX);
  if (!clean) return { error: "name" };
  const same = views.findIndex((v) => v.name.toLowerCase() === clean.toLowerCase());
  if (same !== -1 && !replace) return { error: "exists" };
  const view = { name: clean, filters: sanitizeFilters(filters, schema) };
  if (same !== -1) return { views: views.map((v, i) => (i === same ? view : v)) };
  if (views.length >= MAX_VIEWS) return { error: "full" };
  return { views: [...views, view] };
}

export const removeView = (views, name) => views.filter((v) => v.name !== name);

export function loadViews(list, schema, storage = typeof localStorage !== "undefined" ? localStorage : null) {
  try {
    const raw = JSON.parse(storage?.getItem(storageKey(list)) || "[]");
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((v) => v && typeof v.name === "string" && v.name.trim())
      .slice(0, MAX_VIEWS)
      .map((v) => ({ name: v.name.slice(0, NAME_MAX), filters: sanitizeFilters(v.filters, schema) }));
  } catch {
    return [];
  }
}

export function saveViews(list, views, storage = typeof localStorage !== "undefined" ? localStorage : null) {
  try {
    storage?.setItem(storageKey(list), JSON.stringify(views));
  } catch {
    // sin almacenamiento: la vista vale mientras la pantalla siga abierta.
  }
}
