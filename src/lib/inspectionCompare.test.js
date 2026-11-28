import { describe, expect, it } from "vitest";
import { changeOf, compareInspections, sortByImportance, suggestPair } from "./inspectionCompare";

const insp = (entries) => ({ checklist: entries.map(([category, key, estado, photo]) => ({ category, key, estado, file_path: photo ? "p" : null, signed_url: photo || null })) });

describe("changeOf", () => {
  it("Sí→No empeoró, No→Sí mejoró, igual igual y lo demás cambió", () => {
    expect(changeOf("si", "no")).toBe("worse");
    expect(changeOf("no", "si")).toBe("better");
    expect(changeOf("si", "si")).toBe("same");
    expect(changeOf("na", "si")).toBe("changed");
    expect(changeOf("", "no")).toBe("changed");
  });
});

describe("compareInspections", () => {
  const before = insp([["servicios", "agua", "si", "u1"], ["servicios", "gas", "no"], ["estructura", "grietas", "si"]]);
  const after = insp([["servicios", "agua", "no", "u2"], ["servicios", "gas", "si"], ["estructura", "grietas", "si"]]);
  const { rows, summary } = compareInspections(before, after);
  const row = (cat, key) => rows.find((r) => r.category === cat && r.key === key);

  it("marca qué empeoró y qué mejoró, con las fotos de cada lado", () => {
    expect(row("servicios", "agua")).toMatchObject({ before: "si", after: "no", change: "worse", beforePhoto: "u1", afterPhoto: "u2" });
    expect(row("servicios", "gas").change).toBe("better");
    expect(row("estructura", "grietas").change).toBe("same");
  });
  it("cuenta por tipo de cambio (los criterios que ninguna respondió cuentan como iguales)", () => {
    expect(summary.worse).toBe(1);
    expect(summary.better).toBe(1);
    expect(summary.same).toBeGreaterThanOrEqual(1);
  });
  it("un criterio nuevo que solo trae una de las dos aparece como cambio", () => {
    const r = compareInspections(insp([["servicios", "agua", "si"]]), insp([["servicios", "agua", "si"], ["servicios", "drenaje", "no"]])).rows;
    expect(r.find((x) => x.key === "drenaje").change).toBe("changed");
  });
  it("las que empeoraron salen primero", () => {
    expect(sortByImportance(rows)[0].change).toBe("worse");
    expect(sortByImportance(rows).at(-1).change).toBe("same");
  });
});

describe("suggestPair", () => {
  const list = [
    { id: "a", property_id: "p1", visited_at: "2026-01-01" },
    { id: "b", property_id: "p1", visited_at: "2026-06-01" },
    { id: "c", property_id: "p1", visited_at: "2026-03-01" },
    { id: "d", property_id: "p2", visited_at: "2026-05-01" },
  ];
  it("sugiere las dos más recientes de la propiedad, la vieja primero", () => {
    expect(suggestPair(list, "p1").map((i) => i.id)).toEqual(["c", "b"]);
  });
  it("con menos de dos o sin propiedad no sugiere", () => {
    expect(suggestPair(list, "p2")).toBeNull();
    expect(suggestPair(list, "")).toBeNull();
  });
});
