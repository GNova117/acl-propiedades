import { useEffect } from "react";

// Página privada con un enlace secreto en la dirección (firma, documentos, visita, informe, opinión, selección, registro, baja de
// alertas): que los buscadores no la indexen ni archiven, que el navegador NO mande esa dirección como «referrer» a otros sitios
// (el enlace lleva el token) y, si se da `title`, que la pestaña lo diga. Antes cada página repetía este bloque a mano y algunas
// se quedaron sin el «referrer» o sin título; ahora todas lo comparten.
export const PRIVATE_SUFFIX = " | ACL Propiedades";

// `robots: false` para páginas que ya ponen su propio `noindex` (con <Seo noindex>): solo agrega el «referrer».
export function usePrivatePage(title, { robots: addRobots = true } = {}) {
  useEffect(() => {
    const robots = document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex, nofollow, noarchive";
    const referrer = document.createElement("meta");
    referrer.name = "referrer";
    referrer.content = "no-referrer";
    document.head.append(...(addRobots ? [robots, referrer] : [referrer]));
    const previousTitle = document.title;
    if (title) document.title = `${title}${PRIVATE_SUFFIX}`;
    return () => {
      robots.remove();
      referrer.remove();
      document.title = previousTitle;
    };
  }, [title, addRobots]);
}
