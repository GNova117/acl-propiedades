import { describe, expect, it } from "vitest";
import { MAX_SOURCES, maxValue, monthlySales, sourceSeries, stageSeries } from "./dashboardCharts";

describe("stageSeries", () => {
  it("cuenta por etapa actual y da la parte del total", () => {
    const s = stageSeries([{ stage: "nuevo" }, { stage: "nuevo" }, { stage: "cerrado" }, { stage: "perdido" }]);
    expect(s.map((x) => [x.key, x.value, x.share])).toEqual([
      ["nuevo", 2, 50],
      ["contactado", 0, 0],
      ["interesado", 0, 0],
      ["negociacion", 0, 0],
      ["cerrado", 1, 25],
      ["perdido", 1, 25],
    ]);
  });
  it("sin prospectos todo es cero (sin dividir entre cero)", () => {
    expect(stageSeries([]).every((x) => x.value === 0 && x.share === 0)).toBe(true);
  });
});

describe("sourceSeries", () => {
  it("de más a menos, con la fuente vacía como «otro»", () => {
    const s = sourceSeries([{ source: "chatbot" }, { source: "chatbot" }, { source: "manual" }, {}]);
    expect(s).toEqual([
      { key: "chatbot", value: 2 },
      { key: "manual", value: 1 },
      { key: "otro", value: 1 },
    ]);
  });
  it("junta las que sobran en «__rest»", () => {
    const prospects = Array.from({ length: 12 }, (_, i) => ({ source: `f${String(i).padStart(2, "0")}` }));
    const s = sourceSeries(prospects);
    expect(s).toHaveLength(MAX_SOURCES);
    expect(s[s.length - 1]).toEqual({ key: "__rest", value: 12 - (MAX_SOURCES - 1) });
    expect(s.reduce((n, x) => n + x.value, 0)).toBe(12);
  });
});

describe("monthlySales", () => {
  const now = new Date(2026, 10, 17); // noviembre de 2026
  it("trae los últimos 12 meses con ceros y cuenta las ventas de cada uno", () => {
    const s = monthlySales([{ fecha_venta: "2026-11-02" }, { fecha_venta: "2026-11-30" }, { fecha_venta: "2026-01-15" }, { fecha_venta: "2025-12-31" }, { fecha_venta: "2024-01-01" }, {}], now);
    expect(s).toHaveLength(12);
    expect(s[0].key).toBe("2025-12");
    expect(s[11].key).toBe("2026-11");
    expect(Object.fromEntries(s.map((x) => [x.key, x.value]))).toMatchObject({ "2026-11": 2, "2026-01": 1, "2025-12": 1, "2026-05": 0 });
    expect(s.reduce((n, x) => n + x.value, 0)).toBe(4); // la de 2024 y la sin fecha no entran
  });
  it("cruza el cambio de año", () => {
    const s = monthlySales([], new Date(2026, 0, 5), 3);
    expect(s.map((x) => x.key)).toEqual(["2025-11", "2025-12", "2026-01"]);
  });
});

describe("maxValue", () => {
  it("nunca es cero", () => {
    expect(maxValue([])).toBe(1);
    expect(maxValue([{ value: 0 }])).toBe(1);
    expect(maxValue([{ value: 3 }, { value: 9 }])).toBe(9);
  });
});
