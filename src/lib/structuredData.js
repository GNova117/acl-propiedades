// Datos estructurados (vocabulario schema.org, en JSON-LD) para Google: la inmobiliaria como negocio local y las
// preguntas frecuentes de una ficha. Funciones puras; Seo.jsx los pone en la página.

export const BUSINESS = {
  name: "ACL Propiedades",
  phone: "+52 871 324 3271",
  email: "inmobiliaria@aclpropiedades.com",
  streetAddress: "Blvd. Independencia 2600, Local 16, Plaza San Luciano, Estrella",
  postalCode: "27010",
  city: "Torreón",
  region: "Coahuila",
  country: "MX",
  areaServed: ["Torreón", "Gómez Palacio", "Lerdo"],
  sameAs: ["https://www.facebook.com/Aclpropiedadess/"],
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
