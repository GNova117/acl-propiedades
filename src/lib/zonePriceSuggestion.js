// 443: precio por m² sugerido para una zona, a partir de lo que de verdad se vendió ahí (mediana, para que una venta rara
// no mueva el número). Construido = casas y departamentos; terreno = terrenos. Con menos de MIN_SAMPLE ventas no se sugiere.
export const MIN_SAMPLE = 3;
const BUILT_TYPES = ["casa", "departamento"];
const LAND_TYPES = ["terreno"];

const median = (values) => {
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

// kind: "built" | "land". → { value, count } (value redondeado a la decena) o null si no hay muestra suficiente.
export function suggestPricePerM2(properties, zoneName, kind) {
  const types = kind === "land" ? LAND_TYPES : BUILT_TYPES;
  const perM2 = (properties || [])
    .filter((p) => p.zone === zoneName && p.status === "vendida" && types.includes(p.type) && p.operation_type !== "renta")
    .map((p) => Number(p.price) / Number(p.area_m2))
    .filter((v) => Number.isFinite(v) && v > 0);
  if (perM2.length < MIN_SAMPLE) return null;
  return { value: Math.round(median(perM2) / 10) * 10, count: perM2.length };
}
