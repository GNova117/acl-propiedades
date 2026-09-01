// Métricas y sugerencia de consumo de materiales por espacio. Las fórmulas
// reales (cuánto material por m²/m³) las define el negocio en el catálogo
// (materials_catalog.consumption_rate / consumption_basis) — aquí solo vive
// el cálculo genérico, sin cifras de construcción inventadas.

export function computeSpaceMetrics({ length, width, height }) {
  const l = Number(length) || 0;
  const w = Number(width) || 0;
  const h = Number(height) || 0;
  return {
    floorArea: l * w,
    wallArea: 2 * (l + w) * h,
    volume: l * w * h,
  };
}

const BASIS_TO_METRIC = {
  floor_area: "floorArea",
  wall_area: "wallArea",
  volume: "volume",
};

export const CONSUMPTION_BASES = Object.keys(BASIS_TO_METRIC);

// Redondea hacia arriba: es un estándar/máximo de referencia, mejor sobrar
// material que faltar.
export function suggestedQuantity(material, metrics) {
  const metricKey = BASIS_TO_METRIC[material.consumption_basis];
  if (!metricKey) return null;
  if (material.consumption_rate === "" || material.consumption_rate == null) return null;
  const basisValue = metrics[metricKey];
  if (!basisValue) return null;
  return Math.ceil(Number(material.consumption_rate) * basisValue);
}
