import { describe, expect, it } from "vitest";
import { estimateValue } from "./valuation";
import { SELL_ESTIMATE_SPREAD_PCT, sellEstimate } from "./sellEstimate";

const zone = { id: "z1", name: "Senderos", land_price_per_m2: 4000, price_per_m2: 9000 };

describe("sellEstimate", () => {
  it("casa: valora terreno y construcción con el tabulador de la zona y da un rango", () => {
    const result = sellEstimate({ zone, type: "casa", landArea: 200, builtArea: 150 });
    // 200 × 4,000 + 150 × 9,000 = 2,150,000
    expect(result).toEqual({ ...pick(estimateValue({ landArea: 200, builtArea: 150, landRate: 4000, builtRate: 9000, spreadPct: SELL_ESTIMATE_SPREAD_PCT })) });
    expect(result.center).toBe(2150000);
    expect(result.low).toBeLessThan(2150000);
    expect(result.high).toBeGreaterThan(2150000);
  });

  it("terreno: solo cuenta el terreno, aunque se haya capturado construcción", () => {
    expect(sellEstimate({ zone, type: "terreno", landArea: 300, builtArea: 999 }).center).toBe(1200000);
  });

  it("sin zona, sin metros o sin precio de zona no hay estimado (mejor nada que un número falso)", () => {
    expect(sellEstimate({ zone: null, type: "casa", landArea: 200, builtArea: 150 })).toBeNull();
    expect(sellEstimate({ zone, type: "casa", landArea: 0, builtArea: 150 })).toBeNull();
    expect(sellEstimate({ zone, type: "casa", landArea: "x", builtArea: 150 })).toBeNull();
    expect(sellEstimate({ zone: { ...zone, land_price_per_m2: 0 }, type: "casa", landArea: 200, builtArea: 150 })).toBeNull();
    expect(sellEstimate({ zone: { ...zone, price_per_m2: 0 }, type: "casa", landArea: 200, builtArea: 150 })).toBeNull();
    expect(sellEstimate()).toBeNull();
  });

  it("una casa sin metros de construcción no se estima con solo el terreno", () => {
    expect(sellEstimate({ zone, type: "casa", landArea: 200, builtArea: "" })).toBeNull();
    expect(sellEstimate({ zone, type: "departamento", landArea: 80, builtArea: 0 })).toBeNull();
  });

  it("el rango respeta el margen y queda redondeado hacia afuera", () => {
    const { low, high, center } = sellEstimate({ zone, type: "casa", landArea: 200, builtArea: 150 });
    expect(low).toBeLessThanOrEqual(center * 0.9);
    expect(high).toBeGreaterThanOrEqual(center * 1.1);
  });
});

function pick({ low, high, center }) {
  return { low, high, center };
}
