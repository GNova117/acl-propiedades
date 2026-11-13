import { beforeEach, describe, expect, it } from "vitest";
import { eventKey, freshEvents, markSeen, matchAlerts, prospectKey, pruneSeen, readSeen } from "./matchAlerts";

// localStorage de mentira (el entorno de pruebas es node).
const backing = new Map();
globalThis.localStorage = {
  getItem: (k) => (backing.has(k) ? backing.get(k) : null),
  setItem: (k, v) => backing.set(k, String(v)),
  removeItem: (k) => backing.delete(k),
  clear: () => backing.clear(),
};

const NOW = new Date("2026-11-13T15:00:00Z").getTime();
const daysAgo = (n) => new Date(NOW - n * 86400000).toISOString();

const house = (over = {}) => ({ id: "h1", title: "Casa Lerdo", type: "casa", operation_type: "compra", zone: "Lerdo", price: 1500000, status: "disponible", active: true, created_at: daysAgo(30), ...over });
const prospect = (over = {}) => ({ id: "p1", name: "Ana", stage: "interesado", advisor_id: "a1", search_criteria: { type: "casa", zone: "Lerdo", max_price: 1800000 }, ...over });

describe("freshEvents", () => {
  it("una propiedad dada de alta esta semana es «nueva»; una vieja no cuenta", () => {
    const events = freshEvents([house({ id: "nueva", created_at: daysAgo(2) }), house({ id: "vieja", created_at: daysAgo(20) })], NOW);
    expect(events.map((e) => [e.property.id, e.kind])).toEqual([["nueva", "new"]]);
  });

  it("una rebaja reciente cuenta aunque la propiedad sea vieja, con el porcentaje", () => {
    const [event] = freshEvents([house({ price: 900000, previous_price: 1000000, price_changed_at: daysAgo(1) })], NOW);
    expect(event).toMatchObject({ kind: "priceDrop", percent: 10, previousPrice: 1000000, at: daysAgo(1) });
  });

  it("una rebaja de hace más de una semana ya no es novedad", () => {
    expect(freshEvents([house({ price: 900000, previous_price: 1000000, price_changed_at: daysAgo(10) })], NOW)).toEqual([]);
  });

  it("si es nueva y además bajó de precio, cuenta como rebaja (una sola vez)", () => {
    const events = freshEvents([house({ created_at: daysAgo(3), price: 900000, previous_price: 1000000, price_changed_at: daysAgo(1) })], NOW);
    expect(events.map((e) => e.kind)).toEqual(["priceDrop"]);
  });

  it("un aumento de precio no es novedad; vendidas, apartadas e inactivas tampoco", () => {
    expect(freshEvents([house({ price: 1100000, previous_price: null, price_changed_at: daysAgo(1) })], NOW)).toEqual([]);
    const fresh = { created_at: daysAgo(1) };
    expect(freshEvents([house({ ...fresh, status: "vendida" }), house({ ...fresh, status: "apartada" }), house({ ...fresh, active: false })], NOW)).toEqual([]);
  });
});

describe("matchAlerts", () => {
  const nueva = house({ id: "nueva", created_at: daysAgo(1) });

  it("junta cada novedad con los prospectos a los que les encaja", () => {
    const alerts = matchAlerts({ properties: [nueva], prospects: [prospect(), prospect({ id: "p2", name: "Luis", search_criteria: { type: "departamento" } })], now: NOW });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ kind: "new", key: eventKey({ property: nueva, kind: "new", at: nueva.created_at }) });
    expect(alerts[0].prospects.map((p) => p.id)).toEqual(["p1"]);
  });

  it("sin prospectos que encajen (o sin «qué busca») no hay aviso", () => {
    expect(matchAlerts({ properties: [nueva], prospects: [prospect({ search_criteria: {} }), prospect({ id: "p3", stage: "cerrado" })], now: NOW })).toEqual([]);
    expect(matchAlerts({ properties: [nueva], prospects: [], now: NOW })).toEqual([]);
  });

  it("no avisa de la propiedad por la que el prospecto ya preguntó", () => {
    expect(matchAlerts({ properties: [nueva], prospects: [prospect({ property_id: "nueva" })], now: NOW })).toEqual([]);
  });

  it("lo más reciente primero", () => {
    const a = house({ id: "a", created_at: daysAgo(4) });
    const b = house({ id: "b", created_at: daysAgo(1) });
    expect(matchAlerts({ properties: [a, b], prospects: [prospect()], now: NOW }).map((x) => x.property.id)).toEqual(["b", "a"]);
  });

  it("respeta lo ya revisado: la novedad completa o un prospecto concreto", () => {
    const [alert] = matchAlerts({ properties: [nueva], prospects: [prospect(), prospect({ id: "p2", name: "Luis" })], now: NOW });
    const soloUno = matchAlerts({ properties: [nueva], prospects: [prospect(), prospect({ id: "p2", name: "Luis" })], now: NOW, seen: { [prospectKey(alert.key, "p1")]: NOW } });
    expect(soloUno[0].prospects.map((p) => p.id)).toEqual(["p2"]);
    expect(matchAlerts({ properties: [nueva], prospects: [prospect()], now: NOW, seen: { [alert.key]: NOW } })).toEqual([]);
    expect(matchAlerts({ properties: [nueva], prospects: [prospect()], now: NOW, seen: { [prospectKey(alert.key, "p1")]: NOW } })).toEqual([]);
  });

  it("una rebaja nueva de la misma propiedad vuelve a avisar aunque la anterior se haya revisado", () => {
    const first = house({ price: 900000, previous_price: 1000000, price_changed_at: daysAgo(3) });
    const [a1] = matchAlerts({ properties: [first], prospects: [prospect()], now: NOW });
    const second = { ...first, price: 800000, previous_price: 900000, price_changed_at: daysAgo(1) };
    expect(matchAlerts({ properties: [second], prospects: [prospect()], now: NOW, seen: { [a1.key]: NOW } })).toHaveLength(1);
  });
});

describe("lo ya revisado en el dispositivo", () => {
  beforeEach(() => localStorage.clear());

  it("se guarda por cuenta y se lee igual", () => {
    markSeen("Ana@acl.mx", ["k1", "k2"], NOW);
    expect(Object.keys(readSeen("ana@acl.mx", NOW)).sort()).toEqual(["k1", "k2"]);
    expect(readSeen("otra@acl.mx", NOW)).toEqual({});
  });

  it("olvida lo viejo (más de 30 días) y no truena con datos rotos", () => {
    expect(pruneSeen({ viejo: NOW - 40 * 86400000, reciente: NOW - 86400000 }, NOW)).toEqual({ reciente: NOW - 86400000 });
    localStorage.setItem("acl_match_seen:ana@acl.mx", "{no es json");
    expect(readSeen("ana@acl.mx", NOW)).toEqual({});
    localStorage.setItem("acl_match_seen:ana@acl.mx", "[1,2]");
    expect(readSeen("ana@acl.mx", NOW)).toEqual({});
  });
});
