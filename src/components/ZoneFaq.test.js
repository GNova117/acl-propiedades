import { describe, expect, it } from "vitest";
import { buildZoneFaq } from "./ZoneFaq";

// `t` falso: devuelve la llave y los datos, para ver qué respuesta se eligió.
const t = (key, vars = {}) => `${key}|${Object.values(vars).join(",")}`;
const formatPrice = (n) => "MXN " + n;

describe("buildZoneFaq", () => {
  it("con datos del mercado usa la cifra real", () => {
    const pairs = buildZoneFaq(t, { place: "Torreón", summary: { available: 12, medianPrice: 1500000 }, formatPrice });
    expect(pairs).toHaveLength(4);
    expect(pairs[0][1]).toBe("zoneFaq.whatA|Torreón,12");
    expect(pairs[1][1]).toBe("zoneFaq.priceA|Torreón,MXN 1500000");
  });

  it("sin datos no inventa cifras", () => {
    const pairs = buildZoneFaq(t, { place: "Lerdo", summary: null, formatPrice });
    expect(pairs[0][1]).toBe("zoneFaq.whatANone|Lerdo");
    expect(pairs[1][1]).toBe("zoneFaq.priceANone|Lerdo");
  });
});
