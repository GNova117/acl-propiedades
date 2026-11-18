import { useMemo } from "react";
import { localBusinessJsonLd } from "./structuredData";
import { siteOrigin } from "./site";

// Negocio local para las páginas donde Google busca los datos de contacto (inicio, nosotros, contacto).
export default function useBusinessJsonLd() {
  return useMemo(
    () => localBusinessJsonLd({ siteUrl: siteOrigin(), socials: [import.meta.env.VITE_LINKEDIN_URL, import.meta.env.VITE_INSTAGRAM_URL] }),
    [],
  );
}
