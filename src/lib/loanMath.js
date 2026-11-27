// Matemática de créditos de cuota fija (sistema francés) en UN solo lugar. La usan el simulador Infonavit del panel,
// el comparador público de créditos y el «desde $X al mes» de las tarjetas y la ficha, para que nunca discrepen.
const num = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

// Pago mensual de un crédito de `principal` a `annualRatePct` % anual por `years` años.
export function pmt(principal, annualRatePct, years) {
  const p = num(principal);
  const months = Math.round(num(years) * 12);
  if (p === 0 || months === 0) return 0;
  const r = num(annualRatePct) / 100 / 12;
  if (r === 0) return p / months;
  return (p * r) / (1 - Math.pow(1 + r, -months));
}

// Lo inverso: cuánto crédito alcanza con un pago mensual dado (valor presente de las mensualidades).
export function principalFromPayment(monthlyPayment, annualRatePct, years) {
  const payment = num(monthlyPayment);
  const months = Math.round(num(years) * 12);
  if (payment === 0 || months === 0) return 0;
  const r = num(annualRatePct) / 100 / 12;
  if (r === 0) return payment * months;
  return payment * ((1 - Math.pow(1 + r, -months)) / r);
}
