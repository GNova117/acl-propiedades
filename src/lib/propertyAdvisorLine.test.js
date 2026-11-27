import { describe, expect, it } from "vitest";
import { advisorNames, advisorSummary } from "./propertyAdvisorLine";

const advisors = [
  { id: "a1", name: "Ana López" },
  { id: "a2", name: "Beto Ruiz" },
];

describe("advisorNames", () => {
  it("devuelve los nombres en el orden asignado y descarta ids desconocidos", () => {
    expect(advisorNames(["a2", "x", "a1"], advisors)).toEqual(["Beto Ruiz", "Ana López"]);
  });
  it("sin datos devuelve lista vacía", () => {
    expect(advisorNames(undefined, advisors)).toEqual([]);
    expect(advisorNames(["a1"], undefined)).toEqual([]);
  });
});

describe("advisorSummary", () => {
  const more = (n) => `y ${n} más`;
  it("uno, varios y ninguno", () => {
    expect(advisorSummary(["Ana"], more)).toBe("Ana");
    expect(advisorSummary(["Ana", "Beto", "Cris"], more)).toBe("Ana y 2 más");
    expect(advisorSummary([], more)).toBe("");
  });
});
