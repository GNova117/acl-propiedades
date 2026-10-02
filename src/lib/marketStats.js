// Estadística del mercado en internet (uso interno): toma los anuncios
// ("comparables") que encontró la búsqueda web, los valida y calcula el precio
// por m² típico de la zona. Funciones puras, sin acceso a datos ni a red: las
// usa tanto la función de servidor (api/market-comps.js) como la pantalla, para
// que el asesor pueda quitar un anuncio y ver el rango recalculado al instante.
//
// Ojo: son precios de OFERTA (lo que pide el vendedor), no de cierre. Por eso
// `marketEstimate` admite un ajuste por negociación que arranca en 0.

export const PROPERTY_TYPES = ["casa", "departamento", "terreno"];

// Casas y departamentos se comparan por m² de construcción; un terreno, por m²
// de terreno.
export const basisFor = (propertyType) => (propertyType === "terreno" ? "land" : "built");

// Rangos que un anuncio real puede tener en La Laguna. Fuera de ellos casi
// siempre es un error de captura del anuncio o una lectura equivocada, y un
// solo valor absurdo arruinaría el promedio de toda la zona.
const LIMITS = {
  price: { min: 50_000, max: 200_000_000 },
  builtArea: { min: 15, max: 5_000 },
  landArea: { min: 15, max: 100_000 },
  ppm: {
    built: { min: 3_000, max: 90_000 },
    land: { min: 150, max: 60_000 },
  },
};

export const MIN_COMPS_FOR_ESTIMATE = 3;
// Con pocos datos los cuartiles son ruido, así que el filtro de atípicos solo
// actúa a partir de este número de anuncios.
const MIN_COMPS_FOR_OUTLIERS = 6;

const toNumber = (v) => {
  if (typeof v === "string") v = v.replace(/[$,\s]/g, "");
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const cleanText = (v, max) =>
  String(v ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

// host + ruta, sin www, parámetros ni diagonal final: así dos enlaces al mismo
// anuncio (con distinto utm_source, por ejemplo) cuentan como uno solo.
export function canonicalUrl(url) {
  try {
    const u = new URL(String(url).trim());
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    const path = u.pathname.replace(/\/+$/, "").toLowerCase();
    return `${host}${path}`;
  } catch {
    return null;
  }
}

export const hostOf = (url) => canonicalUrl(url)?.split("/")[0] || "";

// Precio por m² de un anuncio según la base de comparación. null si el anuncio
// no trae la superficie que esa base necesita.
export function pricePerM2(comp, basis) {
  const area = basis === "land" ? comp.landArea : comp.builtArea;
  return area ? comp.price / area : null;
}

// Convierte lo que devolvió el modelo en un comparable limpio, o null si no
// sirve. `seenUrls` (Set de URLs canónicas que la búsqueda realmente devolvió)
// permite marcar cada enlace como comprobado o no; si la búsqueda no entregó
// ninguna URL no se puede comprobar nada y `verified` queda en null.
export function normalizeComp(raw, { basis, seenUrls } = {}) {
  if (!raw || typeof raw !== "object") return null;

  const url = typeof raw.url === "string" ? raw.url.trim() : "";
  const canonical = canonicalUrl(url);
  if (!canonical) return null;

  const price = toNumber(raw.price);
  if (!price || price < LIMITS.price.min || price > LIMITS.price.max) return null;

  const rawBuilt = toNumber(raw.builtArea);
  const rawLand = toNumber(raw.landArea);
  const builtArea = rawBuilt && rawBuilt >= LIMITS.builtArea.min && rawBuilt <= LIMITS.builtArea.max ? rawBuilt : null;
  const landArea = rawLand && rawLand >= LIMITS.landArea.min && rawLand <= LIMITS.landArea.max ? rawLand : null;

  const comp = {
    id: canonical,
    title: cleanText(raw.title, 140),
    price: Math.round(price),
    builtArea,
    landArea,
    bedrooms: toNumber(raw.bedrooms) ? Math.min(Math.round(toNumber(raw.bedrooms)), 20) : null,
    colonia: cleanText(raw.colonia, 80),
    url,
    source: hostOf(url),
    exactZone: raw.exactZone !== false,
    verified: seenUrls && seenUrls.size > 0 ? seenUrls.has(canonical) : null,
  };

  if (basis) {
    const ppm = pricePerM2(comp, basis);
    const bounds = LIMITS.ppm[basis];
    if (!ppm || ppm < bounds.min || ppm > bounds.max) return null;
  }
  return comp;
}

// Quita repetidos: mismo enlace, o el mismo precio + superficie + colonia (el
// mismo anuncio publicado en dos portales).
export function dedupeComps(comps) {
  const seen = new Set();
  const out = [];
  for (const comp of comps) {
    const fingerprint = `${comp.price}|${comp.builtArea ?? ""}|${comp.landArea ?? ""}|${comp.colonia.toLowerCase()}`;
    if (seen.has(comp.id) || seen.has(fingerprint)) continue;
    seen.add(comp.id);
    seen.add(fingerprint);
    out.push(comp);
  }
  return out;
}

// Cuantil con interpolación lineal sobre una lista YA ordenada.
export function quantile(sorted, q) {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

const ascending = (a, b) => a - b;

// ids de los anuncios fuera de la valla de Tukey (1.5 × rango intercuartil).
export function findOutlierIds(comps, basis) {
  const rows = comps.map((c) => ({ id: c.id, ppm: pricePerM2(c, basis) })).filter((r) => r.ppm);
  if (rows.length < MIN_COMPS_FOR_OUTLIERS) return new Set();
  const sorted = rows.map((r) => r.ppm).sort(ascending);
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  const fence = (q3 - q1) * 1.5;
  return new Set(rows.filter((r) => r.ppm < q1 - fence || r.ppm > q3 + fence).map((r) => r.id));
}

// Resumen del mercado. Los anuncios excluidos a mano (`excludedIds`) y los
// atípicos (si `dropOutliers`) no entran al cálculo, pero siguen en la lista
// para que el asesor vea por qué se dejaron fuera.
export function summarizeMarket(comps, basis, { excludedIds = new Set(), dropOutliers = true } = {}) {
  const outlierIds = dropOutliers ? findOutlierIds(comps.filter((c) => !excludedIds.has(c.id)), basis) : new Set();
  const used = comps.filter((c) => !excludedIds.has(c.id) && !outlierIds.has(c.id) && pricePerM2(c, basis));
  const ppms = used.map((c) => pricePerM2(c, basis)).sort(ascending);
  const prices = used.map((c) => c.price).sort(ascending);

  return {
    basis,
    total: comps.length,
    used: used.length,
    excluded: comps.filter((c) => excludedIds.has(c.id)).length,
    outliers: outlierIds.size,
    outlierIds,
    usedIds: new Set(used.map((c) => c.id)),
    ppm: {
      min: ppms[0] ?? 0,
      p25: quantile(ppms, 0.25),
      median: quantile(ppms, 0.5),
      p75: quantile(ppms, 0.75),
      max: ppms[ppms.length - 1] ?? 0,
    },
    medianPrice: quantile(prices, 0.5),
  };
}

const roundTo = (x, step) => Math.round(x / step) * step;

// Valor de la propiedad según el mercado: superficie × precio por m² (cuartil
// bajo / mediana / cuartil alto), con el ajuste por negociación aplicado a los
// tres. null si hay muy pocos anuncios o falta la superficie.
export function marketEstimate({ summary, builtArea, landArea, negotiationPct = 0 }) {
  if (!summary || summary.used < MIN_COMPS_FOR_ESTIMATE) return null;
  const area = Number(summary.basis === "land" ? landArea : builtArea);
  if (!(area > 0)) return null;

  const factor = 1 - Math.min(Math.max(Number(negotiationPct) || 0, 0), 30) / 100;
  const at = (ppm) => roundTo(area * ppm * factor, 1000);
  return { area, low: at(summary.ppm.p25), center: at(summary.ppm.median), high: at(summary.ppm.p75) };
}

// Diferencia (%) del valor del tabulador contra el del mercado. Positivo =
// el tabulador está por encima de lo que se anuncia en internet.
export function deltaVsMarket(tabuladorValue, marketValue) {
  if (!(tabuladorValue > 0) || !(marketValue > 0)) return null;
  return ((tabuladorValue - marketValue) / marketValue) * 100;
}

// Antigüedad legible de una consulta guardada ("hace 3 h").
export function ageLabel(isoDate, now = Date.now()) {
  const ms = now - new Date(isoDate).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `hace ${Math.max(minutes, 1)} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `hace ${days} ${days === 1 ? "día" : "días"}`;
}
