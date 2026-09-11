import { useEffect } from "react";

const SITE_NAME = "ACL Propiedades";

// `jsonLd`: objeto o arreglo de objetos schema.org — quien lo pase debe
// useMemo-izarlo para no disparar el efecto en cada render. Se REMUEVE si
// la página actual no manda jsonLd, para que no quede pegado el de una
// ficha anterior al navegar dentro de la SPA (el resto del contenido de
// esta etiqueta sí puede quedar "viejo" un instante sin problema, pero
// JSON-LD cambia de forma entre páginas, no solo de contenido).
// `image`: opcional — si no se manda, simplemente no se agregan las
// etiquetas og:image/twitter:image (no hay una imagen genérica del sitio
// que tenga sentido poner ahí). Estas etiquetas ayudan a cualquier
// consumidor que sí ejecute JavaScript (Google, un navegador con vista
// previa propia); WhatsApp/Facebook NO lo ejecutan, así que para esos la
// fuente real es el middleware de Vercel (`middleware.js`), no esto.
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

export default function Seo({ title, description, image, jsonLd }) {
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

    upsertMeta("property", "og:type", "website");
    upsertMeta("property", "og:site_name", SITE_NAME);
    upsertMeta("property", "og:title", fullTitle);
    upsertMeta("property", "og:description", description);
    upsertMeta("property", "og:url", window.location.href);
    upsertMeta("property", "og:image", image);
    upsertMeta("name", "twitter:card", image ? "summary_large_image" : "summary");
    upsertMeta("name", "twitter:title", fullTitle);
    upsertMeta("name", "twitter:description", description);
    upsertMeta("name", "twitter:image", image);

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
  }, [title, description, image, jsonLd]);

  return null;
}
