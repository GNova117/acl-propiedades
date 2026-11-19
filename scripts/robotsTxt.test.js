import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { withSiteUrl } from "./robotsTxt";

describe("withSiteUrl", () => {
  it("cambia la línea Sitemap por la del dominio y deja lo demás", () => {
    const out = withSiteUrl("User-agent: *\nDisallow: /admin\n\nSitemap: https://acl-propiedades.vercel.app/sitemap.xml\n", "https://aclpropiedades.com");
    expect(out).toContain("Sitemap: https://aclpropiedades.com/sitemap.xml");
    expect(out).not.toContain("vercel.app");
    expect(out).toContain("Disallow: /admin");
  });
  it("si no había línea Sitemap, la agrega", () => {
    expect(withSiteUrl("User-agent: *\nAllow: /", "https://x.mx")).toMatch(/Sitemap: https:\/\/x\.mx\/sitemap\.xml\n$/);
  });
  it("la plantilla de public/robots.txt sigue teniendo su línea Sitemap y no deja entrar a lo privado", () => {
    const template = readFileSync(new URL("../public/robots.txt", import.meta.url), "utf8");
    expect(template).toMatch(/^Sitemap: https:\/\/.+\/sitemap\.xml$/m);
    for (const path of ["/admin", "/seleccion/", "/opinion/", "/visita/", "/documentos/", "/firmar/"]) expect(template).toContain(`Disallow: ${path}`);
  });
});
