import { describe, expect, it } from "vitest";
import {
  canonicalUrl,
  dedupeComps,
  deltaVsMarket,
  findOutlierIds,
  marketEstimate,
  MIN_COMPS_FOR_ESTIMATE,
  normalizeComp,
  pricePerM2,
  quantile,
  summarizeMarket,
} from "./marketStats";

describe("canonicalUrl", () => {
  it("quita www, parámetros y la diagonal final para que dos enlaces al mismo anuncio coincidan", () => {
    const a = canonicalUrl("https://www.inmuebles24.com/casa-123.html?utm_source=x");
    const b = canonicalUrl("https://inmuebles24.com/casa-123.html/");
    expect(a).toBe(b);
    expect(a).toBe("inmuebles24.com/casa-123.html");
  });

  it("devuelve null para una URL inválida o un protocolo que no es http(s)", () => {
    expect(canonicalUrl("no es una url")).toBeNull();
    expect(canonicalUrl("ftp://ejemplo.com/x")).toBeNull();
  });
});

describe("normalizeComp", () => {
  const basis = "built";

  it("descarta un anuncio sin URL utilizable", () => {
    expect(normalizeComp({ url: "no es una url", price: 1000000, builtArea: 100 }, { basis })).toBeNull();
  });

  it("descarta precios fuera del rango razonable para La Laguna", () => {
    expect(normalizeComp({ url: "https://x.com/a", price: 100, builtArea: 100 }, { basis })).toBeNull();
    expect(normalizeComp({ url: "https://x.com/a", price: 999_000_000, builtArea: 100 }, { basis })).toBeNull();
  });

  it("descarta un anuncio cuyo precio por m² es imposible (probable error de captura)", () => {
    // 900,000 / 100 m² = 9,000/m², dentro de rango; forzamos un precio absurdo por m²
    const comp = normalizeComp({ url: "https://x.com/a", price: 100_000_000, builtArea: 100 }, { basis });
    expect(comp).toBeNull();
  });

  it("acepta un anuncio válido y conserva la superficie que no corresponde a la base como null si está fuera de rango", () => {
    const comp = normalizeComp({ url: "https://x.com/a", price: 900000, builtArea: 100, landArea: 99999999 }, { basis });
    expect(comp).not.toBeNull();
    expect(comp.builtArea).toBe(100);
    expect(comp.landArea).toBeNull();
  });

  it("marca verified=true/false solo si la búsqueda devolvió URLs, y null si no se puede comprobar nada", () => {
    const raw = { url: "https://x.com/a", price: 900000, builtArea: 100 };
    const seen = new Set([canonicalUrl("https://x.com/a")]);
    expect(normalizeComp(raw, { basis, seenUrls: seen }).verified).toBe(true);
    expect(normalizeComp(raw, { basis, seenUrls: new Set(["x.com/otro"]) }).verified).toBe(false);
    expect(normalizeComp(raw, { basis, seenUrls: new Set() }).verified).toBeNull();
  });
});

describe("dedupeComps", () => {
  it("quita el mismo enlace repetido", () => {
    const comp = { id: "x.com/a", price: 900000, builtArea: 100, landArea: null, colonia: "Centro" };
    expect(dedupeComps([comp, { ...comp }])).toHaveLength(1);
  });

  it("quita el mismo anuncio publicado en dos portales (mismo precio + superficie + colonia)", () => {
    const a = { id: "portal1.com/a", price: 900000, builtArea: 100, landArea: null, colonia: "Centro" };
    const b = { id: "portal2.com/a", price: 900000, builtArea: 100, landArea: null, colonia: "Centro" };
    expect(dedupeComps([a, b])).toHaveLength(1);
  });

  it("conserva anuncios distintos", () => {
    const a = { id: "portal1.com/a", price: 900000, builtArea: 100, landArea: null, colonia: "Centro" };
    const b = { id: "portal2.com/b", price: 950000, builtArea: 110, landArea: null, colonia: "Centro" };
    expect(dedupeComps([a, b])).toHaveLength(2);
  });
});

describe("quantile", () => {
  it("interpola linealmente sobre una lista ordenada", () => {
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(quantile([1, 2, 3, 4], 0)).toBe(1);
    expect(quantile([1, 2, 3, 4], 1)).toBe(4);
  });

  it("devuelve 0 para una lista vacía en vez de NaN", () => {
    expect(quantile([], 0.5)).toBe(0);
  });
});

describe("findOutlierIds", () => {
  const basis = "built";
  const comp = (id, price, builtArea) => ({ id, price, builtArea });

  it("no filtra nada con menos anuncios que el mínimo requerido", () => {
    const comps = [comp("a", 500000, 100), comp("b", 10000000, 100)];
    expect(findOutlierIds(comps, basis).size).toBe(0);
  });

  it("detecta el anuncio fuera de la valla de Tukey con suficientes anuncios", () => {
    const normal = [1, 2, 3, 4, 5, 6].map((i) => comp(`n${i}`, 900000 + i * 1000, 100));
    const outlier = comp("outlier", 90000000, 100); // precio por m² absurdamente alto
    const ids = findOutlierIds([...normal, outlier], basis);
    expect(ids.has("outlier")).toBe(true);
    expect(ids.size).toBe(1);
  });
});

describe("summarizeMarket / marketEstimate / deltaVsMarket", () => {
  const basis = "built";
  const comps = [1, 2, 3, 4, 5].map((i) => ({ id: `c${i}`, price: i * 1_000_000, builtArea: 100 }));
  // ppm: 10000, 20000, 30000, 40000, 50000 -> mediana 30000

  it("summarizeMarket calcula la mediana y cuartiles del precio por m²", () => {
    const summary = summarizeMarket(comps, basis, { dropOutliers: false });
    expect(summary.used).toBe(5);
    expect(summary.ppm.median).toBe(30000);
  });

  it("los anuncios excluidos a mano no entran al cálculo pero siguen contados", () => {
    const summary = summarizeMarket(comps, basis, { excludedIds: new Set(["c5"]), dropOutliers: false });
    expect(summary.used).toBe(4);
    expect(summary.excluded).toBe(1);
    expect(summary.total).toBe(5);
  });

  it("marketEstimate da null con menos anuncios utilizables que el mínimo exigido", () => {
    const summary = summarizeMarket(comps.slice(0, 1), basis, { dropOutliers: false });
    expect(summary.used).toBeLessThan(MIN_COMPS_FOR_ESTIMATE);
    expect(marketEstimate({ summary, builtArea: 100 })).toBeNull();
  });

  it("marketEstimate multiplica la superficie por el precio/m² de cada cuartil, con el ajuste por negociación", () => {
    const summary = summarizeMarket(comps, basis, { dropOutliers: false });
    const est = marketEstimate({ summary, builtArea: 100, negotiationPct: 0 });
    expect(est.center).toBe(3_000_000); // 100 m² * 30,000/m²
  });

  it("el ajuste por negociación se topa en 30% y nunca se vuelve negativo", () => {
    const summary = summarizeMarket(comps, basis, { dropOutliers: false });
    const capped = marketEstimate({ summary, builtArea: 100, negotiationPct: 90 });
    const atCap = marketEstimate({ summary, builtArea: 100, negotiationPct: 30 });
    expect(capped.center).toBe(atCap.center);
  });

  it("deltaVsMarket es positivo cuando el tabulador está por encima del mercado", () => {
    expect(deltaVsMarket(1_100_000, 1_000_000)).toBeCloseTo(10);
    expect(deltaVsMarket(900_000, 1_000_000)).toBeCloseTo(-10);
  });

  it("deltaVsMarket es null si falta cualquiera de los dos valores", () => {
    expect(deltaVsMarket(0, 1000)).toBeNull();
    expect(deltaVsMarket(1000, 0)).toBeNull();
  });
});

describe("pricePerM2", () => {
  it("usa la superficie de terreno o construcción según la base pedida", () => {
    const comp = { price: 1000000, builtArea: 100, landArea: 200 };
    expect(pricePerM2(comp, "built")).toBe(10000);
    expect(pricePerM2(comp, "land")).toBe(5000);
  });

  it("devuelve null si el anuncio no trae la superficie que esa base necesita", () => {
    expect(pricePerM2({ price: 1000000, builtArea: null }, "built")).toBeNull();
  });
});
