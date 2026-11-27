import { describe, expect, it } from "vitest";
import { isDirty } from "./useUnsavedChanges";

describe("isDirty", () => {
  it("sin referencia todavía no hay cambios", () => {
    expect(isDirty(undefined, { a: 1 })).toBe(false);
  });
  it("igual a la referencia no hay cambios; distinto sí", () => {
    const base = JSON.stringify({ a: 1, b: ["x"] });
    expect(isDirty(base, { a: 1, b: ["x"] })).toBe(false);
    expect(isDirty(base, { a: 2, b: ["x"] })).toBe(true);
    expect(isDirty(base, { a: 1, b: [] })).toBe(true);
  });
});
