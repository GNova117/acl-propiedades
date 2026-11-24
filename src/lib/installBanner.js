// @ts-check
// Cuándo ofrecer instalar la app PÚBLICA a un visitante: sin estorbar. Solo después de que ya recorrió algo del sitio (2 páginas),
// nunca si ya la instaló o si dijo «ahora no» (se le vuelve a ofrecer en 30 días), y solo si el navegador puede instalarla
// (Chrome/Edge/Android con su aviso propio) o es un iPhone/iPad (donde hay que explicar «Compartir → Agregar a inicio»).
export const MIN_PAGES = 2;
export const DISMISS_DAYS = 30;
export const VIEWS_KEY = "acl_pwa_views";
export const DISMISS_KEY = "acl_pwa_dismissed_until";

/**
 * @param {{ views: number, dismissedUntil: number, now: number, standalone: boolean, canPrompt: boolean, ios: boolean }} state
 */
export function shouldShowInstallBanner({ views, dismissedUntil, now, standalone, canPrompt, ios }) {
  if (standalone) return false;
  if (views < MIN_PAGES) return false;
  if (now < dismissedUntil) return false;
  return canPrompt || ios;
}

export const dismissUntil = (now = Date.now()) => now + DISMISS_DAYS * 86400000;
