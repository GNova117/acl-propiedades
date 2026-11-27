import { describe, expect, it } from "vitest";
import { materialPriceJumps, priceJump } from "./materialPriceAlert";

describe("priceJump", () => {
  it("avisa si sube más de 15 %", () => {
    expect(priceJump(100, 120)).toEqual({ pct: 20 });
    expect(priceJump("100", "135.5")).toEqual({ pct: 36 });
  });
  it("no avisa con una subida pequeña, igual o una baja", () => {
    expect(priceJump(100, 115)).toBeNull();
    expect(priceJump(100, 100)).toBeNull();
    expect(priceJump(100, 50)).toBeNull();
  });
  it("sin precio anterior o con datos vacíos no avisa", () => {
    expect(priceJump(0, 50)).toBeNull();
    expect(priceJump("", 50)).toBeNull();
    expect(priceJump(null, 50)).toBeNull();
    expect(priceJump(100, "")).toBeNull();
    expect(priceJump(100, "abc")).toBeNull();
  });
  it("el umbral se puede cambiar", () => {
    expect(priceJump(100, 108, 5)).toEqual({ pct: 8 });
  });
});

describe("materialPriceJumps", () => {
  it("revisa el precio interno y el externo por separado", () => {
    const jumps = materialPriceJumps({ unit_price_internal: 100, unit_price_external: 200 }, { unit_price_internal: 150, unit_price_external: 210 });
    expect(jumps).toEqual([{ field: "unit_price_internal", pct: 50, before: 100, after: 150 }]);
  });
  it("sin material anterior (alta nueva) no hay nada que comparar", () => {
    expect(materialPriceJumps(null, { unit_price_internal: 999 })).toEqual([]);
  });
});
