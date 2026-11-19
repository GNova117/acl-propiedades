// @ts-check
// Dos apps instalables en el mismo sitio: la pública («ACL Propiedades», para clientes) y la del panel («ACL Panel», para el
// equipo). Cada una tiene su manifiesto; cuál se enlaza depende de la zona en la que está la persona. public/manifest-switch.js
// hace la elección al cargar la página (antes de que el navegador evalúe si es instalable) y este módulo la repite cuando la
// persona navega de una zona a otra sin recargar.
export const PUBLIC_MANIFEST = "/manifest-public.webmanifest";
export const ADMIN_MANIFEST = "/manifest.webmanifest";

/** @param {string} pathname */
export const isAdminPath = (pathname) => pathname === "/admin" || String(pathname).startsWith("/admin/");

/** @param {string} pathname */
export const manifestFor = (pathname) => (isAdminPath(pathname) ? ADMIN_MANIFEST : PUBLIC_MANIFEST);

/** @param {string} pathname */
export const appTitleFor = (pathname) => (isAdminPath(pathname) ? "ACL Panel" : "ACL Propiedades");

/** @param {string} pathname @param {Document} [doc] */
export function applyManifest(pathname, doc = document) {
  const link = doc.querySelector('link[rel="manifest"]');
  const wanted = manifestFor(pathname);
  if (link && link.getAttribute("href") !== wanted) link.setAttribute("href", wanted);
  const title = doc.querySelector('meta[name="apple-mobile-web-app-title"]');
  if (title) title.setAttribute("content", appTitleFor(pathname));
}
