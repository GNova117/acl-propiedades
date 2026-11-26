import { describe, expect, it } from "vitest";
import { readingMinutes } from "./readingTime";

describe("readingMinutes", () => {
  it("nunca baja de 1 minuto", () => {
    expect(readingMinutes("")).toBe(1);
    expect(readingMinutes(null)).toBe(1);
    expect(readingMinutes("hola mundo")).toBe(1);
  });
  it("redondea hacia arriba a 200 palabras por minuto", () => {
    expect(readingMinutes("palabra ".repeat(200))).toBe(1);
    expect(readingMinutes("palabra ".repeat(201))).toBe(2);
    expect(readingMinutes("palabra ".repeat(1000))).toBe(5);
  });
});
