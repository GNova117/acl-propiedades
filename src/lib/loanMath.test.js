import { describe, expect, it } from "vitest";
import { pmt, principalFromPayment } from "./loanMath";

describe("pmt", () => {
  it("cuota fija conocida: 1,000,000 a 10 % por 20 años ≈ 9,650.22", () => {
    expect(pmt(1000000, 10, 20)).toBeCloseTo(9650.22, 1);
  });
  it("sin interés es capital entre meses", () => {
    expect(pmt(120000, 0, 10)).toBe(1000);
  });
  it("datos vacíos o inválidos → 0", () => {
    expect(pmt(0, 10, 20)).toBe(0);
    expect(pmt(1000, 10, 0)).toBe(0);
    expect(pmt("abc", 10, 20)).toBe(0);
  });
});

describe("principalFromPayment", () => {
  it("es el inverso de pmt", () => {
    const payment = pmt(850000, 9.5, 25);
    expect(principalFromPayment(payment, 9.5, 25)).toBeCloseTo(850000, 0);
  });
  it("sin interés es pago por meses", () => {
    expect(principalFromPayment(1000, 0, 10)).toBe(120000);
  });
  it("datos vacíos → 0", () => {
    expect(principalFromPayment(0, 5, 10)).toBe(0);
    expect(principalFromPayment(1000, 5, 0)).toBe(0);
  });
});
