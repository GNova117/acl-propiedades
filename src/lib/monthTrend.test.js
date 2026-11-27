import { describe, expect, it } from "vitest";
import { monthTrend } from "./monthTrend";

const NOW = new Date(2026, 10, 15, 12); // 15 de noviembre de 2026, hora local

describe("monthTrend", () => {
  it("cuenta los de este mes y los del mes pasado", () => {
    const items = [
      { created_at: new Date(2026, 10, 2).toISOString() },
      { created_at: new Date(2026, 10, 14).toISOString() },
      { created_at: new Date(2026, 9, 30).toISOString() },
      { created_at: new Date(2026, 8, 1).toISOString() },
    ];
    expect(monthTrend(items, NOW)).toEqual({ thisMonth: 2, lastMonth: 1, dated: 4 });
  });

  it("enero compara contra diciembre del año anterior", () => {
    const items = [{ created_at: new Date(2025, 11, 20).toISOString() }, { created_at: new Date(2026, 0, 3).toISOString() }];
    expect(monthTrend(items, new Date(2026, 0, 10))).toEqual({ thisMonth: 1, lastMonth: 1, dated: 2 });
  });

  it("ignora registros sin fecha o con fecha inválida y tolera listas vacías", () => {
    expect(monthTrend([{}, { created_at: "no es fecha" }, null], NOW)).toEqual({ thisMonth: 0, lastMonth: 0, dated: 0 });
    expect(monthTrend(undefined, NOW)).toEqual({ thisMonth: 0, lastMonth: 0, dated: 0 });
  });
});
