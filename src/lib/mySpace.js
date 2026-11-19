// «Mi espacio»: una sola página para que el cliente encuentre los enlaces que ya abrió —su visita
// agendada, su portal de documentos, un documento por firmar, una selección de su asesor— sin tener
// que buscar los mensajes. No hay cuenta de cliente: cada vez que abre uno de esos enlaces, el
// dispositivo anota el enlace con un título genérico, y «Mi espacio» los junta (con los favoritos).
//
// Todo vive en el dispositivo (localStorage) y se puede quitar. NO se guarda el nombre del cliente ni
// nada de lo que escribió: solo qué enlace es, un título corto y un detalle (fecha de la visita,
// cuántos pendientes…). Estado actualizado: al tocar el enlace, la página trae lo vigente.

export const MY_SPACE_KINDS = ["visit", "portal", "sign", "selection"];
export const MY_SPACE_MAX = 30;
const STORAGE_KEY = "acl_my_space";
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,80}$/;
const PATHS = { visit: "/visita/", portal: "/documentos/", sign: "/firmar/", selection: "/seleccion/" };

const clip = (value, max) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);

const defaultStorage = () => (typeof window !== "undefined" ? window.localStorage : null);

function read(storage) {
  try {
    const raw = JSON.parse(storage?.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(raw) ? raw.filter((item) => MY_SPACE_KINDS.includes(item?.kind) && TOKEN_PATTERN.test(item?.token || "")) : [];
  } catch {
    return [];
  }
}

function write(storage, items) {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* sin almacenamiento: solo no se recuerda */
  }
}

export const itemPath = (item) => `${PATHS[item.kind]}${item.token}`;

// Anota (o actualiza) un enlace. Lo más reciente va primero. `now` se puede inyectar en pruebas.
export function rememberItem({ kind, token, title, detail }, { storage = defaultStorage(), now = Date.now() } = {}) {
  if (!MY_SPACE_KINDS.includes(kind) || !TOKEN_PATTERN.test(token || "")) return;
  const rest = read(storage).filter((item) => !(item.kind === kind && item.token === token));
  const entry = { kind, token, title: clip(title, 120), detail: clip(detail, 160), at: now };
  write(storage, [entry, ...rest].slice(0, MY_SPACE_MAX));
}

export function getItems({ storage = defaultStorage() } = {}) {
  return read(storage).sort((a, b) => (b.at || 0) - (a.at || 0));
}

export function forgetItem(kind, token, { storage = defaultStorage() } = {}) {
  write(storage, read(storage).filter((item) => !(item.kind === kind && item.token === token)));
}

export function clearItems({ storage = defaultStorage() } = {}) {
  write(storage, []);
}

// Agrupa para la pantalla, en el orden en que se muestran los apartados.
export function groupItems(items) {
  return MY_SPACE_KINDS.map((kind) => ({ kind, items: items.filter((item) => item.kind === kind) })).filter((group) => group.items.length > 0);
}
