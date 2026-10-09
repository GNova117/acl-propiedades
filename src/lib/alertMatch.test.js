import { describe, expect, it } from "vitest";
import { describeCriteria, filtersToCriteria, isAvailable, matchesCriteria } from "./alertMatch";

describe("filtersToCriteria", () => {
  it("solo incluye lo que el filtro realmente tiene puesto", () => {
    const c = filtersToCriteria({ zone: "Centro", minPrice: "500000" });
    expect(c).toEqual({ zone: "Centro", min_price: 500000 });
  });

  it("fixedType manda sobre el tipo del filtro (apartados de un solo tipo, como Naves Industriales)", () => {
    expect(filtersToCriteria({ type: "casa" }, { fixedType: "nave_industrial" })).toMatchObject({ type: "nave_industrial" });
  });

  it("ignora valores numéricos en cero o negativos", () => {
    const c = filtersToCriteria({ minPrice: "0", minBedrooms: "-1" });
    expect(c.min_price).toBeUndefined();
    expect(c.min_bedrooms).toBeUndefined();
  });

  it("limita las amenidades a 20 para no guardar una lista sin tope", () => {
    const amenities = Array.from({ length: 30 }, (_, i) => `a${i}`);
    const c = filtersToCriteria({ amenities });
    expect(c.amenities).toHaveLength(20);
  });
});

describe("isAvailable", () => {
  it("una propiedad es disponible por default si no dice lo contrario", () => {
    expect(isAvailable({})).toBe(true);
  });

  it("inactiva o con otro estatus no es disponible", () => {
    expect(isAvailable({ active: false })).toBe(false);
    expect(isAvailable({ status: "vendida" })).toBe(false);
  });
});

describe("matchesCriteria", () => {
  const property = { type: "casa", zone: "Centro", price: 1500000, area_m2: 150, bedrooms: 3, bathrooms: 2, parking: 2, amenities: ["alberca", "jardin"] };

  it("un criterio vacío siempre coincide", () => {
    expect(matchesCriteria(property, {})).toBe(true);
  });

  it("rechaza si el tipo, zona u operación no coinciden", () => {
    expect(matchesCriteria(property, { type: "departamento" })).toBe(false);
    expect(matchesCriteria(property, { zone: "Otra zona" })).toBe(false);
    expect(matchesCriteria(property, { type: "casa", zone: "Centro" })).toBe(true);
  });

  it("respeta el rango de precio y de superficie", () => {
    expect(matchesCriteria(property, { min_price: 2000000 })).toBe(false);
    expect(matchesCriteria(property, { max_price: 1000000 })).toBe(false);
    expect(matchesCriteria(property, { min_price: 1000000, max_price: 2000000 })).toBe(true);
    expect(matchesCriteria(property, { min_area: 200 })).toBe(false);
  });

  it("recámaras/baños/cajones son un mínimo, no un valor exacto", () => {
    expect(matchesCriteria(property, { min_bedrooms: 3 })).toBe(true);
    expect(matchesCriteria(property, { min_bedrooms: 4 })).toBe(false);
  });

  it("exige que la propiedad tenga TODAS las amenidades pedidas", () => {
    expect(matchesCriteria(property, { amenities: ["alberca"] })).toBe(true);
    expect(matchesCriteria(property, { amenities: ["alberca", "roof garden"] })).toBe(false);
  });
});

describe("describeCriteria", () => {
  const money = (n) => `$${n}`;

  it("describe un rango de precio completo, o solo el límite que se puso", () => {
    expect(describeCriteria({ min_price: 1000000, max_price: 2000000 }, { money })).toEqual([{ key: "price", value: "$1000000 – $2000000" }]);
    expect(describeCriteria({ min_price: 1000000 }, { money })).toEqual([{ key: "price", value: "≥ $1000000" }]);
    expect(describeCriteria({ max_price: 2000000 }, { money })).toEqual([{ key: "price", value: "≤ $2000000" }]);
  });

  it("un criterio vacío no describe nada", () => {
    expect(describeCriteria({}, { money })).toEqual([]);
    expect(describeCriteria(null, { money })).toEqual([]);
  });

  it("junta zona, recámaras y amenidades como partes separadas", () => {
    const parts = describeCriteria({ zone: "Centro", min_bedrooms: 3, amenities: ["alberca", "jardin"] }, { money });
    expect(parts).toEqual([
      { key: "zone", value: "Centro" },
      { key: "bedrooms", value: "≥ 3" },
      { key: "amenities", value: "alberca, jardin" },
    ]);
  });
});
