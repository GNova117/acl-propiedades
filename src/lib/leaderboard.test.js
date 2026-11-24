import { describe, expect, it } from "vitest";
import { POINTS, computeLeaderboardRows, pointsOf, rankTeam } from "./leaderboard";

const now = new Date("2026-11-17T12:00:00");
const advisors = [
  { id: "a", name: "Ana", active: true },
  { id: "b", name: "Beto", active: true },
  { id: "c", name: "Inactiva", active: false },
];

describe("computeLeaderboardRows", () => {
  it("cuenta solo lo del mes y solo de asesores activos; los contactos van por el asesor del prospecto", () => {
    const rows = computeLeaderboardRows(
      {
        advisors,
        prospects: [
          { id: "p1", advisor_id: "a", created_at: "2026-11-02T10:00:00Z" },
          { id: "p2", advisor_id: "a", created_at: "2026-09-02T10:00:00Z" },
          { id: "p3", advisor_id: "b", created_at: "2026-11-05T10:00:00Z" },
        ],
        contacts: [{ prospecto_id: "p2", at: "2026-11-03T10:00:00Z" }, { prospecto_id: "p2", at: "2026-10-03T10:00:00Z" }, { prospecto_id: "p3", at: "2026-11-04T10:00:00Z" }],
        visits: [{ advisor_id: "a", visited_at: "2026-11-10T10:00:00Z" }, { advisor_id: "a", visited_at: "2026-10-10T10:00:00Z" }],
        ventas: [{ advisor_id: "b", fecha_venta: "2026-11-01" }, { advisor_id: "b", fecha_venta: "2026-10-31" }],
        goals: { a: { contacts: 1, visits: 5, new_prospects: 1, sales: 0 } },
      },
      now
    );
    expect(rows.map((r) => r.name)).toEqual(["Ana", "Beto"]);
    expect(rows[0]).toMatchObject({ contacts: 1, visits: 1, new_prospects: 1, sales: 0, goals_set: 3, goals_met: 2 });
    expect(rows[1]).toMatchObject({ contacts: 1, visits: 0, new_prospects: 1, sales: 1, goals_set: 0, goals_met: 0 });
  });
});

describe("rankTeam", () => {
  const row = (name, extra) => ({ advisor_id: name, name, contacts: 0, visits: 0, new_prospects: 0, sales: 0, goals_set: 0, goals_met: 0, ...extra });

  it("puntúa con la fórmula publicada", () => {
    expect(pointsOf(row("x", { contacts: 10, visits: 2, new_prospects: 3, sales: 1 }))).toBe(10 * POINTS.contacts + 2 * POINTS.visits + 3 * POINTS.new_prospects + POINTS.sales);
  });

  it("ordena por puntos, desempata por ventas y visitas, comparte lugar en empate total y da medallas solo con puntos", () => {
    const ranked = rankTeam([row("Cata", { contacts: 5 }), row("Ana", { contacts: 5 }), row("Beto", { sales: 1 }), row("Dani", { contacts: 1 }), row("Eli"), row("Fer", { contacts: 20, visits: 5 })]);
    // Fer 35 pts, Beto 20, Ana y Cata 5 (empate: comparten el 3.º), Dani 1, Eli 0.
    expect(ranked.map((r) => [r.name, r.rank, r.medal])).toEqual([
      ["Fer", 1, "gold"],
      ["Beto", 2, "silver"],
      ["Ana", 3, "bronze"],
      ["Cata", 3, "bronze"],
      ["Dani", 5, null],
      ["Eli", 6, null],
    ]);
  });

  it("marca a quien cumplió todas las metas que se puso (y a nadie sin metas)", () => {
    const ranked = rankTeam([row("Ana", { goals_set: 2, goals_met: 2 }), row("Beto", { goals_set: 2, goals_met: 1 }), row("Cata")]);
    expect(Object.fromEntries(ranked.map((r) => [r.name, r.allGoalsMet]))).toEqual({ Ana: true, Beto: false, Cata: false });
  });

  it("sin puntos nadie recibe medalla", () => {
    expect(rankTeam([row("Ana"), row("Beto")]).every((r) => r.medal === null)).toBe(true);
  });
});
