// Rangos de precio listos para el filtro del listado y formato de los campos de
// precio (1500000 → "1,500,000"). El valor que se guarda y viaja en la URL es
// siempre el número limpio ("1500000"); solo lo que se ve lleva comas.

const SALE_RANGES = [
  { key: "s1", min: null, max: 1_000_000 },
  { key: "s2", min: 1_000_000, max: 2_000_000 },
  { key: "s3", min: 2_000_000, max: 3_000_000 },
  { key: "s4", min: 3_000_000, max: 5_000_000 },
  { key: "s5", min: 5_000_000, max: null },
];

const RENT_RANGES = [
  { key: "r1", min: null, max: 5_000 },
  { key: "r2", min: 5_000, max: 10_000 },
  { key: "r3", min: 10_000, max: 20_000 },
  { key: "r4", min: 20_000, max: null },
];

// Rentas tienen escala de precios distinta a las ventas.
export function priceRangesFor(operationType) {
  return operationType === "renta" ? RENT_RANGES : SALE_RANGES;
}

export function digitsOnly(value) {
  return String(value ?? "").replace(/\D/g, "");
}

// "1500000" → "1,500,000". Sin separadores de miles de otro país: es el
// formato de México.
export function formatThousands(value) {
  const digits = digitsOnly(value).replace(/^0+(?=\d)/, "");
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// "$1.5 M", "$850 mil", "$12,000": compacto para etiquetas y chips.
export function formatCompactMXN(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "";
  if (n >= 1_000_000) {
    const millions = Math.round((n / 1_000_000) * 100) / 100;
    return `$${millions} M`;
  }
  if (n >= 100_000) return `$${Math.round(n / 1000)} mil`;
  return `$${formatThousands(Math.round(n))}`;
}

// La llave del rango que coincide EXACTO con lo capturado (o null): así el
// botón del rango se ve activo solo si el filtro es justo ese.
export function activeRangeKey(ranges, minPrice, maxPrice) {
  const min = minPrice === "" || minPrice == null ? null : Number(minPrice);
  const max = maxPrice === "" || maxPrice == null ? null : Number(maxPrice);
  const found = ranges.find((range) => range.min === min && range.max === max);
  return found ? found.key : null;
}
