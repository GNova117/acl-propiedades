import { describe, expect, it } from "vitest";
import { isOfficeOpen, officeClock } from "./officeHours";

// Torreón está en UTC-6 todo el año (sin horario de verano desde 2022).
const at = (iso) => new Date(iso);

describe("isOfficeOpen", () => {
  it("abierto el lunes a las 9:00 de Torreón", () => {
    expect(isOfficeOpen(at("2026-11-23T15:00:00Z"))).toBe(true); // lunes 9:00 hora centro
  });
  it("cerrado a la hora de comida (14:00–16:00)", () => {
    expect(isOfficeOpen(at("2026-11-23T21:00:00Z"))).toBe(false); // 15:00
  });
  it("abierto en el turno de la tarde y cerrado a las 18:00", () => {
    expect(isOfficeOpen(at("2026-11-23T22:30:00Z"))).toBe(true); // 16:30
    expect(isOfficeOpen(at("2026-11-24T00:00:00Z"))).toBe(false); // 18:00
  });
  it("cerrado en la noche y en fin de semana", () => {
    expect(isOfficeOpen(at("2026-11-23T05:00:00Z"))).toBe(false); // domingo 23:00 hora centro
    expect(isOfficeOpen(at("2026-11-28T16:00:00Z"))).toBe(false); // sábado 10:00
  });
  it("usa la hora de la oficina, no la del visitante", () => {
    expect(officeClock(at("2026-11-23T15:00:00Z"))).toEqual({ weekday: 1, minutes: 9 * 60 });
  });
});
