import { describe, expect, it } from "vitest";
import { dismissKey, isRecent, loadDismissed, newMatches, saveDismissed } from "./newMatches";

const now = new Date("2026-11-17T12:00:00Z");
const daysAgo = (n) => new Date(now.getTime() - n * 86400000).toISOString();
const property = (id, extra = {}) => ({ id, title: id, type: "casa", operation_type: "compra", status: "disponible", active: true, price: 1000000, zone: "Torreón - Centro", created_at: daysAgo(2), ...extra });
const prospect = (id, extra = {}) => ({ id, name: id, stage: "contactado", search_criteria: { type: "casa" }, ...extra });

describe("newMatches", () => {
  it("lista solo propiedades recientes que encajan con un prospecto abierto con criterios", () => {
    const result = newMatches(
      [prospect("a"), prospect("b", { search_criteria: {} }), prospect("c", { stage: "cerrado" })],
      [property("p1"), property("viejo", { created_at: daysAgo(30) }), property("depto", { type: "departamento" })],
      { now }
    );
    expect(result).toHaveLength(1);
    expect(result[0].prospect.id).toBe("a");
    expect(result[0].properties.map((p) => p.id)).toEqual(["p1"]);
  });

  it("no repite lo que ya se ocultó", () => {
    const dismissed = new Set([dismissKey("a", "p1")]);
    expect(newMatches([prospect("a")], [property("p1")], { now, dismissed })).toEqual([]);
    expect(newMatches([prospect("a")], [property("p1"), property("p2")], { now, dismissed })[0].properties.map((p) => p.id)).toEqual(["p2"]);
  });

  it("una propiedad sin fecha o con fecha futura lejana no cuenta como nueva", () => {
    expect(isRecent({}, now)).toBe(false);
    expect(isRecent({ created_at: "basura" }, now)).toBe(false);
    expect(isRecent({ created_at: new Date(now.getTime() + 10 * 86400000).toISOString() }, now)).toBe(false);
    expect(isRecent({ created_at: daysAgo(6) }, now)).toBe(true);
    expect(isRecent({ created_at: daysAgo(8) }, now)).toBe(false);
  });

  it("lo ocultado se guarda por asesor y tolera un almacenamiento roto", () => {
    const mem = new Map();
    const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
    saveDismissed("adv1", new Set(["a:p1"]), storage);
    expect([...loadDismissed("adv1", storage)]).toEqual(["a:p1"]);
    expect(loadDismissed("adv2", storage).size).toBe(0);
    expect(loadDismissed("x", { getItem: () => "{no json" }).size).toBe(0);
    expect(() => saveDismissed("x", new Set(["a"]), { setItem: () => { throw new Error("lleno"); } })).not.toThrow();
  });
});
