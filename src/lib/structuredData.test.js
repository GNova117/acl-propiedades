import { describe, expect, it } from "vitest";
import { articleJsonLd, breadcrumbJsonLd, faqJsonLd, localBusinessJsonLd, propertyListingJsonLd, schemaAvailability } from "./structuredData";

describe("localBusinessJsonLd", () => {
  it("describe la inmobiliaria con su dirección, zonas y redes", () => {
    const data = localBusinessJsonLd({ siteUrl: "https://aclpropiedades.com", socials: ["https://www.instagram.com/acl", null] });
    expect(data["@type"]).toBe("RealEstateAgent");
    expect(data.url).toBe("https://aclpropiedades.com");
    expect(data.address.addressLocality).toBe("Torreón");
    expect(data.areaServed.map((c) => c.name)).toEqual(["Torreón", "Gómez Palacio", "Lerdo"]);
    expect(data.sameAs).toContain("https://www.instagram.com/acl");
    expect(data.sameAs).not.toContain(null);
    expect(() => JSON.stringify(data)).not.toThrow();
  });
});

describe("faqJsonLd", () => {
  it("arma preguntas y respuestas y omite las vacías", () => {
    const data = faqJsonLd([["¿Cuánto cuesta?", "$1,000,000"], ["", "huérfana"], ["¿Dónde?", "  "]]);
    expect(data["@type"]).toBe("FAQPage");
    expect(data.mainEntity).toEqual([{ "@type": "Question", name: "¿Cuánto cuesta?", acceptedAnswer: { "@type": "Answer", text: "$1,000,000" } }]);
  });
  it("sin preguntas no hay datos", () => {
    expect(faqJsonLd([])).toBeNull();
    expect(faqJsonLd([["", ""]])).toBeNull();
  });
});

describe("ficha de propiedad", () => {
  const base = { title: "Casa", description: "d", images: ["a.jpg"], price: 900000, status: "disponible", zone: "Torreón - Las Villas", address: "Calle 1", lat: 25.5, lng: -103.4 };
  const url = "https://x.mx/propiedades/casa-ACL-1";

  it("la disponibilidad distingue disponible, apartada y cerrada", () => {
    expect(schemaAvailability("disponible")).toBe("https://schema.org/InStock");
    expect(schemaAvailability("apartada")).toBe("https://schema.org/LimitedAvailability");
    expect(schemaAvailability("vendida")).toBe("https://schema.org/SoldOut");
    expect(schemaAvailability("rentada")).toBe("https://schema.org/SoldOut");
  });

  it("la localidad es la ciudad (no la colonia) y trae el estado", () => {
    const data = propertyListingJsonLd({ property: base, url });
    expect(data.address.addressLocality).toBe("Torreón");
    expect(data.address.addressRegion).toBeTruthy();
    expect(data.address.streetAddress).toBe("Calle 1");
    expect(data.geo).toEqual({ "@type": "GeoCoordinates", latitude: 25.5, longitude: -103.4 });
  });

  it("sin coordenadas no hay geo ni nulos", () => {
    for (const bad of [{ lat: null, lng: null }, { lat: "", lng: "" }, { lat: undefined, lng: undefined }]) {
      const data = propertyListingJsonLd({ property: { ...base, ...bad }, url });
      expect("geo" in data).toBe(false);
    }
  });

  it("con ubicación aproximada no se publica la calle ni el punto exacto", () => {
    const data = propertyListingJsonLd({ property: { ...base, location_approximate: true }, url });
    expect("geo" in data).toBe(false);
    expect("streetAddress" in data.address).toBe(false);
  });
});

describe("migas y artículo", () => {
  it("numera las migas desde 1", () => {
    const data = breadcrumbJsonLd([{ name: "Inicio", url: "https://x.mx" }, { name: "Terrenos", url: "https://x.mx/terrenos" }]);
    expect(data.itemListElement.map((i) => i.position)).toEqual([1, 2]);
    expect(data.itemListElement[1]).toMatchObject({ name: "Terrenos", item: "https://x.mx/terrenos" });
  });

  it("el artículo trae editorial con logotipo y página principal", () => {
    const data = articleJsonLd({ post: { title: "T", excerpt: "e", published_at: "2026-01-01", updated_at: null }, url: "https://x.mx/blog/t", siteUrl: "https://x.mx" });
    expect(data.mainEntityOfPage["@id"]).toBe("https://x.mx/blog/t");
    expect(data.publisher.logo.url).toBe("https://x.mx/icon-512.png");
    expect(data.dateModified).toBe("2026-01-01");
  });
});
