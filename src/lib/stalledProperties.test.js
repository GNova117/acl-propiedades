import { describe, expect, it } from "vitest";
import { buildActivityIndex, stalledInfo } from "./stalledProperties";

const now = new Date("2026-11-17T12:00:00");
const daysAgo = (n) => new Date(now.getTime() - n * 86400000).toISOString();
const prop = (extra = {}) => ({ id: "p1", status: "disponible", active: true, created_at: daysAgo(100), updated_at: daysAgo(100), ...extra });

describe("stalledInfo", () => {
  it("sin ningún movimiento reciente está estancada y dice cuántos días", () => {
    expect(stalledInfo(prop(), new Map(), { now })).toEqual({ stalled: true, daysIdle: 100 });
  });

  it("un cambio reciente en la ficha cuenta como movimiento", () => {
    expect(stalledInfo(prop({ updated_at: daysAgo(5) }), new Map(), { now })).toEqual({ stalled: false, daysIdle: 5 });
  });

  it("una visita, una cita o un prospecto nuevo cuentan; las citas canceladas no", () => {
    const index = buildActivityIndex({
      visits: [{ property_id: "p1", visited_at: daysAgo(10) }],
      citas: [
        { property_id: "p1", fecha: daysAgo(2).slice(0, 10), status: "cancelada" },
        { property_id: "otra", fecha: daysAgo(1).slice(0, 10), status: "confirmada" },
      ],
      prospects: [{ property_id: "p1", created_at: daysAgo(40) }],
    });
    expect(stalledInfo(prop(), index, { now })).toEqual({ stalled: false, daysIdle: 10 });
    const sinVisita = buildActivityIndex({ prospects: [{ property_id: "p1", created_at: daysAgo(40) }] });
    expect(stalledInfo(prop(), sinVisita, { now })).toEqual({ stalled: true, daysIdle: 40 });
  });

  it("el umbral es configurable y una cita futura no da días negativos", () => {
    const index = buildActivityIndex({ citas: [{ property_id: "p1", fecha: "2026-11-25", status: "confirmada" }] });
    expect(stalledInfo(prop(), index, { now }).daysIdle).toBe(0);
    expect(stalledInfo(prop({ updated_at: daysAgo(20) }), new Map(), { now, days: 14 }).stalled).toBe(true);
    expect(stalledInfo(prop({ updated_at: daysAgo(20) }), new Map(), { now, days: 30 }).stalled).toBe(false);
  });

  it("solo aplica a propiedades disponibles y activas", () => {
    expect(stalledInfo(prop({ status: "vendida" }), new Map(), { now })).toBeNull();
    expect(stalledInfo(prop({ status: "apartada" }), new Map(), { now })).toBeNull();
    expect(stalledInfo(prop({ active: false }), new Map(), { now })).toBeNull();
    expect(stalledInfo(prop({ created_at: null, updated_at: null }), new Map(), { now })).toBeNull();
  });
});
