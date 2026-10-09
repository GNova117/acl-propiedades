import { describe, expect, it } from "vitest";
import { estimateValue, MAX_SPREAD_PCT } from "./valuation.js";

describe("estimateValue", () => {
  it("valúa terreno y construcción por separado y los suma en base", () => {
    const result = estimateValue({
      landArea: 200,
      builtArea: 150,
      landRate: 3000,
      builtRate: 6000,
      spreadPct: 10,
    });

    expect(result.landValue).toBe(600000); // 200 * 3000
    expect(result.builtValue).toBe(900000); // 150 * 6000
    expect(result.base).toBe(1500000);
  });

  it("redondea el centro al múltiplo de 1,000 más cercano", () => {
    const result = estimateValue({ landArea: 100, builtArea: 0, landRate: 3333, builtRate: 0, spreadPct: 10 });
    // base = 333,300 -> centro redondeado a miles = 333,000
    expect(result.center).toBe(333000);
  });

  it("redondea el rango hacia afuera a múltiplos de 5,000 (nunca más angosto que el margen)", () => {
    const result = estimateValue({ landArea: 0, builtArea: 100, landRate: 0, builtRate: 9000, spreadPct: 10 });
    // base = 900,000; low = 810,000 (ya múltiplo); high = 990,000 (ya múltiplo)
    expect(result.low).toBe(810000);
    expect(result.high).toBe(990000);
    expect(result.low % 5000).toBe(0);
    expect(result.high % 5000).toBe(0);
  });

  it("nunca deja el rango más angosto que el margen pedido, incluso con redondeo de punto flotante", () => {
    // 900,000 * 1.1 = 990,000.0000000001 en punto flotante sin el redondeo a centavos
    const result = estimateValue({ landArea: 0, builtArea: 100, landRate: 0, builtRate: 9000, spreadPct: 10 });
    expect(result.high).toBe(990000);
  });

  it("nunca deja el rango más angosto que el margen pedido con otra magnitud (90 m² a $10,000/m²)", () => {
    const result = estimateValue({ landArea: 0, builtArea: 90, builtRate: 10000, landRate: 0, spreadPct: 10 });
    expect(result.low).toBeLessThanOrEqual(900000 * 0.9);
    expect(result.high).toBeGreaterThanOrEqual(900000 * 1.1 - 0.01);
  });

  it("limita el margen al tope máximo (50%) aunque se pida más", () => {
    const conTope = estimateValue({ landArea: 0, builtArea: 100, landRate: 0, builtRate: 10000, spreadPct: MAX_SPREAD_PCT });
    const pasado = estimateValue({ landArea: 0, builtArea: 100, landRate: 0, builtRate: 10000, spreadPct: 200 });
    expect(pasado.low).toBe(conTope.low);
    expect(pasado.high).toBe(conTope.high);
  });

  it("ignora superficies o precios negativos o no numéricos (los trata como 0)", () => {
    const result = estimateValue({ landArea: -50, builtArea: "abc", landRate: null, builtRate: undefined, spreadPct: 10 });
    expect(result.base).toBe(0);
    expect(result.center).toBe(0);
    expect(result.low).toBe(0);
    expect(result.high).toBe(0);
  });
});
