import { useEffect } from "react";

const SITE_NAME = "ACL Propiedades";

// `jsonLd`: objeto o arreglo de objetos schema.org — quien lo pase debe
// useMemo-izarlo para no disparar el efecto en cada render. Se REMUEVE si
// la página actual no manda jsonLd, para que no quede pegado el de una
// ficha anterior al navegar dentro de la SPA (el resto del contenido de
// esta etiqueta sí puede quedar "viejo" un instante sin problema, pero
// JSON-LD cambia de forma entre páginas, no solo de contenido).
export default function Seo({ title, description, jsonLd }) {
  useEffect(() => {
    document.title = title ? `${title} | ${SITE_NAME}` : SITE_NAME;

    if (description) {
      let tag = document.querySelector('meta[name="description"]');
      if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute("name", "description");
        document.head.appendChild(tag);
      }
      tag.setAttribute("content", description);
    }

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
  }, [title, description, jsonLd]);

  return null;
}
