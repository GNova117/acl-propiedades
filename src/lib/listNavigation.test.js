import { describe, expect, it } from "vitest";
import { listingFrom } from "./listNavigation";

describe("listingFrom", () => {
  it("acepta listados con filtros, zonas, terrenos y naves", () => {
    expect(listingFrom({ from: "/propiedades" })).toBe("/propiedades");
    expect(listingFrom({ from: "/propiedades?tipo=casa&pagina=2" })).toBe("/propiedades?tipo=casa&pagina=2");
    expect(listingFrom({ from: "/propiedades/zona/torreon" })).toBe("/propiedades/zona/torreon");
    expect(listingFrom({ from: "/terrenos?min=100000" })).toBe("/terrenos?min=100000");
    expect(listingFrom({ from: "/naves-industriales" })).toBe("/naves-industriales");
  });
  it("no toma otra ficha, el inicio ni direcciones ajenas", () => {
    expect(listingFrom({ from: "/propiedades/abc-123" })).toBeNull();
    expect(listingFrom({ from: "/" })).toBeNull();
    expect(listingFrom({ from: "/favoritos" })).toBeNull();
    expect(listingFrom({ from: "https://otro.com/propiedades" })).toBeNull();
    expect(listingFrom({ from: "//otro.com/propiedades" })).toBeNull();
  });
  it("sin estado válido no hay destino", () => {
    expect(listingFrom(null)).toBeNull();
    expect(listingFrom(undefined)).toBeNull();
    expect(listingFrom("x")).toBeNull();
    expect(listingFrom({ from: 5 })).toBeNull();
  });
});
