import { describe, expect, it } from "vitest";
import { computeMaterialsTotals } from "./materialsTotals";

describe("computeMaterialsTotals", () => {
  it("multiplica cantidad por precio interno y externo, y suma por línea", () => {
    const totals = computeMaterialsTotals([
      { quantity: 10, unit_price_internal: 100, unit_price_external: 150 },
      { quantity: 2, unit_price_internal: 500, unit_price_external: 600 },
    ]);
    expect(totals.grandTotalInternal).toBe(2000);
    expect(totals.grandTotalExternal).toBe(2700);
  });

  it("el ahorro total es la diferencia entre el precio externo y el interno", () => {
    const totals = computeMaterialsTotals([{ quantity: 1, unit_price_internal: 100, unit_price_external: 150 }]);
    expect(totals.totalSavings).toBe(50);
  });

  it("trata un precio vacío o nulo como cero en vez de NaN", () => {
    const totals = computeMaterialsTotals([{ quantity: 10, unit_price_internal: "", unit_price_external: null }]);
    expect(totals.grandTotalInternal).toBe(0);
    expect(totals.grandTotalExternal).toBe(0);
  });

  it("sin materiales (o lista indefinida) da todos los totales en cero", () => {
    expect(computeMaterialsTotals([])).toEqual({ grandTotalInternal: 0, grandTotalExternal: 0, totalSavings: 0 });
    expect(computeMaterialsTotals(undefined)).toEqual({ grandTotalInternal: 0, grandTotalExternal: 0, totalSavings: 0 });
  });
});
