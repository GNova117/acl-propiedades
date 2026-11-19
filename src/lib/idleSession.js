// Cierre de sesión por inactividad del panel: el panel guarda INE, CURP y contraseñas de portales, y una computadora
// compartida o un teléfono olvidado no deben quedarse con la sesión abierta para siempre.
// Por omisión 30 minutos sin tocar nada (VITE_IDLE_LOGOUT_MINUTES; 0 la apaga), con un aviso de 60 s antes. La última
// actividad se comparte entre pestañas (localStorage), así que trabajar en una mantiene viva a las demás.
export const ACTIVITY_KEY = "acl_last_activity";
export const DEFAULT_IDLE_MINUTES = 30;
export const WARNING_MS = 60_000;

// → milisegundos de inactividad permitidos (0 = apagado). `override` es un gancho para pruebas (window.__ACL_IDLE_LIMIT_MS__).
export function idleLimitMs(envValue = import.meta.env?.VITE_IDLE_LOGOUT_MINUTES, override) {
  if (Number.isFinite(Number(override)) && Number(override) > 0) return Number(override);
  if (envValue === undefined || envValue === null || envValue === "") return DEFAULT_IDLE_MINUTES * 60_000;
  const minutes = Number(envValue);
  return Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes * 60_000) : 0;
}

// → { state: "active" | "warning" | "expired", remainingMs }
export function idleState(lastActivity, now, limitMs, warnMs = WARNING_MS) {
  if (!limitMs) return { state: "active", remainingMs: Infinity };
  const last = Number(lastActivity);
  const idle = Number.isFinite(last) && last > 0 ? Math.max(0, now - last) : 0;
  const remainingMs = limitMs - idle;
  if (remainingMs <= 0) return { state: "expired", remainingMs: 0 };
  // Con un límite muy corto el aviso no puede ser más largo que el límite mismo.
  if (remainingMs <= Math.min(warnMs, limitMs - 1)) return { state: "warning", remainingMs };
  return { state: "active", remainingMs };
}

export function readLastActivity(storage = typeof localStorage === "undefined" ? null : localStorage) {
  try {
    const value = Number(storage?.getItem(ACTIVITY_KEY));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

export function writeLastActivity(now, storage = typeof localStorage === "undefined" ? null : localStorage) {
  try {
    storage?.setItem(ACTIVITY_KEY, String(now));
  } catch {
    /* sin almacenamiento: queda la marca en memoria de la pestaña */
  }
}
