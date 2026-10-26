// "Desde ≈ $X al mes" de tarjetas y ficha. Usa los mismos valores de
// referencia del banco que el comparador de créditos (COMPARE_DEFAULTS), así
// el número de la tarjeta coincide con el que sale en /comparar-creditos.
// Es solo una referencia para que el cliente sepa si le queda cerca de su
// presupuesto: no es una oferta ni una aprobación de crédito.
import { COMPARE_DEFAULTS, pmt } from "./creditCompare";

// Los créditos hipotecarios que el sitio compara son para vivienda; en
// terrenos, naves y rentas la cifra no aplica (o confundiría).
export const MONTHLY_ESTIMATE_TYPES = ["casa", "departamento"];
// Por debajo de este precio es casi seguro un dato mal capturado (o un pago
// que no corresponde a un crédito): mejor no mostrar nada.
export const MONTHLY_ESTIMATE_MIN_PRICE = 150000;

export function estimateMonthlyPayment(property) {
  if (!property || property.status !== "disponible") return null;
  if (property.operation_type === "renta") return null;
  if (!MONTHLY_ESTIMATE_TYPES.includes(property.type)) return null;
  const price = Number(property.price);
  if (!(price >= MONTHLY_ESTIMATE_MIN_PRICE)) return null;

  const { bankDownPct: downPct, bankYears: years, bankRate: rate } = COMPARE_DEFAULTS;
  const payment = pmt(price * (1 - downPct / 100), rate, years);
  if (!(payment > 0)) return null;
  // Se redondea hacia arriba a la centena: ≈ nunca debe quedar por debajo.
  return { payment: Math.ceil(payment / 100) * 100, downPct, years, rate };
}
