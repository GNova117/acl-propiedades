import { describe, expect, it } from "vitest";
import { MIN_SAMPLE, suggestPricePerM2 } from "./zonePriceSuggestion";

const sold = (price, area, extra = {}) => ({ zone: "Centro", status: "vendida", type: "casa", operation_type: "compra", price, area_m2: area, ...extra });

describe("suggestPricePerM2", () => {
  it("mediana del precio por m² de lo vendido en la zona", () => {
    const list = [sold(1000000, 100), sold(1200000, 100), sold(2000000, 100)]; // 10,000 · 12,000 · 20,000
    expect(suggestPricePerM2(list, "Centro", "built")).toEqual({ value: 12000, count: 3 });
  });
  it("con muestra insuficiente no sugiere", () => {
    expect(MIN_SAMPLE).toBe(3);
    expect(suggestPricePerM2([sold(1, 1), sold(1, 1)], "Centro", "built")).toBeNull();
  });
  it("solo cuenta ventas de esa zona, vendidas y no rentas", () => {
    const list = [sold(1000000, 100), sold(1000000, 100), sold(1000000, 100, { zone: "Otra" }), sold(1000000, 100, { status: "disponible" }), sold(1000000, 100, { operation_type: "renta" })];
    expect(suggestPricePerM2(list, "Centro", "built")).toBeNull();
  });
  it("terreno usa solo terrenos; construido no los mezcla", () => {
    const lands = [sold(500000, 250, { type: "terreno" }), sold(600000, 300, { type: "terreno" }), sold(900000, 300, { type: "terreno" })]; // 2000 · 2000 · 3000
    expect(suggestPricePerM2(lands, "Centro", "land")).toEqual({ value: 2000, count: 3 });
    expect(suggestPricePerM2(lands, "Centro", "built")).toBeNull();
  });
  it("área o precio inválidos se descartan", () => {
    const list = [sold(1000000, 0), sold(0, 100), sold(1000000, 100), sold(1000000, 100), sold(1000000, 100)];
    expect(suggestPricePerM2(list, "Centro", "built")).toEqual({ value: 10000, count: 3 });
  });
});
