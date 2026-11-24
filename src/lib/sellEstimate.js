// «Cuánto vale mi casa»: el estimado orientativo que ve quien llena «Vende tu casa» antes de mandar sus datos. Es el
// MISMO tabulador por zona de la valuación interna (src/lib/valuation.js): terreno y construcción por separado, cada uno
// con su precio por m² de la zona. Función pura: recibe la zona ya cargada y las superficies capturadas.
import { estimateValue } from "./valuation";

// Margen del rango público: más estrecho sería prometer demasiado sin haber visto la propiedad.
export const SELL_ESTIMATE_SPREAD_PCT = 10;

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

// { low, high, center } o null cuando todavía no hay con qué estimar (sin zona, sin metros o sin precio de zona).
// Un terreno solo necesita el terreno; una casa o departamento necesita terreno Y construcción: con solo uno de los dos el
// resultado quedaría muy por debajo y daría una idea falsa.
export function sellEstimate({ zone, type, landArea, builtArea } = {}) {
  if (!zone) return null;
  const land = num(landArea);
  if (land === 0) return null;
  const landRate = num(zone.land_price_per_m2);
  if (landRate === 0) return null;

  const isLand = type === "terreno";
  const built = isLand ? 0 : num(builtArea);
  const builtRate = num(zone.price_per_m2);
  if (!isLand && (built === 0 || builtRate === 0)) return null;

  const result = estimateValue({ landArea: land, builtArea: built, landRate, builtRate, spreadPct: SELL_ESTIMATE_SPREAD_PCT });
  return result.base > 0 ? { low: result.low, high: result.high, center: result.center } : null;
}
