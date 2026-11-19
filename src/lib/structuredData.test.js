import { describe, expect, it } from "vitest";
import { faqJsonLd, localBusinessJsonLd } from "./structuredData";

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
