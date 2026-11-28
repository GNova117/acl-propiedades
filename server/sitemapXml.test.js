import { describe, expect, it } from "vitest";
import { buildSitemapXml, propertyInSitemap, sitemapImages } from "./sitemapXml";

const now = new Date("2026-11-26T12:00:00Z");

describe("propertyInSitemap", () => {
  it("disponibles y apartadas siempre", () => {
    expect(propertyInSitemap({ status: "disponible", updated_at: "2020-01-01" }, now)).toBe(true);
    expect(propertyInSitemap({ status: "apartada", updated_at: "2020-01-01" }, now)).toBe(true);
  });
  it("vendidas y rentadas solo unas semanas", () => {
    expect(propertyInSitemap({ status: "vendida", updated_at: "2026-11-01T00:00:00Z" }, now)).toBe(true);
    expect(propertyInSitemap({ status: "vendida", updated_at: "2026-09-01T00:00:00Z" }, now)).toBe(false);
    expect(propertyInSitemap({ status: "rentada", updated_at: "2026-09-01T00:00:00Z" }, now)).toBe(false);
    expect(propertyInSitemap({ status: "vendida" }, now)).toBe(false);
  });
});

describe("sitemapImages", () => {
  it("solo https, sin repetidas y hasta 10", () => {
    const images = Array.from({ length: 14 }, (_, i) => `https://x.mx/${i}.jpg`);
    expect(sitemapImages({ main_image: "https://x.mx/0.jpg", images })).toHaveLength(10);
    expect(sitemapImages({ main_image: "http://x.mx/a.jpg", images: ["data:image/png;base64,AA", "https://x.mx/b.jpg"] })).toEqual(["https://x.mx/b.jpg"]);
    expect(sitemapImages({})).toEqual([]);
  });
});

describe("buildSitemapXml", () => {
  it("escapa y agrega las imágenes con su espacio de nombres", () => {
    const xml = buildSitemapXml([{ loc: "https://x.mx/a?b=1&c=2", lastmod: "2026-11-01", images: ["https://x.mx/i.jpg?a=1&b=2"] }, { loc: "https://x.mx/" }]);
    expect(xml).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
    expect(xml).toContain('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"');
    expect(xml).toContain("<loc>https://x.mx/a?b=1&amp;c=2</loc>");
    expect(xml).toContain("<image:loc>https://x.mx/i.jpg?a=1&amp;b=2</image:loc>");
    expect(xml).toContain("<url><loc>https://x.mx/</loc></url>");
  });
});
