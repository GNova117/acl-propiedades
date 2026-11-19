import { describe, expect, it } from "vitest";
import { DEFAULT_SITE_URL, resolveSiteUrl } from "./siteUrl";

describe("resolveSiteUrl", () => {
  it("toma SITE_URL o VITE_SITE_URL y quita la barra final", () => {
    expect(resolveSiteUrl({ SITE_URL: "https://aclpropiedades.com/" })).toBe("https://aclpropiedades.com");
    expect(resolveSiteUrl({ VITE_SITE_URL: "https://www.aclpropiedades.com" })).toBe("https://www.aclpropiedades.com");
    expect(resolveSiteUrl({ SITE_URL: "https://a.mx", VITE_SITE_URL: "https://b.mx" })).toBe("https://a.mx");
  });
  it("sin variable, o con algo que no sirve (http, ruta, texto), usa la de Vercel", () => {
    for (const env of [{}, { SITE_URL: "" }, { SITE_URL: "http://aclpropiedades.com" }, { SITE_URL: "https://x.mx/ruta" }, { SITE_URL: "https://x.mx?a=1" }, { SITE_URL: "no es url" }]) {
      expect(resolveSiteUrl(env)).toBe(DEFAULT_SITE_URL);
    }
  });
});
