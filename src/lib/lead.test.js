import { describe, expect, it } from "vitest";
import { isValidPhone } from "./lead";

describe("isValidPhone", () => {
  it("exige al menos 10 dígitos, sin importar espacios o guiones", () => {
    expect(isValidPhone("871-487-1494")).toBe(true);
    expect(isValidPhone("871 487 1494")).toBe(true);
  });

  it("rechaza menos de 10 dígitos o un valor vacío", () => {
    expect(isValidPhone("12345")).toBe(false);
    expect(isValidPhone("")).toBe(false);
    expect(isValidPhone(null)).toBe(false);
  });
});
