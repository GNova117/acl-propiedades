// Dirección pública del sitio y URLs por idioma (canonical / hreflang). Con dominio propio se define VITE_SITE_URL en
// Vercel (ver server/siteUrl.js, que hace lo mismo del lado del servidor); sin ella se usa el origen desde el que se abre.
export function siteOrigin(env = import.meta.env, fallback = typeof window !== "undefined" ? window.location.origin : "") {
  const raw = String(env?.VITE_SITE_URL || "").trim();
  try {
    const url = new URL(raw);
    if (url.protocol === "https:") return url.origin;
  } catch {
    /* sin dominio configurado */
  }
  return fallback;
}

// Idiomas del sitio. El español es el de la ruta sin parámetro; el inglés se pide con ?lang=en (i18n lo lee de ahí).
export const LANG_PARAM = "lang";

export function languageUrl(origin, pathname, lang) {
  const path = pathname && pathname !== "/" ? pathname.replace(/\/+$/, "") : "";
  return `${origin}${path || "/"}${lang === "en" ? `?${LANG_PARAM}=en` : ""}`;
}

// Todas las variantes de una ruta para <link rel="alternate" hreflang>, incluido x-default (español).
export function alternateLinks(origin, pathname) {
  return [
    { hreflang: "es", href: languageUrl(origin, pathname, "es") },
    { hreflang: "en", href: languageUrl(origin, pathname, "en") },
    { hreflang: "x-default", href: languageUrl(origin, pathname, "es") },
  ];
}
