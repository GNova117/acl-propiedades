// Valuación por tabulador de zona (uso interno): terreno y construcción se
// valúan por separado, cada uno con su precio por m² de la zona
// (zones.land_price_per_m2 y zones.price_per_m2). Función pura, sin acceso a
// datos: el llamador le pasa las superficies y los precios ya resueltos.
const CENTER_STEP = 1000;
const RANGE_STEP = 5000;
export const MAX_SPREAD_PCT = 50;

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

// Se redondea a centavos antes de dividir: 900000 * 1.1 da 990000.0000000001 en
// punto flotante y sin esto el techo saltaría un escalón completo (995,000).
const cents = (x) => Math.round(x * 100) / 100;
const roundTo = (x, step) => Math.round(cents(x) / step) * step;
const floorTo = (x, step) => Math.floor(cents(x) / step) * step;
const ceilTo = (x, step) => Math.ceil(cents(x) / step) * step;

export function estimateValue({ landArea, builtArea, landRate, builtRate, spreadPct }) {
  const land = num(landArea);
  const built = num(builtArea);
  const landValue = land * num(landRate);
  const builtValue = built * num(builtRate);
  const base = landValue + builtValue;
  const spread = Math.min(num(spreadPct), MAX_SPREAD_PCT) / 100;

  return {
    landValue,
    builtValue,
    base,
    center: roundTo(base, CENTER_STEP),
    // El rango se redondea hacia afuera (piso/techo) para que nunca quede más
    // estrecho que el margen pedido.
    low: floorTo(base * (1 - spread), RANGE_STEP),
    high: ceilTo(base * (1 + spread), RANGE_STEP),
  };
}
