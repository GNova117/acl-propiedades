import { describe, expect, it } from "vitest";
import { groupPlan, planAssignments, unassignedOpen } from "./assignAdvisor";

const NOW = new Date("2026-11-17T12:00:00Z");
const day = (n) => new Date(NOW - n * 86400000).toISOString();
const advisors = [
  { id: "a1", name: "Ana", active: true },
  { id: "a2", name: "Beto", active: true },
  { id: "a3", name: "Carla", active: false },
];
const prospect = (id, extra = {}) => ({ id, stage: "nuevo", advisor_id: null, property_id: null, created_at: day(1), ...extra });

describe("unassignedOpen", () => {
  it("abiertos y sin asesor, o con uno que ya no está activo; no los cerrados ni perdidos", () => {
    const list = [
      prospect("sin"),
      prospect("inactivo", { advisor_id: "a3" }),
      prospect("desconocido", { advisor_id: "zzz" }),
      prospect("con", { advisor_id: "a1" }),
      prospect("cerrado", { stage: "cerrado" }),
      prospect("perdido", { stage: "perdido" }),
    ];
    expect(unassignedOpen(list, advisors).map((p) => p.id)).toEqual(["sin", "inactivo", "desconocido"]);
  });
});

describe("planAssignments", () => {
  it("le toca al que menos prospectos abiertos tiene, y cada asignación cuenta para la siguiente", () => {
    const list = [
      prospect("x1", { advisor_id: "a1" }),
      prospect("x2", { advisor_id: "a1" }),
      prospect("n1", { created_at: day(5) }),
      prospect("n2", { created_at: day(4) }),
      prospect("n3", { created_at: day(3) }),
      prospect("n4", { created_at: day(2) }),
    ];
    const plan = planAssignments(list, { advisors, now: NOW });
    // Ana ya tiene 2, Beto 0: Beto recibe los dos primeros hasta empatar; luego se alternan.
    expect(plan.map((e) => `${e.prospect.id}→${e.advisor.name}`)).toEqual(["n1→Beto", "n2→Beto", "n3→Ana", "n4→Beto"]);
    expect(plan.every((e) => e.reason === "load")).toBe(true);
  });

  it("nunca asigna a un asesor inactivo", () => {
    const plan = planAssignments([prospect("n1"), prospect("n2")], { advisors, now: NOW });
    expect(plan.map((e) => e.advisor.id)).not.toContain("a3");
  });

  it("si viene de una propiedad con asesores activos, se reparte entre ellos aunque otro tenga menos carga", () => {
    const list = [prospect("p1", { property_id: "prop-1" }), prospect("busy", { advisor_id: "a1" })];
    const properties = [{ id: "prop-1", advisor_ids: ["a1", "a3"] }]; // Ana (activa) y Carla (inactiva)
    const [entry] = planAssignments(list, { advisors, properties, now: NOW });
    expect(entry.advisor.id).toBe("a1");
    expect(entry.reason).toBe("property");
  });

  it("una propiedad sin asesores activos cae en el reparto por carga", () => {
    const [entry] = planAssignments([prospect("p1", { property_id: "prop-1" })], { advisors, properties: [{ id: "prop-1", advisor_ids: ["a3"] }], now: NOW });
    expect(entry.reason).toBe("load");
    expect(entry.advisor.id).toBe("a1");
  });

  it("en empate de carga gana quien menos recibió esta semana, y luego el nombre", () => {
    const list = [
      prospect("viejo-a1", { advisor_id: "a1", stage: "cerrado", created_at: day(1) }), // reciente pero cerrado: no suma carga, sí «reciente»
      prospect("n1"),
    ];
    const [entry] = planAssignments(list, { advisors, now: NOW });
    expect(entry.advisor.id).toBe("a2");
    // Sin nada que los distinga, por nombre.
    expect(planAssignments([prospect("n1")], { advisors, now: NOW })[0].advisor.id).toBe("a1");
  });

  it("sin asesores activos o sin prospectos no hay plan", () => {
    expect(planAssignments([prospect("n1")], { advisors: [{ id: "x", name: "X", active: false }], now: NOW })).toEqual([]);
    expect(planAssignments([], { advisors, now: NOW })).toEqual([]);
  });

  it("es determinista: el mismo plan una y otra vez", () => {
    const list = Array.from({ length: 8 }, (_, i) => prospect(`n${i}`, { created_at: day(10 - i) }));
    const a = planAssignments(list, { advisors, now: NOW }).map((e) => e.advisor.id);
    const b = planAssignments([...list].reverse(), { advisors, now: NOW }).map((e) => e.advisor.id);
    expect(a).toEqual(b);
  });
});

describe("groupPlan", () => {
  it("agrupa por asesor para aplicar en lote", () => {
    const plan = planAssignments([prospect("n1", { created_at: day(3) }), prospect("n2", { created_at: day(2) }), prospect("n3", { created_at: day(1) })], { advisors, now: NOW });
    const groups = groupPlan(plan);
    expect(groups.map((g) => [g.advisor.name, g.prospects.map((p) => p.id)])).toEqual([
      ["Ana", ["n1", "n3"]],
      ["Beto", ["n2"]],
    ]);
  });
});
