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

// ── Ficha de propiedad ──

// Disponibilidad schema.org: solo «disponible» está en venta; «apartada» sigue vigente pero con un trato en curso (no «agotada»);
// vendida o rentada ya no se ofrece.
export function schemaAvailability(status) {
  if (status === "disponible") return "https://schema.org/InStock";
  if (status === "apartada") return "https://schema.org/LimitedAvailability";
  return "https://schema.org/SoldOut";
}

// «Torreón - Las Villas» → ciudad «Torreón» (la zona puede ser la ciudad sola o «Ciudad - Colonia»).
const cityOfZone = (zone) => String(zone || "").split(" - ")[0].trim();

// Ficha como RealEstateListing. `geo` solo si hay coordenadas de verdad; con ubicación aproximada no se publica la calle ni el punto
// exacto. El estado se da por la región de la oficina (BUSINESS.region).
export function propertyListingJsonLd({ property, url }) {
  const lat = Number(property.lat);
  const lng = Number(property.lng);
  const hasGeo = property.lat != null && property.lng != null && property.lat !== "" && property.lng !== "" && Number.isFinite(lat) && Number.isFinite(lng) && !property.location_approximate;
  return {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: property.title,
    description: property.description,
    url,
    image: property.images,
    offers: {
      "@type": "Offer",
      price: property.price,
      priceCurrency: "MXN",
      availability: schemaAvailability(property.status),
    },
    address: {
      "@type": "PostalAddress",
      ...(property.location_approximate ? {} : { streetAddress: property.address }),
      addressLocality: cityOfZone(property.zone) || BUSINESS.city,
      addressRegion: BUSINESS.region,
      addressCountry: "MX",
    },
    ...(hasGeo ? { geo: { "@type": "GeoCoordinates", latitude: lat, longitude: lng } } : {}),
  };
}

// Migas de pan: [{ name, url }] en orden.
export function breadcrumbJsonLd(items) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.name, item: item.url })),
  };
}

// Artículo del blog con editorial (publisher con logotipo) y la página principal.
export function articleJsonLd({ post, url, siteUrl }) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    headline: post.title,
    description: post.excerpt || undefined,
    image: post.cover_image || undefined,
    datePublished: post.published_at,
    dateModified: post.updated_at || post.published_at,
    author: { "@type": "Organization", name: BUSINESS.name },
    publisher: { "@type": "Organization", name: BUSINESS.name, logo: { "@type": "ImageObject", url: `${siteUrl}/icon-512.png` } },
  };
}
