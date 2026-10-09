import { describe, expect, it } from "vitest";
import { compareCredits, pmt } from "./creditCompare";

describe("pmt", () => {
  it("con tasa 0% reparte el principal entre los meses sin interés", () => {
    expect(pmt(120000, 0, 10)).toBe(1000); // 120,000 / 120 meses
  });

  it("devuelve 0 si no hay principal o no hay plazo", () => {
    expect(pmt(0, 12, 10)).toBe(0);
    expect(pmt(100000, 12, 0)).toBe(0);
  });

  it("a un mes de plazo, el pago es exactamente principal x (1 + tasa mensual)", () => {
    // Caso verificable a mano: con un solo mes, pmt = p*r / (1 - (1+r)^-1) = p*(1+r).
    expect(pmt(100000, 12, 1 / 12)).toBeCloseTo(101000, 2);
  });

  it("a mayor tasa, el pago mensual es mayor para el mismo principal y plazo", () => {
    expect(pmt(1000000, 15, 10)).toBeGreaterThan(pmt(1000000, 10, 10));
  });
});

describe("compareCredits", () => {
  it("de contado, el efectivo requerido es precio + gastos de escrituración", () => {
    const r = compareCredits({ price: 1000000, closingCostsPct: 5 });
    const cash = r.options.find((o) => o.key === "contado");
    expect(cash.cashNow).toBe(1050000);
    expect(cash.totalCost).toBe(1050000);
    expect(cash.payment).toBe(0);
  });

  it("de banco, el enganche es el % pedido del precio y lo financiado es el resto", () => {
    const r = compareCredits({ price: 1000000, closingCostsPct: 5, bankDownPct: 20 });
    const bank = r.options.find((o) => o.key === "banco");
    expect(bank.cashNow).toBe(200000 + 50000);
    expect(bank.financed).toBe(800000);
    expect(bank.payment).toBeGreaterThan(0);
  });

  it("sin salario (o sin edad válida), Infonavit queda marcado como no disponible", () => {
    const r = compareCredits({ price: 1000000, closingCostsPct: 5 });
    const inf = r.options.find((o) => o.key === "infonavit");
    expect(inf.available).toBe(false);
    expect(inf.payment).toBe(0);
    expect(inf.financed).toBe(0);
  });

  it("sin Infonavit disponible, de contado sale más barato en el costo total (sin pagar interés) aunque el banco pida menos efectivo inicial", () => {
    const r = compareCredits({ price: 1000000, closingCostsPct: 5 });
    expect(r.best.totalCost).toBe("contado");
    expect(r.best.payment).toBe("banco");
    expect(r.best.upfront).toBe("banco");
  });

  it("cuando la Subcuenta de Vivienda alcanza a cubrir toda la casa, Infonavit no deja nada por financiar (coversAll)", () => {
    const r = compareCredits({ price: 500000, closingCostsPct: 5, salary: 15000, age: 30, sex: "hombre", ssv: 2000000 });
    const inf = r.options.find((o) => o.key === "infonavit");
    expect(inf.available).toBe(true);
    expect(inf.ssvUsed).toBe(500000);
    expect(inf.financed).toBe(0);
    expect(inf.coversAll).toBe(true);
  });

  it("el crédito Infonavit nunca financia más de lo que falta por pagar después de usar la Subcuenta", () => {
    const r = compareCredits({ price: 500000, closingCostsPct: 5, salary: 20000, age: 30, sex: "hombre", ssv: 50000 });
    const inf = r.options.find((o) => o.key === "infonavit");
    expect(inf.ssvUsed + inf.financed).toBeLessThanOrEqual(500000);
  });
});
