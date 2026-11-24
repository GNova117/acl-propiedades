// Consentimiento de cookies de analítica (Google Analytics). Sin una respuesta afirmativa de la persona no se
// carga nada de Google: ver initAnalytics en analytics.js. La decisión se guarda en este navegador; si el
// almacenamiento está bloqueado, vale solo mientras la pestaña siga abierta (el aviso volverá a salir al regresar).
const KEY = "acl_cookie_consent";
const CHANGE_EVENT = "acl:consent-change";
export const OPEN_CONSENT_EVENT = "acl:consent-open";

let memory = null;

export function getConsent() {
  try {
    const stored = window.localStorage.getItem(KEY);
    if (stored === "granted" || stored === "denied") return stored;
  } catch {
    /* sin almacenamiento: se usa lo recordado en memoria */
  }
  return memory;
}

export function setConsent(value) {
  if (value !== "granted" && value !== "denied") return;
  memory = value;
  try {
    window.localStorage.setItem(KEY, value);
  } catch {
    /* sin almacenamiento */
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: value }));
}

// Avisa cada vez que cambia la decisión; devuelve la función para dejar de escuchar.
export function subscribeConsent(callback) {
  const handler = (event) => callback(event.detail);
  window.addEventListener(CHANGE_EVENT, handler);
  return () => window.removeEventListener(CHANGE_EVENT, handler);
}

// Para el enlace "Preferencias de cookies" del pie: vuelve a mostrar el aviso.
export function openConsentPreferences() {
  window.dispatchEvent(new Event(OPEN_CONSENT_EVENT));
}
