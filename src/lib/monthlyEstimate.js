// "Desde ≈ $X al mes" de tarjetas y ficha. Usa los mismos valores de
// referencia del banco que el comparador de créditos (COMPARE_DEFAULTS), así
// el número de la tarjeta coincide con el que sale en /comparar-creditos.
// Es solo una referencia para que el cliente sepa si le queda cerca de su
// presupuesto: no es una oferta ni una aprobación de crédito.
import { COMPARE_DEFAULTS } from "./creditCompare";
import { pmt } from "./loanMath";

// Los créditos hipotecarios que el sitio compara son para vivienda; en
// terrenos, naves y rentas la cifra no aplica (o confundiría).
// Ancla de la calculadora interactiva de la ficha (el «Personalizar» del precio salta a ella).
export const CALCULATOR_ANCHOR = "calculadora-credito";

export const MONTHLY_ESTIMATE_TYPES = ["casa", "departamento"];
// Por debajo de este precio es casi seguro un dato mal capturado (o un pago
// que no corresponde a un crédito): mejor no mostrar nada.
export const MONTHLY_ESTIMATE_MIN_PRICE = 150000;

// ¿Aplica el cálculo de mensualidad a esta propiedad? (en venta, disponible,
// vivienda y con un precio creíble). Lo comparten la cifra de la tarjeta y la
// calculadora interactiva de la ficha.
export function canEstimateMonthly(property) {
  if (!property || property.status !== "disponible") return false;
  if (property.operation_type === "renta") return false;
  if (!MONTHLY_ESTIMATE_TYPES.includes(property.type)) return false;
  return Number(property.price) >= MONTHLY_ESTIMATE_MIN_PRICE;
}

// Cálculo completo de un crédito de cuota fija a partir de un precio, con el
// enganche (%), plazo (años) y tasa anual (%) que se le pasen. Sin redondeos
// "hacia arriba": eso es de la cifra resumida de la tarjeta.
export function mortgageBreakdown(price, downPct, years, ratePct) {
  const total = Number(price);
  if (!(total > 0)) return null;
  const down = total * (Math.min(Math.max(Number(downPct) || 0, 0), 90) / 100);
  const loan = total - down;
  const payment = pmt(loan, ratePct, years);
  if (!(payment > 0)) return null;
  const months = Math.round(Number(years) * 12);
  const totalPaid = payment * months;
  return { down, loan, payment, months, totalPaid, interest: totalPaid - loan };
}

export function estimateMonthlyPayment(property) {
  if (!canEstimateMonthly(property)) return null;
  const price = Number(property.price);

  const { bankDownPct: downPct, bankYears: years, bankRate: rate } = COMPARE_DEFAULTS;
  const payment = pmt(price * (1 - downPct / 100), rate, years);
  if (!(payment > 0)) return null;
  // Se redondea hacia arriba a la centena: ≈ nunca debe quedar por debajo.
  return { payment: Math.ceil(payment / 100) * 100, downPct, years, rate };
}
