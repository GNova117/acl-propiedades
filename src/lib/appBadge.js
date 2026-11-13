// Número de pendientes sobre el ícono de la app instalada (Badging API: Chrome/Edge en computadora y Android; Safari en iPhone solo
// si la app está en la pantalla de inicio y dio permiso de notificaciones). Donde no existe, o no está instalada, no hace nada.
// Es un adorno: nunca debe hacer fallar la pantalla, así que todo va protegido.

export const MAX_BADGE = 99;

export const badgeSupported = () => typeof navigator !== "undefined" && typeof navigator.setAppBadge === "function";

// `count` > 0 pone el número (tope 99); 0, vacío o inválido lo quita. Devuelve lo que quedó puesto (0 = sin insignia).
export function setAppBadge(count) {
  const n = Math.min(MAX_BADGE, Math.max(0, Math.floor(Number(count) || 0)));
  if (!badgeSupported()) return 0;
  try {
    const done = n > 0 ? navigator.setAppBadge(n) : navigator.clearAppBadge?.();
    done?.catch?.(() => {});
  } catch {
    return 0;
  }
  return n;
}

export const clearAppBadge = () => setAppBadge(0);
