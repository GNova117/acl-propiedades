import { describe, expect, it } from "vitest";
import { bulkAdvisorIds, bulkPriceValue, MAX_PERCENT } from "./bulkProperties";

describe("bulkPriceValue", () => {
  it("bajar un porcentaje, redondeado a la centena", () => {
    expect(bulkPriceValue("percentDown", 5, 2450000)).toEqual({ price: 2327500 });
    expect(bulkPriceValue("percentDown", 3.3, 1234567)).toEqual({ price: 1193800 });
  });

  it("subir un porcentaje", () => {
    expect(bulkPriceValue("percentUp", 10, 1000000)).toEqual({ price: 1100000 });
  });

  it("precio exacto: a pesos enteros", () => {
    expect(bulkPriceValue("exact", 1850000.4, 999)).toEqual({ price: 1850000 });
  });

  it("rechaza cantidades inválidas, porcentajes enormes, modos raros y precios actuales sin dato", () => {
    for (const bad of [0, -5, "x", null, NaN]) expect(bulkPriceValue("percentDown", bad, 1000000).error).toBe("amount");
    expect(bulkPriceValue("percentDown", MAX_PERCENT + 1, 1000000).error).toBe("percent");
    expect(bulkPriceValue("percentDown", MAX_PERCENT, 1000000)).toEqual({ price: 500000 });
    expect(bulkPriceValue("raro", 5, 1000000).error).toBe("mode");
    expect(bulkPriceValue("percentUp", 5, 0).error).toBe("current");
    expect(bulkPriceValue("percentUp", 5, null).error).toBe("current");
  });

  it("un cambio que no mueve el precio no cuenta", () => {
    expect(bulkPriceValue("percentUp", 0.1, 1000).error).toBe("nochange"); // 1001 se redondea a 1000
  });
});

describe("bulkAdvisorIds", () => {
  it("agregar suma al asesor sin quitar a los demás, y no repite", () => {
    expect(bulkAdvisorIds("add", ["a1"], "a2")).toEqual(["a1", "a2"]);
    expect(bulkAdvisorIds("add", [], "a2")).toEqual(["a2"]);
    expect(bulkAdvisorIds("add", ["a2"], "a2")).toBeNull();
    expect(bulkAdvisorIds("add", undefined, "a2")).toEqual(["a2"]);
  });

  it("reemplazar deja solo a ese asesor, y no hace nada si ya era el único", () => {
    expect(bulkAdvisorIds("replace", ["a1", "a3"], "a2")).toEqual(["a2"]);
    expect(bulkAdvisorIds("replace", ["a2"], "a2")).toBeNull();
    expect(bulkAdvisorIds("replace", ["a2", "a3"], "a2")).toEqual(["a2"]);
  });

  it("sin asesor elegido no hay cambio", () => {
    expect(bulkAdvisorIds("add", ["a1"], "")).toBeNull();
  });
});
