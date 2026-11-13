import { describe, expect, it } from "vitest";
import { buildMySales, rowsOfYear, salesYears, summarizeYear } from "./mySales";

const properties = [
  { id: "p1", title: "Casa A", price: 1000000 },
  { id: "p2", title: "Casa B", price: 2000000 },
  { id: "p3", title: "Casa C", price: 500000 },
  { id: "p4", title: "Casa D", price: 800000 },
];
const venta = (property_id, advisor_id, fecha_venta) => ({ id: `v-${property_id}`, property_id, advisor_id, fecha_venta });
const com = (property_id, advisor_id, role, amount, fecha_venta) => ({ property_id, advisor_id, role, amount, fecha_venta });

describe("buildMySales", () => {
  it("solo las ventas del asesor, con el precio vigente de la propiedad", () => {
    const rows = buildMySales({ ventas: [venta("p1", "a1", "2026-02-10"), venta("p2", "a2", "2026-03-01")], properties, advisorId: "a1" });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ propertyId: "p1", price: 1000000, sold: true, roles: [], commission: null });
  });

  it("la comisión publicada se junta con su venta; sin publicar queda en null (pendiente, no cero)", () => {
    const rows = buildMySales({
      ventas: [venta("p1", "a1", "2026-02-10"), venta("p2", "a1", "2026-03-01")],
      properties,
      commissions: [com("p1", "a1", "venta", 120000, "2026-02-10")],
      advisorId: "a1",
    });
    expect(rows.find((r) => r.propertyId === "p1")).toMatchObject({ sold: true, commission: 120000, roles: ["venta"] });
    expect(rows.find((r) => r.propertyId === "p2")).toMatchObject({ sold: true, commission: null });
  });

  it("quien captó y vendió la misma casa suma las dos comisiones, captación primero", () => {
    const [row] = buildMySales({
      ventas: [venta("p1", "a1", "2026-02-10")],
      properties,
      commissions: [com("p1", "a1", "venta", 50, "2026-02-10"), com("p1", "a1", "captacion", 300, "2026-02-10")],
      advisorId: "a1",
    });
    expect(row).toMatchObject({ commission: 350, roles: ["captacion", "venta"] });
  });

  it("si solo captó (vendió otra persona) sale su comisión, con la fecha de la publicación, y no cuenta como venta suya", () => {
    const rows = buildMySales({ ventas: [venta("p3", "a2", "2026-04-01")], properties, commissions: [com("p3", "a1", "captacion", 90000, "2026-04-01")], advisorId: "a1" });
    expect(rows).toEqual([{ propertyId: "p3", property: properties[2], fecha: "2026-04-01", price: 500000, sold: false, roles: ["captacion"], commission: 90000 }]);
  });

  it("no mezcla comisiones de otros asesores y ordena lo más reciente primero", () => {
    const rows = buildMySales({
      ventas: [venta("p1", "a1", "2026-02-10"), venta("p2", "a1", "2026-05-01")],
      properties,
      commissions: [com("p1", "a2", "venta", 999, "2026-02-10")],
      advisorId: "a1",
    });
    expect(rows.map((r) => r.propertyId)).toEqual(["p2", "p1"]);
    expect(rows.every((r) => r.commission === null)).toBe(true);
  });

  it("una propiedad que ya no está en la lista no truena (precio 0)", () => {
    const [row] = buildMySales({ ventas: [venta("borrada", "a1", "2026-01-05")], properties, advisorId: "a1" });
    expect(row).toMatchObject({ property: null, price: 0, sold: true });
  });
});

describe("summarizeYear / salesYears", () => {
  const rows = buildMySales({
    ventas: [venta("p1", "a1", "2026-02-10"), venta("p2", "a1", "2026-02-25"), venta("p4", "a1", "2025-12-30")],
    properties,
    commissions: [com("p1", "a1", "venta", 100, "2026-02-10"), com("p3", "a1", "captacion", 40, "2026-07-01"), com("p4", "a1", "venta", 70, "2025-12-30")],
    advisorId: "a1",
  });

  it("cuenta por año y por mes; las ventas sin comisión publicada quedan como pendientes", () => {
    const s = summarizeYear(rows, 2026);
    expect(s).toMatchObject({ year: 2026, count: 2, volume: 3000000, commission: 140, pending: 1 });
    expect(s.months[1]).toEqual({ count: 2, volume: 3000000, commission: 100 }); // febrero
    expect(s.months[6]).toEqual({ count: 0, volume: 0, commission: 40 }); // julio: solo captación
    expect(s.months[0]).toEqual({ count: 0, volume: 0, commission: 0 });
  });

  it("otro año no se mezcla", () => {
    expect(summarizeYear(rows, 2025)).toMatchObject({ count: 1, volume: 800000, commission: 70, pending: 0 });
    expect(rowsOfYear(rows, 2025).map((r) => r.propertyId)).toEqual(["p4"]);
  });

  it("los años salen del más reciente al más viejo y siempre incluyen el actual", () => {
    expect(salesYears(rows, new Date(2026, 10, 13))).toEqual([2026, 2025]);
    expect(salesYears([], new Date(2026, 10, 13))).toEqual([2026]);
    expect(salesYears(rows, new Date(2027, 0, 2))).toEqual([2027, 2026, 2025]);
  });
});
