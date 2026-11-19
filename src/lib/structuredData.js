// Datos estructurados (vocabulario schema.org, en JSON-LD) para Google: la inmobiliaria como negocio local y las
// preguntas frecuentes de una ficha. Funciones puras; Seo.jsx los pone en la página.
import { OFFICE } from "./office.js";

export const BUSINESS = {
  name: OFFICE.name,
  phone: `+52 ${OFFICE.phoneDisplay}`,
  email: OFFICE.email,
  streetAddress: OFFICE.streetAddress,
  postalCode: OFFICE.postalCode,
  city: OFFICE.city,
  region: OFFICE.region,
  country: OFFICE.country,
  areaServed: OFFICE.areaServed,
  sameAs: [OFFICE.facebook],
};

// Inmobiliaria como negocio local. `siteUrl` sin «/» al final; `socials`: direcciones extra (LinkedIn, Instagram).
export function localBusinessJsonLd({ siteUrl, socials = [] }) {
  return {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    "@id": `${siteUrl}/#negocio`,
    name: BUSINESS.name,
    url: siteUrl,
    telephone: BUSINESS.phone,
    email: BUSINESS.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: BUSINESS.streetAddress,
      postalCode: BUSINESS.postalCode,
      addressLocality: BUSINESS.city,
      addressRegion: BUSINESS.region,
      addressCountry: BUSINESS.country,
    },
    areaServed: BUSINESS.areaServed.map((name) => ({ "@type": "City", name })),
    sameAs: [...BUSINESS.sameAs, ...socials.filter(Boolean)],
  };
}

// Preguntas frecuentes: pares [pregunta, respuesta]. Sin pares no hay datos (null).
export function faqJsonLd(pairs) {
  const items = pairs.filter(([q, a]) => String(q || "").trim() && String(a || "").trim());
  if (items.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map(([question, answer]) => ({ "@type": "Question", name: question, acceptedAnswer: { "@type": "Answer", text: answer } })),
  };
}
