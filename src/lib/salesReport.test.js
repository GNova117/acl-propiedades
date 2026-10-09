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
} from "./salesReport.js";

describe("dateParts", () => {
  it("lee año/mes/día de un string YYYY-MM-DD sin pasar por Date (sin corrimiento de huso)", () => {
    expect(dateParts("2026-03-15")).toEqual({ year: 2026, month: 2, day: 15 }); // marzo = índice 2
  });

  it("acepta también un timestamp ISO completo, usando solo su fecha", () => {
    expect(dateParts("2026-12-01T23:00:00.000Z")).toEqual({ year: 2026, month: 11, day: 1 });
  });
});

describe("buildSaleRows", () => {
  const properties = [
    { id: "p1", price: 1000000, created_at: "2026-01-01T00:00:00.000Z", type: "casa" },
    { id: "p2", price: 500000, created_at: "2026-06-01T00:00:00.000Z", type: "departamento" },
    { id: "p3", price: 800000, created_at: "2026-05-01T00:00:00.000Z", type: "casa" }, // histórica
  ];
  const advisors = [{ id: "a1", name: "Ana" }, { id: "a2", name: "Beto" }];
  const ventas = [
    { id: "v1", property_id: "p1", advisor_id: "a1", fecha_venta: "2026-02-01" },
    { id: "v2", property_id: "p2", advisor_id: "a2", fecha_venta: "2026-07-01" },
    { id: "v3", property_id: "p3", advisor_id: "a1", fecha_venta: "2026-01-01" }, // antes del alta
    { id: "v4", property_id: "p-no-existe", advisor_id: "a1", fecha_venta: "2026-01-01" },
  ];
  const liquidaciones = [
    {
      property_id: "p1",
      captador_id: "a1",
      vendedor_id: "a1",
      tasa_comision_captacion: 40,
      tasa_comision_venta: 30,
      tasa_gastos_admin: 10,
      costo_total: 0,
      devolucion_vendedor: 0,
      inversion_servicios: 0,
    },
  ];

  it("reutiliza computeLiquidacion con el precio vivo de la propiedad para armar la utilidad", () => {
    const rows = buildSaleRows({ ventas, properties, advisors, liquidaciones });
    const row = rows.find((r) => r.propertyId === "p1");

    expect(row.profit.utilidadOficina).toBe(600000); // 1,000,000 * (1 - 40%)
    expect(row.profit.utilidadNeta).toBe(540000); // 600,000 * (1 - 10%)
    expect(row.profit.comisiones).toEqual([{ advisorId: "a1", amount: 400000 }]);
    expect(row.profit.totalComisiones).toBe(400000);
    expect(row.profit.advisorMismatch).toBe(false);
  });

  it("deja profit en null (no en 0) cuando la venta no tiene liquidación capturada", () => {
    const rows = buildSaleRows({ ventas, properties, advisors, liquidaciones });
    const row = rows.find((r) => r.propertyId === "p2");
    expect(row.profit).toBeNull();
    expect(row.advisorName).toBe("Beto");
  });

  it("marca advisorMismatch cuando el vendedor de la liquidación difiere del registrado en la venta", () => {
    const rows = buildSaleRows({
      ventas: [{ id: "v1", property_id: "p1", advisor_id: "a2", fecha_venta: "2026-02-01" }],
      properties,
      advisors,
      liquidaciones,
    });
    expect(rows[0].profit.advisorMismatch).toBe(true);
  });

  it("deja diasCierre en null cuando la venta es anterior al alta de la propiedad (casa histórica)", () => {
    const rows = buildSaleRows({ ventas, properties, advisors, liquidaciones });
    const row = rows.find((r) => r.propertyId === "p3");
    expect(row.diasCierre).toBeNull();
  });

  it("calcula diasCierre como días naturales entre el alta y la venta", () => {
    const rows = buildSaleRows({ ventas, properties, advisors, liquidaciones });
    const row = rows.find((r) => r.propertyId === "p1");
    expect(row.diasCierre).toBe(31); // 1 ene -> 1 feb
  });

  it("descarta ventas cuya propiedad ya no existe", () => {
    const rows = buildSaleRows({ ventas, properties, advisors, liquidaciones });
    expect(rows.some((r) => r.propertyId === "p-no-existe")).toBe(false);
  });

  it("suma los gastos de bitácora y la inversión de remodelación ligada antes de calcular la utilidad", () => {
    const rows = buildSaleRows({
      ventas: [{ id: "v1", property_id: "p1", advisor_id: "a1", fecha_venta: "2026-02-01" }],
      properties,
      advisors,
      liquidaciones,
      remodelProjects: [{ property_id: "p1", materials: [{ quantity: 2, unit_price_internal: 1000, unit_price_external: 1500 }] }],
      expenses: [{ property_id: "p1", monto: 5000 }],
    });
    // subtotal = 1,000,000 - remodelación(2,000) - gastos(5,000)
    expect(rows[0].profit.utilidadOficina).toBe((1000000 - 2000 - 5000) * 0.6);
  });

  it("ordena las filas de la venta más reciente a la más antigua", () => {
    const rows = buildSaleRows({ ventas, properties, advisors, liquidaciones });
    const fechas = rows.map((r) => r.fecha);
    expect(fechas).toEqual([...fechas].sort().reverse());
  });
});

describe("filterRows", () => {
  const rows = [
    { year: 2026, month: 0, property: { type: "casa" } },
    { year: 2026, month: 5, property: { type: "departamento" } },
    { year: 2025, month: 0, property: { type: "casa" } },
  ];

  it("filtra por año, y por mes/tipo solo si se piden", () => {
    expect(filterRows(rows, { year: 2026 })).toHaveLength(2);
    expect(filterRows(rows, { year: 2026, month: 5 })).toHaveLength(1);
    expect(filterRows(rows, { year: 2026, type: "casa" })).toHaveLength(1);
  });
});

describe("salesTeam", () => {
  it("incluye a los asesores activos/visibles, y a cualquiera con ventas aunque esté inactivo", () => {
    const advisors = [
      { id: "a1", name: "Ana", active: true, show_in_team: true },
      { id: "a2", name: "Beto", active: false, show_in_team: true }, // inactivo, sin ventas
      { id: "a3", name: "Caro", active: false, show_in_team: false }, // inactivo, pero vendió
    ];
    const rows = [{ advisorId: "a3" }];
    const team = salesTeam(advisors, rows);
    expect(team.map((a) => a.id).sort()).toEqual(["a1", "a3"]);
  });
});

describe("monthlyMatrix", () => {
  it("arma una matriz de 12 meses por asesor y agrega la fila 'sin asesor' solo si hay alguna venta ahí", () => {
    const team = [{ id: "a1", name: "Ana" }, { id: "a2", name: "Beto" }];
    const rows = [
      { year: 2026, month: 0, advisorId: "a1", property: { type: "casa" } },
      { year: 2026, month: 0, advisorId: "a1", property: { type: "casa" } },
      { year: 2026, month: 2, advisorId: null, property: { type: "casa" } },
    ];
    const matrix = monthlyMatrix(rows, team, { year: 2026 });

    const ana = matrix.lines.find((l) => l.id === "a1");
    expect(ana.months[0]).toBe(2);
    expect(ana.total).toBe(2);
    expect(matrix.lines.some((l) => l.id === null)).toBe(true); // hay una venta sin asesor
    expect(matrix.totals[0]).toBe(2);
    expect(matrix.totals[2]).toBe(1);
    expect(matrix.grandTotal).toBe(3);
  });

  it("no agrega la fila 'sin asesor' cuando todas las ventas tienen asesor", () => {
    const team = [{ id: "a1", name: "Ana" }];
    const rows = [{ year: 2026, month: 0, advisorId: "a1", property: { type: "casa" } }];
    const matrix = monthlyMatrix(rows, team, { year: 2026 });
    expect(matrix.lines.some((l) => l.id === null)).toBe(false);
  });
});

describe("monthsInPeriod", () => {
  const now = new Date("2026-09-15T00:00:00.000Z");

  it("regresa 1 cuando se pide un mes concreto", () => {
    expect(monthsInPeriod({ year: 2026, month: 3 }, now)).toBe(1);
  });

  it("regresa los meses ya transcurridos del año en curso (no 12)", () => {
    expect(monthsInPeriod({ year: 2026 }, now)).toBe(9); // enero..septiembre
  });

  it("regresa 12 para un año completo ya pasado", () => {
    expect(monthsInPeriod({ year: 2025 }, now)).toBe(12);
  });

  it("regresa 1 para un año futuro (evita dividir entre 12 sin haber transcurrido nada)", () => {
    expect(monthsInPeriod({ year: 2027 }, now)).toBe(1);
  });
});

describe("advisorPerformance", () => {
  const team = [{ id: "a1", name: "Ana" }, { id: "a2", name: "Beto" }];
  const periodRows = [
    { advisorId: "a1", price: 1000000, diasCierre: 10, profit: { comisiones: [{ advisorId: "a1", amount: 400000 }] } },
    { advisorId: "a1", price: 2000000, diasCierre: 20, profit: null },
    { advisorId: "a2", price: 1500000, diasCierre: 30, profit: { comisiones: [{ advisorId: "a2", amount: 300000 }] } },
  ];
  const period = { year: 2026, month: 1 };

  it("mide ventas por mes y las compara contra el promedio del equipo", () => {
    const perf = advisorPerformance(periodRows, team, period);
    const ana = perf.find((p) => p.id === "a1");
    const beto = perf.find((p) => p.id === "a2");

    // teamAvgPerMonth = 3 ventas / 1 mes / 2 asesores = 1.5
    expect(ana.sales).toBe(2);
    expect(ana.perMonth).toBe(2);
    expect(ana.vsTeam).toBeCloseTo(2 / 1.5 - 1, 6);
    expect(beto.sales).toBe(1);
    expect(beto.vsTeam).toBeCloseTo(1 / 1.5 - 1, 6);
  });

  it("calcula volumen, ticket promedio y días promedio ignorando los nulos", () => {
    const [ana] = advisorPerformance(periodRows, team, period);
    expect(ana.volume).toBe(3000000);
    expect(ana.avgTicket).toBe(1500000);
    expect(ana.avgDays).toBe(15); // promedio de 10 y 20
  });

  it("atribuye la comisión cobrada a quien la liquidación marca, no a quien quedó en el registro de venta", () => {
    const perf = advisorPerformance(periodRows, team, period);
    expect(perf.find((p) => p.id === "a1").commission).toBe(400000);
    expect(perf.find((p) => p.id === "a2").commission).toBe(300000);
  });

  it("deja la comisión en null (no en 0) para un asesor sin ninguna liquidación en el periodo", () => {
    const perf = advisorPerformance([], team, period);
    expect(perf.every((p) => p.commission === null)).toBe(true);
    expect(perf.every((p) => p.avgTicket === null)).toBe(true);
  });

  it("ordena por número de ventas descendente", () => {
    const perf = advisorPerformance(periodRows, team, period);
    expect(perf.map((p) => p.id)).toEqual(["a1", "a2"]);
  });
});

describe("profitSummary", () => {
  it("solo suma las ventas que ya tienen utilidad capturada, y cuenta el resto como pendiente", () => {
    const rows = [
      { price: 1000000, profit: { utilidadOficina: 600000, utilidadNeta: 540000, totalComisiones: 400000 } },
      { price: 2000000, profit: null },
      { price: 1500000, profit: { utilidadOficina: 450000, utilidadNeta: 405000, totalComisiones: 300000 } },
    ];
    const summary = profitSummary(rows);

    expect(summary.sold).toBe(3);
    expect(summary.liquidated).toBe(2);
    expect(summary.pending).toBe(1);
    expect(summary.volume).toBe(4500000);
    expect(summary.utilidadOficina).toBe(1050000);
    expect(summary.utilidadNeta).toBe(945000);
    expect(summary.comisiones).toBe(700000);
  });
});

describe("inventorySeries", () => {
  it("cuenta altas y ventas por mes del año, filtradas por tipo si se pide", () => {
    const properties = [
      { type: "casa", created_at: "2026-01-15T00:00:00.000Z" },
      { type: "departamento", created_at: "2026-01-20T00:00:00.000Z" },
      { type: "casa", created_at: "2025-01-15T00:00:00.000Z" }, // otro año
    ];
    const rows = [{ year: 2026, month: 0, property: { type: "casa" } }];
    const series = inventorySeries(properties, rows, { year: 2026, type: "casa" });

    expect(series[0]).toEqual({ month: 0, altas: 1, ventas: 1 });
    expect(series.reduce((sum, m) => sum + m.altas, 0)).toBe(1); // el departamento quedó fuera por el tipo
  });
});

describe("currentInventory", () => {
  it("excluye propiedades vendidas, inactivas, o ya con registro en ventas", () => {
    const properties = [
      { id: "p1", status: "disponible", active: true, created_at: "2026-01-01T00:00:00.000Z" },
      { id: "p2", status: "vendida", active: true, created_at: "2026-01-01T00:00:00.000Z" },
      { id: "p3", status: "disponible", active: false, created_at: "2026-01-01T00:00:00.000Z" },
      { id: "p4", status: "disponible", active: true, created_at: "2026-01-01T00:00:00.000Z" }, // con venta registrada
    ];
    const ventas = [{ property_id: "p4" }];
    const inventory = currentInventory(properties, ventas, {}, new Date("2026-02-01T00:00:00.000Z"));
    expect(inventory.map((i) => i.property.id)).toEqual(["p1"]);
    expect(inventory[0].days).toBe(31);
  });

  it("deja days en null cuando no hay fecha de alta real", () => {
    const properties = [{ id: "p1", status: "disponible", active: true, created_at: null }];
    const inventory = currentInventory(properties, []);
    expect(inventory[0].days).toBeNull();
  });
});

describe("pendingSales", () => {
  it("regresa las propiedades marcadas vendida que aún no tienen venta registrada", () => {
    const properties = [
      { id: "p1", status: "vendida" },
      { id: "p2", status: "vendida" },
      { id: "p3", status: "disponible" },
    ];
    const ventas = [{ property_id: "p1" }];
    expect(pendingSales(properties, ventas).map((p) => p.id)).toEqual(["p2"]);
  });
});

describe("availableYears", () => {
  it("junta los años de ventas y altas, más el año en curso, de más reciente a más antiguo", () => {
    const properties = [{ created_at: "2024-01-01T00:00:00.000Z" }];
    const ventas = [{ fecha_venta: "2025-06-01" }];
    const years = availableYears(properties, ventas, new Date("2026-01-01T00:00:00.000Z"));
    expect(years).toEqual([2026, 2025, 2024]);
  });

  it("incluye el año actual aunque no haya ventas ni altas registradas", () => {
    const years = availableYears([], [], new Date("2026-05-01T00:00:00.000Z"));
    expect(years).toContain(2026);
  });
});
