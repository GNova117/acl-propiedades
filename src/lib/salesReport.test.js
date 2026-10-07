import { describe, expect, it } from "vitest";
import {
  advisorPerformance,
  availableYears,
  buildSaleRows,
  currentInventory,
  dateParts,
  filterRows,
  inventorySeries,
  monthlyMatrix,
  monthsInPeriod,
  pendingSales,
  profitSummary,
  salesTeam,
} from "./salesReport";

describe("dateParts", () => {
  it("lee año/mes/día de un ISO sin pasar por Date (evita el corrimiento UTC)", () => {
    expect(dateParts("2026-03-15")).toEqual({ year: 2026, month: 2, day: 15 });
  });
});

describe("buildSaleRows", () => {
  const properties = [{ id: "p1", price: 1000000, created_at: "2026-01-01T00:00:00Z" }];
  const advisors = [{ id: "a1", name: "Ana" }, { id: "a2", name: "Beto" }];

  it("deja profit en null (no cero) cuando la venta no tiene liquidación", () => {
    const rows = buildSaleRows({
      ventas: [{ id: "v1", property_id: "p1", fecha_venta: "2026-02-01", advisor_id: "a1" }],
      properties,
      advisors,
    });
    expect(rows[0].profit).toBeNull();
    expect(rows[0].price).toBe(1000000);
  });

  it("calcula la utilidad y comisiones reutilizando computeLiquidacion cuando sí hay liquidación", () => {
    const rows = buildSaleRows({
      ventas: [{ id: "v1", property_id: "p1", fecha_venta: "2026-02-01", advisor_id: "a1" }],
      properties,
      advisors,
      liquidaciones: [
        {
          property_id: "p1",
          captador_id: "a1",
          vendedor_id: "a1",
          costo_total: 0,
          devolucion_vendedor: 0,
          inversion_servicios: 0,
          tasa_comision_captacion: 40,
          tasa_comision_venta: 30,
          tasa_gastos_admin: 10,
        },
      ],
    });
    expect(rows[0].profit).not.toBeNull();
    expect(rows[0].profit.comisiones).toHaveLength(1);
    expect(rows[0].profit.comisiones[0].advisorId).toBe("a1");
  });

  it("marca advisorMismatch cuando el asesor de la venta no coincide con el de la liquidación", () => {
    const rows = buildSaleRows({
      ventas: [{ id: "v1", property_id: "p1", fecha_venta: "2026-02-01", advisor_id: "a2" }],
      properties,
      advisors,
      liquidaciones: [{ property_id: "p1", captador_id: "a1", vendedor_id: "a1" }],
    });
    expect(rows[0].profit.advisorMismatch).toBe(true);
  });

  it("ignora ventas de propiedades que ya no existen", () => {
    const rows = buildSaleRows({
      ventas: [{ id: "v1", property_id: "no-existe", fecha_venta: "2026-02-01" }],
      properties,
      advisors,
    });
    expect(rows).toHaveLength(0);
  });

  it("no mide días de cierre cuando la venta es anterior al alta de la propiedad (casas históricas)", () => {
    const rows = buildSaleRows({
      ventas: [{ id: "v1", property_id: "p1", fecha_venta: "2025-12-01" }],
      properties,
      advisors,
    });
    expect(rows[0].diasCierre).toBeNull();
  });

  it("ordena las filas de más reciente a más antigua", () => {
    const rows = buildSaleRows({
      ventas: [
        { id: "v1", property_id: "p1", fecha_venta: "2026-01-10" },
        { id: "v2", property_id: "p1", fecha_venta: "2026-03-10" },
      ],
      properties,
      advisors,
    });
    expect(rows.map((r) => r.id)).toEqual(["v2", "v1"]);
  });
});

describe("filterRows", () => {
  const rows = [
    { year: 2026, month: 0, property: { type: "casa" } },
    { year: 2026, month: 5, property: { type: "terreno" } },
    { year: 2025, month: 0, property: { type: "casa" } },
  ];

  it("filtra por año, y opcionalmente por mes y tipo", () => {
    expect(filterRows(rows, { year: 2026 })).toHaveLength(2);
    expect(filterRows(rows, { year: 2026, month: 5 })).toHaveLength(1);
    expect(filterRows(rows, { year: 2026, type: "casa" })).toHaveLength(1);
  });
});

describe("monthsInPeriod", () => {
  const now = new Date("2026-09-15");

  it("un mes concreto siempre cuenta como 1", () => {
    expect(monthsInPeriod({ year: 2026, month: 3 }, now)).toBe(1);
  });

  it("el año en curso solo cuenta los meses ya transcurridos", () => {
    expect(monthsInPeriod({ year: 2026 }, now)).toBe(9);
  });

  it("un año ya pasado cuenta los 12 meses completos", () => {
    expect(monthsInPeriod({ year: 2025 }, now)).toBe(12);
  });

  it("un año futuro cuenta como 1 (evita dividir entre cero o negativo)", () => {
    expect(monthsInPeriod({ year: 2027 }, now)).toBe(1);
  });
});

describe("salesTeam", () => {
  it("incluye asesores activos y visibles, más cualquiera con ventas aunque esté inactivo/oculto", () => {
    const advisors = [
      { id: "a1", active: true, show_in_team: true },
      { id: "a2", active: false, show_in_team: true },
      { id: "a3", active: true, show_in_team: false },
    ];
    const rows = [{ advisorId: "a2" }];
    const team = salesTeam(advisors, rows);
    expect(team.map((a) => a.id).sort()).toEqual(["a1", "a2"]);
  });
});

describe("monthlyMatrix", () => {
  it("agrupa ventas por asesor y mes, y agrega una fila 'sin asignar' solo si hace falta", () => {
    const team = [{ id: "a1", name: "Ana" }];
    const rows = [
      { advisorId: "a1", month: 0, year: 2026, property: { type: "casa" } },
      { advisorId: null, month: 1, year: 2026, property: { type: "casa" } },
    ];
    const m = monthlyMatrix(rows, team, { year: 2026 });
    expect(m.lines).toHaveLength(2);
    expect(m.lines[0].months[0]).toBe(1);
    expect(m.grandTotal).toBe(2);
  });

  it("no agrega fila 'sin asignar' cuando todas las ventas tienen asesor", () => {
    const team = [{ id: "a1", name: "Ana" }];
    const rows = [{ advisorId: "a1", month: 0, year: 2026, property: { type: "casa" } }];
    const m = monthlyMatrix(rows, team, { year: 2026 });
    expect(m.lines).toHaveLength(1);
  });
});

describe("advisorPerformance", () => {
  it("compara el ritmo de ventas de cada asesor contra el promedio del equipo", () => {
    const team = [{ id: "a1", name: "Ana" }, { id: "a2", name: "Beto" }];
    const rows = [
      { advisorId: "a1", diasCierre: 10, price: 1000000, profit: null },
      { advisorId: "a1", diasCierre: 20, price: 2000000, profit: null },
    ];
    const perf = advisorPerformance(rows, team, { year: 2026 }, new Date("2026-02-01"));
    const ana = perf.find((p) => p.id === "a1");
    const beto = perf.find((p) => p.id === "a2");
    expect(ana.sales).toBe(2);
    expect(ana.avgDays).toBe(15);
    expect(beto.sales).toBe(0);
    expect(ana.vsTeam).toBeGreaterThan(0);
  });

  it("deja commission en null cuando el asesor no cobró nada en el periodo, no en cero", () => {
    const team = [{ id: "a1", name: "Ana" }];
    const perf = advisorPerformance([], team, { year: 2026 }, new Date("2026-02-01"));
    expect(perf[0].commission).toBeNull();
  });
});

describe("profitSummary", () => {
  it("separa ventas liquidadas de pendientes y solo suma utilidad de las liquidadas", () => {
    const rows = [
      { price: 1000000, profit: { utilidadOficina: 100000, utilidadNeta: 90000, totalComisiones: 50000 } },
      { price: 2000000, profit: null },
    ];
    const s = profitSummary(rows);
    expect(s.sold).toBe(2);
    expect(s.liquidated).toBe(1);
    expect(s.pending).toBe(1);
    expect(s.utilidadNeta).toBe(90000);
    expect(s.volume).toBe(3000000);
  });
});

describe("currentInventory / pendingSales", () => {
  const properties = [
    { id: "p1", status: "disponible", active: true, created_at: "2026-01-01T00:00:00Z", type: "casa" },
    { id: "p2", status: "vendida", active: true, created_at: "2026-01-01T00:00:00Z", type: "casa" },
  ];

  it("currentInventory excluye propiedades vendidas o inactivas", () => {
    const inv = currentInventory(properties, [], {}, new Date("2026-03-01"));
    expect(inv).toHaveLength(1);
    expect(inv[0].property.id).toBe("p1");
    expect(inv[0].days).toBeGreaterThan(0);
  });

  it("pendingSales encuentra propiedades 'vendida' sin registro en la tabla de ventas", () => {
    expect(pendingSales(properties, [])).toHaveLength(1);
    expect(pendingSales(properties, [{ property_id: "p2" }])).toHaveLength(0);
  });
});

describe("inventorySeries / availableYears", () => {
  it("inventorySeries cuenta altas y ventas por mes del año", () => {
    const properties = [{ created_at: "2026-02-01T00:00:00Z", type: "casa" }];
    const rows = [{ month: 2, year: 2026 }];
    const series = inventorySeries(properties, rows, { year: 2026 });
    expect(series[1].altas).toBe(1);
    expect(series[2].ventas).toBe(1);
  });

  it("availableYears incluye el año actual aunque no tenga datos", () => {
    const now = new Date("2026-05-01");
    expect(availableYears([], [], now)).toContain(2026);
  });
});
