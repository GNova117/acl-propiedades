import { describe, expect, it } from "vitest";
import { buildActiveFilterChips } from "./activeFilters";

// t de prueba: devuelve la llave con sus valores, para ver qué se pidió.
const t = (key, vars) => (vars ? `${key}:${JSON.stringify(vars)}` : key);
const ctx = { t, typeLabel: (k) => `tipo-${k}`, amenityLabel: (k) => `am-${k}` };
const EMPTY = { q: "", type: "", operationType: "", tipoNave: "", zone: "", minPrice: "", maxPrice: "", minArea: "", maxArea: "", minBedrooms: "", minBathrooms: "", minParking: "", amenities: [], bounds: null };

describe("buildActiveFilterChips", () => {
  it("sin filtros no hay chips", () => {
    expect(buildActiveFilterChips(EMPTY, ctx)).toEqual([]);
  });

  it("un chip por filtro, cada uno con lo que se limpia al quitarlo", () => {
    const chips = buildActiveFilterChips(
      { ...EMPTY, type: "casa", zone: "Senderos", minBedrooms: "3", amenities: ["alberca", "bodega"] },
      ctx
    );
    expect(chips.map((c) => c.key)).toEqual(["type", "zone", "minBedrooms", "amenity:alberca", "amenity:bodega"]);
    expect(chips[0].patch).toEqual({ type: "" });
    // Quitar una amenidad deja las demás.
    expect(chips[3].patch).toEqual({ amenities: ["bodega"] });
  });

  it("el precio es un solo chip (desde, hasta o rango) y se limpia completo", () => {
    const both = buildActiveFilterChips({ ...EMPTY, minPrice: "1000000", maxPrice: "2000000" }, ctx);
    expect(both).toHaveLength(1);
    expect(both[0].label).toContain("priceBetween");
    expect(both[0].label).toContain("$1 M");
    expect(both[0].patch).toEqual({ minPrice: "", maxPrice: "" });
    expect(buildActiveFilterChips({ ...EMPTY, minPrice: "5000000" }, ctx)[0].label).toContain("priceFrom");
    expect(buildActiveFilterChips({ ...EMPTY, maxPrice: "850000" }, ctx)[0].label).toContain("$850 mil");
  });

  it("en un apartado de un solo tipo no repite el tipo", () => {
    expect(buildActiveFilterChips({ ...EMPTY, type: "terreno" }, { ...ctx, fixedType: "terreno" })).toEqual([]);
  });

  it("incluye la búsqueda de texto y la zona del mapa", () => {
    const chips = buildActiveFilterChips({ ...EMPTY, q: "  alberca ", bounds: { south: 1, west: 1, north: 2, east: 2 } }, ctx);
    expect(chips.map((c) => c.key)).toEqual(["q", "bounds"]);
    expect(chips[0].label).toContain("alberca");
    expect(chips[1].patch).toEqual({ bounds: null });
  });
});
