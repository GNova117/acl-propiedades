import { describe, expect, it } from "vitest";
import { buildTrustSummary, computeSalesStats } from "./trustStats";

const NOW = new Date("2026-10-26T12:00:00Z").getTime();
const dayStr = (n) => new Date(NOW - n * 86400000).toISOString().slice(0, 10);
const prop = (id, createdDaysAgo, extra = {}) => ({ id, status: "vendida", active: true, created_at: new Date(NOW - createdDaysAgo * 86400000).toISOString(), ...extra });

describe("computeSalesStats", () => {
  it("cuenta ventas, las del último año y ordena las recientes", () => {
    const properties = [prop("a", 100), prop("b", 500), prop("c", 40)];
    const ventas = [
      { property_id: "a", fecha_venta: dayStr(30) },
      { property_id: "b", fecha_venta: dayStr(400) },
      { property_id: "c", fecha_venta: dayStr(5) },
    ];
    const stats = computeSalesStats(ventas, properties, NOW);
    expect(stats.total).toBe(3);
    expect(stats.last_12_months).toBe(2);
    expect(stats.recent_property_ids).toEqual(["c", "a", "b"]);
  });

  it("el promedio de días ignora ventas registradas el mismo día del alta", () => {
    const properties = [prop("a", 100), prop("b", 10)];
    const ventas = [
      { property_id: "a", fecha_venta: dayStr(40) }, // 60 días
      { property_id: "b", fecha_venta: dayStr(10) }, // 0 días: se ignora
    ];
    expect(computeSalesStats(ventas, properties, NOW).avg_days_to_sell).toBe(60);
  });

  it("sin días válidos el promedio es null, y no cuenta ventas de propiedades que ya no existen", () => {
    const stats = computeSalesStats([{ property_id: "x", fecha_venta: dayStr(1) }], [], NOW);
    expect(stats.total).toBe(0);
    expect(stats.avg_days_to_sell).toBeNull();
  });

  it("las propiedades inactivas cuentan pero no salen en la galería", () => {
    const properties = [prop("a", 100, { active: false })];
    const stats = computeSalesStats([{ property_id: "a", fecha_venta: dayStr(3) }], properties, NOW);
    expect(stats.total).toBe(1);
    expect(stats.recent_property_ids).toEqual([]);
  });
});

describe("buildTrustSummary", () => {
  const properties = [prop("a", 100), prop("b", 100), prop("c", 100), prop("d", 100), { ...prop("e", 3), status: "disponible" }];
  const stats = { total: 4, last_12_months: 3, avg_days_to_sell: 45, recent_property_ids: ["a", "b", "c", "d"] };

  it("no muestra el bloque con pocas ventas", () => {
    expect(buildTrustSummary({ ...stats, total: 2 }, properties)).toBeNull();
    expect(buildTrustSummary(null, properties)).toBeNull();
  });

  it("arma las cifras y limita la galería a 3 vendidas", () => {
    const summary = buildTrustSummary(stats, properties);
    expect(summary).toMatchObject({ sold: 4, soldLastYear: 3, avgDays: 45, available: 1 });
    expect(summary.recentSold.map((p) => p.id)).toEqual(["a", "b", "c"]);
  });

  it("no repite el total como 'último año' cuando todas las ventas son recientes", () => {
    expect(buildTrustSummary({ ...stats, last_12_months: 4 }, properties).soldLastYear).toBeNull();
  });

  it("omite cifras vacías en vez de mostrar ceros", () => {
    const summary = buildTrustSummary({ ...stats, avg_days_to_sell: null, last_12_months: 0 }, properties);
    expect(summary.avgDays).toBeNull();
    expect(summary.soldLastYear).toBeNull();
  });
});
