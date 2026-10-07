import { describe, expect, it } from "vitest";
import { getActiveSeason, greetingYear, isSeasonActive, SEASONS } from "./seasons";

const season = (id) => SEASONS.find((s) => s.id === id);

describe("isSeasonActive", () => {
  it("un rango normal (que no cruza el fin de año) es activo dentro de sus fechas", () => {
    const sanValentin = season("san-valentin"); // 7–14 feb
    expect(isSeasonActive(sanValentin, new Date(2026, 1, 10))).toBe(true);
    expect(isSeasonActive(sanValentin, new Date(2026, 1, 6))).toBe(false);
    expect(isSeasonActive(sanValentin, new Date(2026, 1, 15))).toBe(false);
  });

  it("un rango que cruza el fin de año (31 dic – 6 ene) es activo en ambos lados", () => {
    const anioNuevo = season("anio-nuevo");
    expect(isSeasonActive(anioNuevo, new Date(2026, 11, 31))).toBe(true);
    expect(isSeasonActive(anioNuevo, new Date(2027, 0, 3))).toBe(true);
    expect(isSeasonActive(anioNuevo, new Date(2026, 6, 1))).toBe(false); // julio, nada que ver
  });
});

describe("greetingYear", () => {
  it("el 31 de diciembre ya felicita por el año que empieza", () => {
    expect(greetingYear(new Date(2026, 11, 31))).toBe(2027);
  });

  it("cualquier otro mes felicita por el año en curso", () => {
    expect(greetingYear(new Date(2026, 5, 15))).toBe(2026);
  });
});

describe("getActiveSeason (sin window, como en el servidor/pruebas)", () => {
  it("sin ninguna temporada vigente, devuelve null en vez de una por default", () => {
    expect(getActiveSeason(new Date(2026, 3, 15))).toBeNull(); // 15 de abril, ninguna plantilla cubre esa fecha
  });

  it("devuelve la plantilla cuya fecha sí aplica", () => {
    expect(getActiveSeason(new Date(2026, 1, 10))?.id).toBe("san-valentin");
  });
});
