// Dirección pública del sitio (https://tu-dominio.com, sin «/» al final), configurable por variable de entorno:
// SITE_URL o VITE_SITE_URL. Sin ninguna (o con algo que no sea https) se usa la de Vercel de siempre. Así, al comprar el
// dominio propio basta con definir la variable en Vercel; el middleware de vista previa, el sitemap y el robots.txt la leen.
export const DEFAULT_SITE_URL = "https://acl-propiedades.vercel.app";

export function resolveSiteUrl(env = {}) {
  const raw = String(env.SITE_URL || env.VITE_SITE_URL || "").trim().replace(/\/+$/, "");
  try {
    const url = new URL(raw);
    if (url.protocol === "https:" && !url.search && !url.hash && (url.pathname === "/" || url.pathname === "")) return url.origin;
  } catch {
    // vacío o inválido: se usa la de siempre
  }
  return DEFAULT_SITE_URL;
}
