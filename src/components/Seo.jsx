import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { alternateLinks, languageUrl, siteOrigin } from "../lib/site";

const SITE_NAME = "ACL Propiedades";

// Imagen genérica para páginas sin foto propia (home, listados, nosotros, contacto): la de la marca, public/og-default.png.
// Ver también middleware.js: ese mismo default existe ahí por separado (no se puede compartir el módulo, corre en el
// edge, fuera del bundle de Vite) y es el que de verdad ve WhatsApp/Facebook, ya que no ejecutan JS.
const DEFAULT_IMAGE_PATH = "/og-default.png";

// `jsonLd`: objeto o arreglo de objetos schema.org — quien lo pase debe
// useMemo-izarlo para no disparar el efecto en cada render. Se REMUEVE si
// la página actual no manda jsonLd, para que no quede pegado el de una
// ficha anterior al navegar dentro de la SPA (el resto del contenido de
// esta etiqueta sí puede quedar "viejo" un instante sin problema, pero
// JSON-LD cambia de forma entre páginas, no solo de contenido).
// `image`: opcional — si no se manda, se usa DEFAULT_IMAGE. Estas
// etiquetas ayudan a cualquier consumidor que sí ejecute JavaScript
// (Google, un navegador con vista previa propia); WhatsApp/Facebook NO lo
// ejecutan, así que para esos la fuente real es el middleware de Vercel
// (`middleware.js`), no esto.
function upsertMeta(attr, key, content) {
  if (!content) {
    document.querySelector(`meta[${attr}="${key}"]`)?.remove();
    return;
  }
  let tag = document.querySelector(`meta[${attr}="${key}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

// <link rel="canonical"> y los <link rel="alternate" hreflang>: se reemplazan en cada página y se quitan si no aplican.
function setLinks(canonical, alternates) {
  document.querySelectorAll('link[data-seo-link]').forEach((node) => node.remove());
  const add = (attrs) => {
    const link = document.createElement("link");
    Object.entries(attrs).forEach(([k, v]) => link.setAttribute(k, v));
    link.setAttribute("data-seo-link", "");
    document.head.appendChild(link);
  };
  if (canonical) add({ rel: "canonical", href: canonical });
  alternates.forEach(({ hreflang, href }) => add({ rel: "alternate", hreflang, href }));
}

// `noindex`: páginas privadas o de utilería (404, enlaces personales): sin canonical ni hreflang y con robots noindex.
// `jsonLd` también acepta varios objetos; Seo no los mezcla, quien llama arma el arreglo.
export default function Seo({ title, description, image, jsonLd, noindex = false }) {
  const { i18n } = useTranslation();
  const { pathname } = useLocation();
  const lang = i18n.resolvedLanguage === "en" ? "en" : "es";

  useEffect(() => {
    document.documentElement.lang = lang;
    const origin = siteOrigin();
    setLinks(noindex ? null : languageUrl(origin, pathname, lang), noindex ? [] : alternateLinks(origin, pathname));
    upsertMeta("name", "robots", noindex ? "noindex, nofollow" : "");
    upsertMeta("property", "og:locale", lang === "en" ? "en_US" : "es_MX");
  }, [lang, noindex, pathname]);

  useEffect(() => {
    const fullTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME;
    document.title = fullTitle;

    if (description) {
      let tag = document.querySelector('meta[name="description"]');
      if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute("name", "description");
        document.head.appendChild(tag);
      }
      tag.setAttribute("content", description);
    }

    const resolvedImage = image || `${window.location.origin}${DEFAULT_IMAGE_PATH}`;

    upsertMeta("property", "og:type", "website");
    upsertMeta("property", "og:site_name", SITE_NAME);
    upsertMeta("property", "og:title", fullTitle);
    upsertMeta("property", "og:description", description);
    upsertMeta("property", "og:url", noindex ? window.location.href : languageUrl(siteOrigin(), window.location.pathname, lang));
    upsertMeta("property", "og:image", resolvedImage);
    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", fullTitle);
    upsertMeta("name", "twitter:description", description);
    upsertMeta("name", "twitter:image", resolvedImage);

    let script = document.querySelector("script#seo-jsonld");
    if (jsonLd) {
      if (!script) {
        script = document.createElement("script");
        script.type = "application/ld+json";
        script.id = "seo-jsonld";
        document.head.appendChild(script);
      }
      script.textContent = JSON.stringify(jsonLd);
    } else if (script) {
      script.remove();
    }
  }, [title, description, image, jsonLd, noindex, lang]);

  return null;
}
