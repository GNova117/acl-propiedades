import { describe, expect, it } from "vitest";
import { alternateLinks, languageUrl, siteOrigin } from "./site";

describe("siteOrigin", () => {
  it("usa VITE_SITE_URL si es https y la reduce a su origen", () => {
    expect(siteOrigin({ VITE_SITE_URL: "https://aclpropiedades.com/" }, "https://x.vercel.app")).toBe("https://aclpropiedades.com");
  });
  it("sin variable o con http, usa el origen actual", () => {
    expect(siteOrigin({}, "https://x.vercel.app")).toBe("https://x.vercel.app");
    expect(siteOrigin({ VITE_SITE_URL: "http://inseguro.mx" }, "https://x.vercel.app")).toBe("https://x.vercel.app");
  });
});

describe("languageUrl / alternateLinks", () => {
  it("español sin parámetro, inglés con ?lang=en, sin diagonal final", () => {
    expect(languageUrl("https://a.mx", "/propiedades/", "es")).toBe("https://a.mx/propiedades");
    expect(languageUrl("https://a.mx", "/propiedades", "en")).toBe("https://a.mx/propiedades?lang=en");
    expect(languageUrl("https://a.mx", "/", "en")).toBe("https://a.mx/?lang=en");
  });
  it("incluye es, en y x-default (apunta al español)", () => {
    const links = alternateLinks("https://a.mx", "/contacto");
    expect(links.map((l) => l.hreflang)).toEqual(["es", "en", "x-default"]);
    expect(links[2].href).toBe(links[0].href);
  });
});
