// Borrador automático de formularios largos: se guarda en este navegador lo que se va capturando (sin archivos) y, si se
// cierra la pestaña o se pierde la conexión, se ofrece recuperarlo. Nada se aplica solo: la persona decide.
const PREFIX = "acl_draft_";
const MAX_AGE_DAYS = 14;

const store = () => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
};

export const draftKey = (name, id = "nuevo") => `${PREFIX}${name}_${id}`;

// ¿Hay algo que valga la pena guardar? Solo si el formulario cambió respecto a su punto de partida.
export const isMeaningful = (form, baseline) => JSON.stringify(form) !== JSON.stringify(baseline);

export function saveDraft(key, data, { now = Date.now(), storage = store() } = {}) {
  if (!storage) return false;
  try {
    storage.setItem(key, JSON.stringify({ savedAt: now, data }));
    return true;
  } catch {
    return false; // sin espacio o almacenamiento bloqueado: el formulario sigue funcionando
  }
}

// → { data, savedAt } o null (sin borrador, ilegible o de hace más de 14 días, que se borra).
export function loadDraft(key, { now = Date.now(), storage = store() } = {}) {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.savedAt !== "number" || parsed.data == null) return null;
    if (now - parsed.savedAt > MAX_AGE_DAYS * 86400000) {
      storage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearDraft(key, { storage = store() } = {}) {
  try {
    storage?.removeItem(key);
  } catch {
    /* nada que limpiar */
  }
}
