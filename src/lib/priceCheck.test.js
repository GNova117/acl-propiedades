import { describe, expect, it } from "vitest";
import { suspiciousPrice } from "./priceCheck";

describe("suspiciousPrice", () => {
  it("una venta de $2,450 o de $500 millones es sospechosa", () => {
    expect(suspiciousPrice("compra", 2450)).toBe("lowSale");
    expect(suspiciousPrice("compra", 500000000)).toBe("highSale");
  });
  it("una renta de $15,000,000 o de $300 es sospechosa", () => {
    expect(suspiciousPrice("renta", 15000000)).toBe("highRent");
    expect(suspiciousPrice("renta", 300)).toBe("lowRent");
  });
  it("precios normales y vacíos no avisan", () => {
    expect(suspiciousPrice("compra", 1450000)).toBeNull();
    expect(suspiciousPrice("renta", 15000)).toBeNull();
    expect(suspiciousPrice("compra", "")).toBeNull();
    expect(suspiciousPrice("compra", 0)).toBeNull();
  });
});
