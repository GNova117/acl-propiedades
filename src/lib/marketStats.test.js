import { describe, expect, it } from "vitest";
import {
  ageLabel,
  canonicalUrl,
  dedupeComps,
  deltaVsMarket,
  findOutlierIds,
  hostOf,
  marketEstimate,
  normalizeComp,
  pricePerM2,
  quantile,
  summarizeMarket,
} from "./marketStats.js";

describe("canonicalUrl", () => {
  it("quita www, parámetros y diagonal final, y pasa todo a minúsculas", () => {
    expect(canonicalUrl("https://www.Inmuebles24.com/Casa-123/?utm_source=x")).toBe("inmuebles24.com/casa-123");
  });

  it("dos enlaces al mismo anuncio con distinto utm producen el mismo canónico", () => {
    const a = canonicalUrl("https://sitio.com/casa-1?utm_source=fb");
    const b = canonicalUrl("https://sitio.com/casa-1?utm_source=google");
    expect(a).toBe(b);
  });

  it("regresa null para una URL inválida o con protocolo que no es http(s)", () => {
    expect(canonicalUrl("no es una url")).toBeNull();
    expect(canonicalUrl("ftp://sitio.com/archivo")).toBeNull();
  });
});

describe("hostOf", () => {
  it("regresa solo el host canónico de la URL", () => {
    expect(hostOf("https://www.Lamudi.com.mx/propiedad/1")).toBe("lamudi.com.mx");
  });

  it("regresa cadena vacía para una URL inválida", () => {
    expect(hostOf("no-url")).toBe("");
  });
});

describe("pricePerM2", () => {
  it("usa builtArea o landArea según la base pedida", () => {
    const comp = { price: 1000000, builtArea: 100, landArea: 200 };
    expect(pricePerM2(comp, "built")).toBe(10000);
    expect(pricePerM2(comp, "land")).toBe(5000);
  });

  it("regresa null si el anuncio no trae la superficie que esa base necesita", () => {
    expect(pricePerM2({ price: 1000000, builtArea: null }, "built")).toBeNull();
  });
});

describe("normalizeComp", () => {
  const valid = {
    url: "https://sitio.com/casa-1",
    price: "$1,200,000",
    builtArea: "120",
    landArea: "150",
    title: "<b>Casa</b>  en venta",
    colonia: "Centro",
    bedrooms: "3",
  };

  it("limpia y normaliza un anuncio válido (precio con símbolos, html en el título)", () => {
    const comp = normalizeComp(valid);
    expect(comp.price).toBe(1200000);
    expect(comp.builtArea).toBe(120);
    expect(comp.title).toBe("Casa en venta");
    expect(comp.source).toBe("sitio.com");
  });

  it("regresa null sin URL válida", () => {
    expect(normalizeComp({ ...valid, url: "no-url" })).toBeNull();
    expect(normalizeComp({ ...valid, url: "" })).toBeNull();
  });

  it("regresa null si el precio está fuera de los límites razonables para La Laguna", () => {
    expect(normalizeComp({ ...valid, price: 1000 })).toBeNull(); // muy barato, error de captura probable
    expect(normalizeComp({ ...valid, price: 500_000_000 })).toBeNull(); // absurdamente alto
  });

  it("deja la superficie en null (sin rechazar el anuncio) si está fuera de rango, salvo que rompa el ppm pedido", () => {
    const comp = normalizeComp({ ...valid, builtArea: 999999 });
    expect(comp.builtArea).toBeNull();
    expect(comp.landArea).toBe(150); // la de terreno sigue siendo válida
  });

  it("rechaza el anuncio completo si, dada la base pedida, el precio por m² es imposible", () => {
    // 1,200,000 / 120 = 10,000 por m² construido: razonable
    expect(normalizeComp(valid, { basis: "built" })).not.toBeNull();
    // forzamos un ppm imposible con una superficie enorme válida pero ppm bajo
    const comp = normalizeComp({ ...valid, price: 60000, builtArea: 20 }, { basis: "built" }); // ppm=3000, min es 3000 -> válido
    expect(comp).not.toBeNull();
    const rejected = normalizeComp({ ...valid, price: 50000, builtArea: 20 }, { basis: "built" }); // ppm=2500 < 3000
    expect(rejected).toBeNull();
  });

  it("marca verified según si la URL apareció entre los resultados reales de la búsqueda", () => {
    const canonical = canonicalUrl(valid.url);
    expect(normalizeComp(valid).verified).toBeNull(); // sin seenUrls, no se puede comprobar nada
    expect(normalizeComp(valid, { seenUrls: new Set() }).verified).toBeNull(); // búsqueda sin URLs
    expect(normalizeComp(valid, { seenUrls: new Set([canonical]) }).verified).toBe(true);
    expect(normalizeComp(valid, { seenUrls: new Set(["otro.com/x"]) }).verified).toBe(false);
  });

  it("limita el número de recámaras a un tope razonable (20)", () => {
    expect(normalizeComp({ ...valid, bedrooms: "500" }).bedrooms).toBe(20);
  });
});

describe("dedupeComps", () => {
  it("quita duplicados por el mismo enlace canónico", () => {
    const comps = [
      { id: "sitio.com/a", price: 1, builtArea: 1, landArea: null, colonia: "x" },
      { id: "sitio.com/a", price: 1, builtArea: 1, landArea: null, colonia: "x" },
    ];
    expect(dedupeComps(comps)).toHaveLength(1);
  });

  it("quita duplicados publicados en dos portales distintos (mismo precio+superficie+colonia)", () => {
    const comps = [
      { id: "portal-a.com/1", price: 1000000, builtArea: 120, landArea: null, colonia: "Centro" },
      { id: "portal-b.com/2", price: 1000000, builtArea: 120, landArea: null, colonia: "Centro" },
    ];
    expect(dedupeComps(comps)).toHaveLength(1);
  });

  it("conserva anuncios distintos", () => {
    const comps = [
      { id: "a.com/1", price: 1000000, builtArea: 120, landArea: null, colonia: "Centro" },
      { id: "b.com/2", price: 900000, builtArea: 100, landArea: null, colonia: "Norte" },
    ];
    expect(dedupeComps(comps)).toHaveLength(2);
  });
});

describe("quantile", () => {
  it("interpola linealmente sobre una lista ya ordenada", () => {
    expect(quantile([10, 20, 30, 40], 0.5)).toBe(25); // interpolado entre 20 y 30
    expect(quantile([10, 20, 30], 0.5)).toBe(20); // cae exacto en un punto
  });

  it("en los extremos (q=0, q=1) regresa el mínimo y el máximo", () => {
    expect(quantile([1, 2, 3, 4], 0)).toBe(1);
    expect(quantile([1, 2, 3, 4], 1)).toBe(4);
  });

  it("regresa 0 para una lista vacía", () => {
    expect(quantile([], 0.5)).toBe(0);
  });
});

describe("findOutlierIds", () => {
  // Grupo apretado alrededor de $10,000/m², con un anuncio 10x por encima.
  const ppms = [9900, 9950, 10000, 10050, 10100, 10200, 100000];
  const comps = ppms.map((ppm, i) => ({ id: `c${i}`, price: ppm * 100, builtArea: 100 }));

  it("detecta el anuncio fuera de la valla de Tukey cuando hay suficientes datos (6+)", () => {
    const outliers = findOutlierIds(comps, "built");
    expect(outliers).toEqual(new Set(["c6"]));
  });

  it("no filtra nada con menos del mínimo de anuncios, aunque haya uno claramente atípico", () => {
    const pocos = comps.slice(0, 5); // 5 < MIN_COMPS_FOR_OUTLIERS (6)
    expect(findOutlierIds(pocos, "built").size).toBe(0);
  });
});

describe("summarizeMarket", () => {
  const ppms = [9900, 9950, 10000, 10050, 10100, 10200, 100000];
  const comps = ppms.map((ppm, i) => ({ id: `c${i}`, price: ppm * 100, builtArea: 100 }));

  it("descarta atípicos y anuncios quitados a mano del cálculo, pero los sigue contando", () => {
    const summary = summarizeMarket(comps, "built", { excludedIds: new Set(["c0"]) });
    expect(summary.total).toBe(7);
    expect(summary.excluded).toBe(1);
    expect(summary.outliers).toBe(1); // c6
    expect(summary.used).toBe(5); // 7 - 1 excluido - 1 atípico
  });

  it("calcula mediana y cuartiles del precio por m² solo con los anuncios usados", () => {
    const summary = summarizeMarket(comps, "built");
    // El atípico (c6) ya quedó fuera: mediana de los 6 restantes, interpolada.
    expect(summary.ppm.median).toBeCloseTo(10025, 6);
  });

  it("no descarta atípicos si dropOutliers es false", () => {
    const summary = summarizeMarket(comps, "built", { dropOutliers: false });
    expect(summary.outliers).toBe(0);
    expect(summary.used).toBe(7);
  });
});

describe("marketEstimate", () => {
  const summary = { basis: "built", used: 5, ppm: { p25: 8000, median: 9000, p75: 10000 } };

  it("regresa null con menos del mínimo de anuncios usados (ruido estadístico)", () => {
    expect(marketEstimate({ summary: { ...summary, used: 2 }, builtArea: 100 })).toBeNull();
  });

  it("regresa null sin la superficie que la base necesita", () => {
    expect(marketEstimate({ summary, builtArea: 0 })).toBeNull();
    expect(marketEstimate({ summary: { ...summary, basis: "land" }, builtArea: 100, landArea: null })).toBeNull();
  });

  it("calcula low/center/high = superficie × ppm (cuartil/mediana/cuartil) redondeado a miles", () => {
    const result = marketEstimate({ summary, builtArea: 100, negotiationPct: 0 });
    expect(result).toEqual({ area: 100, low: 800000, center: 900000, high: 1000000 });
  });

  it("aplica el ajuste por negociación a los tres valores por igual", () => {
    const result = marketEstimate({ summary, builtArea: 100, negotiationPct: 10 });
    expect(result.center).toBe(810000); // 900,000 * 0.9
  });

  it("limita el ajuste por negociación a un tope de 30%, y nunca lo deja negativo", () => {
    const tope = marketEstimate({ summary, builtArea: 100, negotiationPct: 30 });
    const pasado = marketEstimate({ summary, builtArea: 100, negotiationPct: 90 });
    const negativo = marketEstimate({ summary, builtArea: 100, negotiationPct: -20 });
    expect(pasado).toEqual(tope);
    expect(negativo.center).toBe(900000); // sin ajuste, como negotiationPct: 0
  });
});

describe("deltaVsMarket", () => {
  it("regresa el porcentaje de diferencia del tabulador contra el mercado (positivo = tabulador más alto)", () => {
    expect(deltaVsMarket(1100000, 1000000)).toBeCloseTo(10, 6);
    expect(deltaVsMarket(900000, 1000000)).toBeCloseTo(-10, 6);
  });

  it("regresa null si cualquiera de los dos valores no es positivo", () => {
    expect(deltaVsMarket(0, 1000000)).toBeNull();
    expect(deltaVsMarket(1000000, 0)).toBeNull();
    expect(deltaVsMarket(-100, 1000000)).toBeNull();
  });
});

describe("ageLabel", () => {
  const now = new Date("2026-06-15T12:00:00.000Z").getTime();

  it("muestra minutos bajo la hora, con un mínimo de 1", () => {
    expect(ageLabel(new Date(now - 30_000).toISOString(), now)).toBe("hace 1 min");
    expect(ageLabel(new Date(now - 5 * 60_000).toISOString(), now)).toBe("hace 5 min");
  });

  it("muestra horas entre 1 y 23", () => {
    expect(ageLabel(new Date(now - 90 * 60_000).toISOString(), now)).toBe("hace 1 h");
  });

  it("muestra días, en singular o plural según corresponda", () => {
    expect(ageLabel(new Date(now - 25 * 3600_000).toISOString(), now)).toBe("hace 1 día");
    expect(ageLabel(new Date(now - 50 * 3600_000).toISOString(), now)).toBe("hace 2 días");
  });

  it("regresa cadena vacía para una fecha futura o inválida", () => {
    expect(ageLabel(new Date(now + 60_000).toISOString(), now)).toBe("");
    expect(ageLabel("fecha-invalida", now)).toBe("");
  });
});
