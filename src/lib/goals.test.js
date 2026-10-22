import { describe, expect, it } from "vitest";
import { countMonth, formToGoalColumns, goalProgress, goalsToForm, inMonth, validateGoals } from "./goals";

// 10 de octubre de 2026 al mediodía, hora local (31 días en el mes).
const now = new Date(2026, 9, 10, 12, 0, 0);

describe("inMonth", () => {
  it("compara por mes local, también con fechas sueltas", () => {
    expect(inMonth("2026-10-05", now)).toBe(true);
    expect(inMonth("2026-09-30", now)).toBe(false);
    expect(inMonth(new Date(2026, 9, 1, 0, 30).toISOString(), now)).toBe(true);
    expect(inMonth(new Date(2026, 8, 30, 23, 30).toISOString(), now)).toBe(false);
    expect(inMonth("2025-10-05", now)).toBe(false);
    expect(inMonth(null, now)).toBe(false);
    expect(inMonth("basura", now)).toBe(false);
  });
});

describe("goalsToForm / formToGoalColumns / validateGoals", () => {
  it("ida y vuelta; 0 o vacío es 'sin meta'", () => {
    expect(goalsToForm({ contacts: 40, visits: 0, new_prospects: 12, sales: null })).toEqual({ contacts: "40", visits: "", newProspects: "12", sales: "" });
    expect(goalsToForm(null)).toEqual({ contacts: "", visits: "", newProspects: "", sales: "" });
    expect(formToGoalColumns({ contacts: "40", visits: "", newProspects: "12", sales: "2" })).toEqual({ contacts: 40, visits: 0, new_prospects: 12, sales: 2 });
  });
  it("acota lo que no tiene sentido al guardar", () => {
    expect(formToGoalColumns({ contacts: "-5", visits: "abc", newProspects: "3.9", sales: "999999" })).toEqual({ contacts: 0, visits: 0, new_prospects: 3, sales: 9999 });
  });
  it("valida enteros de 0 a 9999 y deja pasar los vacíos", () => {
    expect(validateGoals({ contacts: "", visits: "10", newProspects: "", sales: "" })).toEqual({});
    expect(validateGoals({ contacts: "-1", visits: "2.5", newProspects: "abc", sales: "10000" })).toEqual({
      contacts: "goals.errors.number",
      visits: "goals.errors.number",
      newProspects: "goals.errors.number",
      sales: "goals.errors.number",
    });
  });
});

describe("countMonth", () => {
  it("cuenta solo lo del asesor y de este mes", () => {
    const counts = countMonth(
      {
        contacts: 7,
        visits: [
          { advisor_id: "a1", visited_at: new Date(2026, 9, 3, 10).toISOString() },
          { advisor_id: "a2", visited_at: new Date(2026, 9, 3, 10).toISOString() },
          { advisor_id: "a1", visited_at: new Date(2026, 8, 20, 10).toISOString() },
        ],
        prospects: [
          { advisor_id: "a1", created_at: new Date(2026, 9, 2).toISOString() },
          { advisor_id: "a1", created_at: new Date(2026, 7, 2).toISOString() },
        ],
        ventas: [{ advisor_id: "a1", fecha_venta: "2026-10-08" }, { advisor_id: "a1", fecha_venta: "2026-09-08" }],
      },
      "a1",
      now
    );
    expect(counts).toEqual({ contacts: 7, visits: 1, newProspects: 1, sales: 1 });
  });
});

describe("goalProgress", () => {
  const goals = { contacts: 31, visits: 0, new_prospects: 10, sales: 2 };

  it("solo salen las métricas con meta y que el rol puede medir", () => {
    expect(goalProgress(goals, {}, now).map((g) => g.key)).toEqual(["contacts", "newProspects", "sales"]);
    expect(goalProgress(goals, {}, now, { metrics: ["contacts", "visits"] }).map((g) => g.key)).toEqual(["contacts"]);
  });

  it("calcula porcentaje, lo que falta y cuántos al día (contando hoy)", () => {
    // Día 10 de 31: quedan 22 días contando hoy. Faltan 21 contactos → 1 al día.
    const [contacts] = goalProgress(goals, { contacts: 10 }, now);
    expect(contacts).toMatchObject({ target: 31, actual: 10, remaining: 21, pct: 32, perDay: 1 });
    const [, prospects] = goalProgress(goals, { newProspects: 1 }, now);
    expect(prospects).toMatchObject({ remaining: 9, perDay: 1 });
  });

  it("el estado compara contra el ritmo del mes", () => {
    // Meta 31 en 31 días → tocaría 10 al día 10.
    const status = (actual) => goalProgress({ contacts: 31 }, { contacts: actual }, now)[0].status;
    expect(status(31)).toBe("done");
    expect(status(40)).toBe("done");
    expect(status(10)).toBe("ahead");
    expect(status(8)).toBe("onTrack");
    expect(status(3)).toBe("behind");
  });

  it("cumplida: nada falta y el porcentaje no pasa de 100", () => {
    const [g] = goalProgress({ contacts: 10 }, { contacts: 15 }, now);
    expect(g).toMatchObject({ remaining: 0, perDay: 0, pct: 100, status: "done" });
  });

  it("sin meta ninguna no hay nada que mostrar", () => {
    expect(goalProgress(null, {}, now)).toEqual([]);
  });
});
