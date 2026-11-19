import { describe, expect, it } from "vitest";
import { activeRangeKey, digitsOnly, formatCompactMXN, formatThousands, priceRangesFor } from "./priceRanges";

describe("formato de precios", () => {
  it("pone comas de miles", () => {
    expect(formatThousands("1500000")).toBe("1,500,000");
    expect(formatThousands("999")).toBe("999");
    expect(formatThousands("")).toBe("");
  });
  it("ignora lo que no es dígito y los ceros a la izquierda", () => {
    expect(digitsOnly("$1,500,000.50")).toBe("150000050");
    expect(formatThousands("007")).toBe("7");
  });
  it("compacta para las etiquetas", () => {
    expect(formatCompactMXN(1_500_000)).toBe("$1.5 M");
    expect(formatCompactMXN(2_000_000)).toBe("$2 M");
    expect(formatCompactMXN(850_000)).toBe("$850 mil");
    expect(formatCompactMXN(12_000)).toBe("$12,000");
    expect(formatCompactMXN("x")).toBe("");
  });
});

describe("rangos de precio", () => {
  it("venta y renta tienen escalas distintas", () => {
    expect(priceRangesFor("compra").at(-1).min).toBe(5_000_000);
    expect(priceRangesFor("").at(-1).min).toBe(5_000_000);
    expect(priceRangesFor("renta").at(-1).min).toBe(20_000);
  });
  it("detecta el rango exacto que está puesto", () => {
    const ranges = priceRangesFor("compra");
    expect(activeRangeKey(ranges, "", "1000000")).toBe("s1");
    expect(activeRangeKey(ranges, "1000000", "2000000")).toBe("s2");
    expect(activeRangeKey(ranges, "5000000", "")).toBe("s5");
  });
  it("si lo capturado no coincide con un rango, ninguno queda activo", () => {
    const ranges = priceRangesFor("compra");
    expect(activeRangeKey(ranges, "1200000", "2000000")).toBeNull();
    expect(activeRangeKey(ranges, "", "")).toBeNull();
  });
});
