// Contexto de mercado de una zona a partir de las propias propiedades
// publicadas: precio típico por m² de la colonia o la ciudad, y cómo se
// compara una propiedad contra él. No usa el tabulador de valuación de
// /admin/zonas (es una herramienta interna del asesor), solo lo que ya es
// público en el sitio.
import { propertyMatchesCity } from "./zoneLandingPages";

// Con menos propiedades que esto la "mediana" es casi una sola casa.
export const MIN_ZONE_COMPARABLES = 2;
export const MIN_CITY_COMPARABLES = 3;
// Diferencia (en %) por debajo de la cual se dice "similar al promedio".
export const SIMILAR_THRESHOLD_PCT = 3;

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

export function pricePerM2(property) {
  const price = Number(property?.price);
  const area = Number(property?.area_m2);
  return price > 0 && area > 0 ? price / area : null;
}

// Solo propiedades en venta, disponibles y del mismo tipo: comparar el m² de
// una nave contra el de un departamento (o una renta contra una venta) no
// dice nada.
function comparables(properties, { type, excludeId, operation }) {
  return (properties || []).filter(
    (p) =>
      p.id !== excludeId &&
      p.type === type &&
      p.status === "disponible" &&
      p.active !== false &&
      (p.operation_type || "compra") === operation &&
      pricePerM2(p) != null,
  );
}

// Precio típico (mediana) por m² para una propiedad: primero su colonia
// ("Ciudad - Colonia"); si hay pocas, toda la ciudad. null si no hay
// suficientes comparables para decir algo honesto.
export function zonePriceStats(property, properties) {
  if (!property?.zone) return null;
  const pool = comparables(properties, {
    type: property.type,
    excludeId: property.id,
    operation: property.operation_type || "compra",
  });

  const inZone = pool.filter((p) => (p.zone || "").trim().toLowerCase() === property.zone.trim().toLowerCase());
  if (inZone.length >= MIN_ZONE_COMPARABLES) {
    return { scope: "zone", label: property.zone, count: inZone.length, medianPerM2: Math.round(median(inZone.map(pricePerM2))) };
  }

  const city = property.zone.split(" - ")[0].trim();
  const inCity = pool.filter((p) => propertyMatchesCity(p, city));
  if (inCity.length >= MIN_CITY_COMPARABLES) {
    return { scope: "city", label: city, count: inCity.length, medianPerM2: Math.round(median(inCity.map(pricePerM2))) };
  }
  return null;
}

// % de diferencia del m² de la propiedad contra el típico de la zona
// (negativo = más barata que la zona).
export function comparePricePerM2(property, stats) {
  const own = pricePerM2(property);
  if (own == null || !stats?.medianPerM2) return null;
  const diffPct = Math.round(((own - stats.medianPerM2) / stats.medianPerM2) * 100);
  const verdict = Math.abs(diffPct) < SIMILAR_THRESHOLD_PCT ? "similar" : diffPct < 0 ? "below" : "above";
  return { ownPerM2: Math.round(own), diffPct, verdict };
}

// Resumen de una ciudad para su página de aterrizaje.
export function cityMarketSummary(properties, city) {
  const available = (properties || []).filter(
    (p) => p.status === "disponible" && p.active !== false && propertyMatchesCity(p, city),
  );
  if (available.length === 0) return null;

  const perType = (type) => {
    const sale = available.filter((p) => p.type === type && (p.operation_type || "compra") === "compra" && pricePerM2(p) != null);
    return sale.length >= MIN_ZONE_COMPARABLES ? Math.round(median(sale.map(pricePerM2))) : null;
  };

  const salePrices = available.filter((p) => (p.operation_type || "compra") === "compra").map((p) => Number(p.price)).filter((n) => n > 0);
  return {
    available: available.length,
    medianPrice: salePrices.length ? Math.round(median(salePrices)) : null,
    casaPerM2: perType("casa"),
    departamentoPerM2: perType("departamento"),
  };
}
