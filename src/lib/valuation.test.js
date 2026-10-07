import { describe, expect, it } from "vitest";
import { estimateValue, MAX_SPREAD_PCT } from "./valuation";

describe("estimateValue", () => {
  it("valúa terreno y construcción por separado y los suma en base", () => {
    const r = estimateValue({ landArea: 200, builtArea: 150, landRate: 1000, builtRate: 8000, spreadPct: 10 });
    expect(r.landValue).toBe(200000);
    expect(r.builtValue).toBe(1200000);
    expect(r.base).toBe(1400000);
  });

  it("redondea el centro al múltiplo de 1,000 más cercano", () => {
    const r = estimateValue({ landArea: 200, builtArea: 0, landRate: 1333, builtRate: 0, spreadPct: 0 });
    // base = 266,600 -> redondeado a millar = 267,000
    expect(r.center).toBe(267000);
  });

  it("redondea el rango hacia afuera (piso y techo) para no quedar más angosto que el margen pedido", () => {
    const r = estimateValue({ landArea: 0, builtArea: 100, builtRate: 9000, landRate: 0, spreadPct: 10 });
    // base = 900,000; low = 810,000 (ya exacto); high = 990,000 -> ceil a 5,000 = 990,000
    expect(r.base).toBe(900000);
    expect(r.low).toBeLessThanOrEqual(r.base * 0.9);
    // Tolerancia de un centavo: 900000 * 1.1 da 990000.0000000001 en punto
    // flotante puro, pero la función ya lo redondea a centavos antes de
    // comparar (ver el comentario de `cents()` en valuation.js).
    expect(r.high).toBeGreaterThanOrEqual(r.base * 1.1 - 0.01);
    expect(r.low % 5000).toBe(0);
    expect(r.high % 5000).toBe(0);
  });

  it("nunca deja el rango más angosto que el margen pedido, incluso con redondeo de punto flotante", () => {
    const r = estimateValue({ landArea: 0, builtArea: 90, builtRate: 10000, landRate: 0, spreadPct: 10 });
    expect(r.low).toBeLessThanOrEqual(900000 * 0.9);
    expect(r.high).toBeGreaterThanOrEqual(900000 * 1.1 - 0.01);
  });

  it("limita el margen al tope de MAX_SPREAD_PCT aunque se pida uno mayor", () => {
    const capped = estimateValue({ landArea: 0, builtArea: 100, builtRate: 10000, landRate: 0, spreadPct: 90 });
    const atCap = estimateValue({ landArea: 0, builtArea: 100, builtRate: 10000, landRate: 0, spreadPct: MAX_SPREAD_PCT });
    expect(capped.low).toBe(atCap.low);
    expect(capped.high).toBe(atCap.high);
  });

  it("trata superficies o precios negativos, vacíos o inválidos como cero", () => {
    const r = estimateValue({ landArea: -50, builtArea: "", landRate: undefined, builtRate: NaN, spreadPct: 10 });
    expect(r.base).toBe(0);
    expect(r.center).toBe(0);
    expect(r.low).toBe(0);
    expect(r.high).toBe(0);
  });
});
