import { describe, expect, it } from "vitest";
import { buildMonthlyReport, change, monthKey, previousMonth } from "./monthlyReport";

describe("monthKey / previousMonth", () => {
  it("monthKey da el formato YYYY-MM con mes 0-11", () => {
    expect(monthKey(2026, 0)).toBe("2026-01");
  });

  it("previousMonth retrocede un mes, cruzando de año en enero", () => {
    expect(previousMonth(2026, 0)).toEqual({ year: 2025, month: 11 });
    expect(previousMonth(2026, 5)).toEqual({ year: 2026, month: 4 });
  });
});

describe("change", () => {
  it("calcula la diferencia y el % de cambio contra el mes anterior", () => {
    expect(change(15, 10)).toEqual({ diff: 5, pct: 50 });
  });

  it("el % es null si el mes anterior fue 0 (no se puede sacar porcentaje de cero)", () => {
    expect(change(5, 0)).toEqual({ diff: 5, pct: null });
  });

  it("devuelve null si falta cualquiera de los dos valores (el rol no tiene acceso a ese dato)", () => {
    expect(change(null, 10)).toBeNull();
    expect(change(5, null)).toBeNull();
  });
});

describe("buildMonthlyReport", () => {
  const data = {
    ventas: [{ property_id: "p1", fecha_venta: "2026-03-05", advisor_id: "a1" }],
    properties: [{ id: "p1", title: "Casa Centro", price: 1000000, created_at: "2026-03-01T00:00:00Z" }],
    advisors: [{ id: "a1", name: "Ana" }],
    visits: [
      { visited_at: "2026-03-10", interest: "interesado" },
      { visited_at: "2026-03-12", interest: "oferta_realizada" },
      { visited_at: "2026-02-10", interest: "interesado" },
    ],
    prospects: [{ id: "x1", created_at: "2026-03-01", source: "facebook" }],
    history: [],
    estimates: null,
    signings: null,
    messages: null,
    clients: null,
  };

  it("calcula las cifras planas del mes pedido y las compara contra el mes anterior", () => {
    const r = buildMonthlyReport({ year: 2026, month: 2, data }); // marzo = mes 2
    expect(r.key).toBe("2026-03");
    expect(r.previousKey).toBe("2026-02");
    expect(r.current.salesCount).toBe(1);
    expect(r.current.salesValue).toBe(1000000);
    expect(r.current.visits).toBe(2);
    expect(r.current.visitsInterested).toBe(2);
    expect(r.current.visitsOffers).toBe(1);
    expect(r.previous.visits).toBe(1);
  });

  it("una sección sin acceso de rol (arreglo null/ausente) queda en null, no en cero", () => {
    const r = buildMonthlyReport({ year: 2026, month: 2, data });
    expect(r.current.estimates).toBeNull();
    expect(r.current.signaturesSent).toBeNull();
    expect(r.current.messages).toBeNull();
    expect(r.estimatesByZone).toBeNull();
    expect(r.messagesByChannel).toBeNull();
  });

  it("arma el detalle de ventas del mes con el título de la propiedad y el nombre del asesor", () => {
    const r = buildMonthlyReport({ year: 2026, month: 2, data });
    expect(r.sales).toEqual([{ date: "2026-03-05", title: "Casa Centro", price: 1000000, advisor: "Ana" }]);
  });

  it("agrupa prospectos por fuente, con 'manual' por default", () => {
    const r = buildMonthlyReport({ year: 2026, month: 2, data });
    expect(r.prospectsBySource).toEqual([{ key: "facebook", total: 1 }]);
  });
});
