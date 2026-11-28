// ¿Conviene el visor por páginas (canvas) en vez del <iframe> nativo? En pantallas chicas o táctiles el iframe suele mostrar
// solo la primera página del PDF, así que ahí se usa pdf.js.
const MOBILE_QUERY = "(max-width: 768px), (pointer: coarse)";

export function prefersCanvasViewer(win = typeof window === "undefined" ? undefined : window) {
  try {
    return Boolean(win && typeof win.matchMedia === "function" && win.matchMedia(MOBILE_QUERY).matches);
  } catch {
    return false;
  }
}
