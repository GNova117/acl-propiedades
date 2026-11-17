import { describe, expect, it } from "vitest";
import { compareCredits } from "./creditCompare";
import { canEstimateMonthly, estimateMonthlyPayment, mortgageBreakdown } from "./monthlyEstimate";

const house = { type: "casa", status: "disponible", operation_type: "compra", price: 2450000 };

describe("estimateMonthlyPayment", () => {
  it("coincide (redondeado hacia arriba a la centena) con la opción de banco del comparador", () => {
    const estimate = estimateMonthlyPayment(house);
    const bank = compareCredits({ price: house.price }).options.find((o) => o.key === "banco");
    expect(estimate.payment).toBeGreaterThanOrEqual(bank.payment);
    expect(estimate.payment - bank.payment).toBeLessThan(100);
    expect(estimate.payment % 100).toBe(0);
  });

  it("devuelve los supuestos usados, para poder mostrarlos", () => {
    expect(estimateMonthlyPayment(house)).toMatchObject({ downPct: 20, years: 20, rate: 11.5 });
  });

  it("aplica a departamentos pero no a terrenos ni naves", () => {
    expect(estimateMonthlyPayment({ ...house, type: "departamento" })).not.toBeNull();
    expect(estimateMonthlyPayment({ ...house, type: "terreno" })).toBeNull();
    expect(estimateMonthlyPayment({ ...house, type: "nave_industrial" })).toBeNull();
  });

  it("no aplica a rentas ni a propiedades apartadas o vendidas", () => {
    expect(estimateMonthlyPayment({ ...house, operation_type: "renta" })).toBeNull();
    expect(estimateMonthlyPayment({ ...house, status: "apartada" })).toBeNull();
    expect(estimateMonthlyPayment({ ...house, status: "vendida" })).toBeNull();
  });

  it("no muestra nada con precios vacíos o absurdamente bajos", () => {
    expect(estimateMonthlyPayment({ ...house, price: 0 })).toBeNull();
    expect(estimateMonthlyPayment({ ...house, price: 90000 })).toBeNull();
    expect(estimateMonthlyPayment(null)).toBeNull();
  });
});

describe("mortgageBreakdown", () => {
  it("con el enganche y plazo de referencia coincide con la cifra de la tarjeta (sin redondear)", () => {
    const b = mortgageBreakdown(house.price, 20, 20, 11.5);
    expect(b.down).toBeCloseTo(490000, 0);
    expect(b.loan).toBeCloseTo(1960000, 0);
    expect(Math.ceil(b.payment / 100) * 100).toBe(estimateMonthlyPayment(house).payment);
    expect(b.months).toBe(240);
  });
  it("lo que se paga de más son intereses", () => {
    const b = mortgageBreakdown(2000000, 10, 15, 10);
    expect(b.totalPaid).toBeCloseTo(b.payment * 180, 2);
    expect(b.interest).toBeCloseTo(b.totalPaid - b.loan, 2);
    expect(b.interest).toBeGreaterThan(0);
  });
  it("sin tasa no hay intereses", () => {
    expect(mortgageBreakdown(1200000, 0, 10, 0).interest).toBeCloseTo(0, 5);
  });
  it("limita el enganche a 0–90 % y rechaza datos inválidos", () => {
    expect(mortgageBreakdown(1000000, 150, 10, 10).down).toBeCloseTo(900000, 0);
    expect(mortgageBreakdown(1000000, -5, 10, 10).down).toBe(0);
    expect(mortgageBreakdown(0, 20, 10, 10)).toBeNull();
    expect(mortgageBreakdown(1000000, 20, 0, 10)).toBeNull();
  });
});

describe("canEstimateMonthly", () => {
  it("es la misma regla que usa la cifra de la tarjeta", () => {
    expect(canEstimateMonthly(house)).toBe(true);
    expect(canEstimateMonthly({ ...house, type: "terreno" })).toBe(false);
    expect(canEstimateMonthly({ ...house, price: 100000 })).toBe(false);
    expect(canEstimateMonthly(null)).toBe(false);
  });
});
