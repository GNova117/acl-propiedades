// Comparador de opciones de compra para una casa concreta: Infonavit, crédito
// bancario y de contado, lado a lado. Función pura: mismos datos, mismo
// resultado, nada se guarda. Son ESTIMACIONES de referencia:
//  - Infonavit usa el mismo simulador del panel (tasa por nivel salarial,
//    plazo por edad, UMA vigente).
//  - El banco usa tasa, enganche y plazo de referencia que la persona puede
//    cambiar (cada banco ofrece condiciones distintas).
//  - Los gastos de escrituración e impuestos se estiman con un porcentaje
//    parejo para las tres opciones.

import { simularCreditoInfonavit } from "./infonavitSimulator";

export const COMPARE_DEFAULTS = {
  bankRate: 11.5, // tasa anual de referencia, %
  bankDownPct: 20, // enganche, % del precio
  bankYears: 20,
  closingCostsPct: 5, // escrituración, impuestos y avalúo, % del precio
};

// Cuánto del ingreso mensual conviene que ocupe la cuota.
export const BANK_INCOME_RATIO = 0.35;
export const INFONAVIT_INCOME_RATIO = 0.3; // tope legal del descuento sobre el salario

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

// Pago mensual de un crédito de cuota fija (sistema francés).
export function pmt(principal, annualRatePct, years) {
  const p = num(principal);
  const months = Math.round(num(years) * 12);
  if (p === 0 || months === 0) return 0;
  const r = num(annualRatePct) / 100 / 12;
  if (r === 0) return p / months;
  return (p * r) / (1 - Math.pow(1 + r, -months));
}

const round2 = (n) => Math.round(n * 100) / 100;

export function compareCredits(input) {
  const price = num(input.price);
  const closingPct = input.closingCostsPct == null ? COMPARE_DEFAULTS.closingCostsPct : num(input.closingCostsPct);
  const closingCosts = price * (closingPct / 100);
  const salary = num(input.salary);

  // ── Contado ──
  const cash = { key: "contado", cashNow: price + closingCosts, ssvUsed: 0, financed: 0, payment: 0, months: 0, interest: 0, minIncome: 0 };
  cash.totalCost = cash.cashNow;

  // ── Banco ──
  const bankDownPct = input.bankDownPct == null ? COMPARE_DEFAULTS.bankDownPct : Math.min(100, num(input.bankDownPct));
  const bankYears = input.bankYears == null ? COMPARE_DEFAULTS.bankYears : num(input.bankYears);
  const bankRate = input.bankRate == null ? COMPARE_DEFAULTS.bankRate : num(input.bankRate);
  const bankDown = price * (bankDownPct / 100);
  const bankFinanced = price - bankDown;
  const bankMonths = Math.round(bankYears * 12);
  const bankPayment = pmt(bankFinanced, bankRate, bankYears);
  const bank = {
    key: "banco",
    cashNow: bankDown + closingCosts,
    ssvUsed: 0,
    financed: bankFinanced,
    payment: bankPayment,
    months: bankMonths,
    interest: bankPayment * bankMonths - bankFinanced,
    minIncome: bankPayment / BANK_INCOME_RATIO,
  };
  bank.totalCost = bank.cashNow + bankPayment * bankMonths;

  // ── Infonavit ──
  const sim = simularCreditoInfonavit({ edad: input.age, sexo: input.sex, salarioMensual: salary, ssv: input.ssv });
  const available = salary > 0 && sim.plazoAnios > 0 && sim.montoCredito > 0;
  const ssvUsed = available ? Math.min(sim.saldoSsv, price) : 0;
  const credit = available ? Math.max(0, Math.min(sim.montoCredito, price - ssvUsed)) : 0;
  const infDown = available ? Math.max(0, price - ssvUsed - credit) : price;
  const infPayment = available ? pmt(credit, sim.tasaAnual, sim.plazoAnios) : 0;
  const infMonths = available ? sim.plazoMeses : 0;
  const infonavit = {
    key: "infonavit",
    available,
    rate: sim.tasaAnual,
    years: sim.plazoAnios,
    cashNow: infDown + closingCosts,
    ssvUsed,
    financed: credit,
    payment: infPayment,
    months: infMonths,
    interest: infPayment * infMonths - credit,
    minIncome: infPayment / INFONAVIT_INCOME_RATIO,
    coversAll: available && infDown === 0,
    maxCapacity: sim.capacidadTotal,
  };
  infonavit.totalCost = infonavit.cashNow + ssvUsed + infPayment * infMonths;

  const options = [cash, bank, infonavit].map((o) => ({ ...o, cashNow: round2(o.cashNow), payment: round2(o.payment), totalCost: round2(o.totalCost), interest: round2(Math.max(0, o.interest)), minIncome: round2(o.minIncome), financed: round2(o.financed), ssvUsed: round2(o.ssvUsed) }));

  // Marcas de "mejor" solo entre opciones que aplican.
  const usable = options.filter((o) => o.key !== "infonavit" || o.available);
  const withPayment = usable.filter((o) => o.payment > 0);
  const cheapest = usable.reduce((a, b) => (b.totalCost < a.totalCost ? b : a), usable[0]);
  const lowestPayment = withPayment.length ? withPayment.reduce((a, b) => (b.payment < a.payment ? b : a)) : null;
  const lowestUpfront = usable.reduce((a, b) => (b.cashNow < a.cashNow ? b : a), usable[0]);

  return {
    price: round2(price),
    closingCosts: round2(closingCosts),
    options,
    best: { totalCost: cheapest?.key || null, payment: lowestPayment?.key || null, upfront: lowestUpfront?.key || null },
  };
}
