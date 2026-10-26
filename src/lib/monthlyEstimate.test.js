import { describe, expect, it } from "vitest";
import { compareCredits } from "./creditCompare";
import { estimateMonthlyPayment } from "./monthlyEstimate";

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
