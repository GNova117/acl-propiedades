import { describe, expect, it } from "vitest";
import { readSellPrefill, sellPrefillQuery } from "./sellPrefill";

describe("sellPrefillQuery", () => {
  it("arma la dirección con lo capturado", () => {
    expect(sellPrefillQuery({ type: "casa", zoneId: "zone-torreon", landArea: 200, builtArea: "120.5" })).toBe("tipo=casa&zona=zone-torreon&terreno=200&construccion=120.5");
  });

  it("omite lo vacío, inválido o raro", () => {
    expect(sellPrefillQuery({ type: "casa", zoneId: "", landArea: "abc", builtArea: -5 })).toBe("tipo=casa");
    expect(sellPrefillQuery({ type: "<script>", zoneId: "x y" })).toBe("");
    expect(sellPrefillQuery()).toBe("");
  });
});

describe("readSellPrefill", () => {
  it("lee los campos válidos con los nombres del formulario", () => {
    const params = new URLSearchParams("tipo=terreno&zona=zone-lerdo&terreno=350&construccion=0");
    expect(readSellPrefill(params)).toEqual({ type: "terreno", zoneId: "zone-lerdo", landArea: "350" });
  });

  it("ignora valores sospechosos o fuera de rango y tolera entradas inválidas", () => {
    expect(readSellPrefill(new URLSearchParams("tipo=<img src=x>&zona=../../etc&terreno=9999999999&construccion=-3"))).toEqual({});
    expect(readSellPrefill(null)).toEqual({});
    expect(readSellPrefill({})).toEqual({});
  });

  it("ida y vuelta: lo que arma sellPrefillQuery lo lee readSellPrefill", () => {
    const values = { type: "casa", zoneId: "zone-torreon", landArea: "200", builtArea: "120" };
    expect(readSellPrefill(new URLSearchParams(sellPrefillQuery(values)))).toEqual(values);
  });
});
