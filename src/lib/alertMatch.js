// Alertas de propiedades: pasar los filtros del listado a los "criterios" que se
// guardan, decidir si una propiedad los cumple y describirlos en lenguaje
// natural. La coincidencia (matchesCriteria) está DUPLICADA en la función de
// envío supabase/functions/alertas-propiedades/index.ts — no puede compartir el
// módulo porque corre aparte, en Deno —; hay una prueba que comprueba que ambas
// dan el mismo resultado.

const num = (v) => {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// De los filtros del listado (Properties.jsx) a los criterios guardados: solo
// lo que está puesto, con números como números.
export function filtersToCriteria(filters, { fixedType } = {}) {
  const c = {};
  const type = fixedType || filters.type;
  if (type) c.type = type;
  if (filters.operationType) c.operation_type = filters.operationType;
  if (filters.tipoNave) c.tipo_nave = filters.tipoNave;
  if (filters.zone) c.zone = filters.zone;
  for (const [key, field] of [
    ["min_price", "minPrice"],
    ["max_price", "maxPrice"],
    ["min_area", "minArea"],
    ["max_area", "maxArea"],
    ["min_bedrooms", "minBedrooms"],
    ["min_bathrooms", "minBathrooms"],
    ["min_parking", "minParking"],
  ]) {
    const n = num(filters[field]);
    if (n != null && n > 0) c[key] = n;
  }
  if (Array.isArray(filters.amenities) && filters.amenities.length > 0) c.amenities = filters.amenities.slice(0, 20);
  return c;
}

export const isAvailable = (p) => p.active !== false && (p.status ?? "disponible") === "disponible";

export function matchesCriteria(p, raw) {
  const c = raw || {};
  const eq = (want, have) => !want || String(want) === String(have ?? "");
  if (!eq(c.type, p.type) || !eq(c.operation_type, p.operation_type) || !eq(c.tipo_nave, p.tipo_nave) || !eq(c.zone, p.zone)) return false;
  const price = Number(p.price) || 0;
  const minPrice = num(c.min_price);
  const maxPrice = num(c.max_price);
  if (minPrice != null && price < minPrice) return false;
  if (maxPrice != null && price > maxPrice) return false;
  const area = Number(p.area_m2) || 0;
  const minArea = num(c.min_area);
  const maxArea = num(c.max_area);
  if (minArea != null && area < minArea) return false;
  if (maxArea != null && area > maxArea) return false;
  const atLeast = (want, have) => {
    const w = num(want);
    return w == null || (Number(have) || 0) >= w;
  };
  if (!atLeast(c.min_bedrooms, p.bedrooms) || !atLeast(c.min_bathrooms, p.bathrooms) || !atLeast(c.min_parking, p.parking)) return false;
  const wanted = Array.isArray(c.amenities) ? c.amenities : [];
  if (wanted.length > 0) {
    const have = new Set(p.amenities || []);
    if (!wanted.every((a) => have.has(a))) return false;
  }
  return true;
}

// Partes legibles de una búsqueda guardada: [{ key, value }] para armar chips o texto.
export function describeCriteria(criteria, { money }) {
  const c = criteria || {};
  const parts = [];
  if (c.type) parts.push({ key: "type", value: c.type });
  if (c.operation_type) parts.push({ key: "operation", value: c.operation_type });
  if (c.tipo_nave) parts.push({ key: "tipoNave", value: c.tipo_nave });
  if (c.zone) parts.push({ key: "zone", value: c.zone });
  if (c.min_price || c.max_price) {
    parts.push({ key: "price", value: c.min_price && c.max_price ? `${money(c.min_price)} – ${money(c.max_price)}` : c.min_price ? `≥ ${money(c.min_price)}` : `≤ ${money(c.max_price)}` });
  }
  if (c.min_area || c.max_area) {
    parts.push({ key: "area", value: c.min_area && c.max_area ? `${c.min_area} – ${c.max_area} m²` : c.min_area ? `≥ ${c.min_area} m²` : `≤ ${c.max_area} m²` });
  }
  if (c.min_bedrooms) parts.push({ key: "bedrooms", value: `≥ ${c.min_bedrooms}` });
  if (c.min_bathrooms) parts.push({ key: "bathrooms", value: `≥ ${c.min_bathrooms}` });
  if (c.min_parking) parts.push({ key: "parking", value: `≥ ${c.min_parking}` });
  if (Array.isArray(c.amenities) && c.amenities.length) parts.push({ key: "amenities", value: c.amenities.join(", ") });
  return parts;
}
