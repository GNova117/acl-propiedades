import { describe, expect, it } from "vitest";
import { hasMoreFiltersApplied } from "./moreFilters";

describe("hasMoreFiltersApplied", () => {
  it("sin filtros avanzados no hay nada aplicado", () => {
    expect(hasMoreFiltersApplied({})).toBe(false);
    expect(hasMoreFiltersApplied({ type: "casa", minPrice: "1000000", amenities: [] })).toBe(false);
    expect(hasMoreFiltersApplied(undefined)).toBe(false);
  });
  it("cualquiera de los de «Más filtros» lo marca", () => {
    expect(hasMoreFiltersApplied({ minBedrooms: "3" })).toBe(true);
    expect(hasMoreFiltersApplied({ minArea: "100" })).toBe(true);
    expect(hasMoreFiltersApplied({ amenities: ["alberca"] })).toBe(true);
    expect(hasMoreFiltersApplied({ minParking: "2" })).toBe(true);
  });
});
