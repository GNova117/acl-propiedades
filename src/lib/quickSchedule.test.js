import { describe, expect, it } from "vitest";
import { QUICK_TIMES, nextSaturday, quickDates } from "./quickSchedule";

// Noviembre de 2026: el 12 es jueves, el 13 viernes, el 14 sábado, el 15 domingo.
const day = (d) => new Date(2026, 10, d, 9, 30);

describe("nextSaturday", () => {
  it("desde el jueves es el sábado de esa semana", () => {
    expect(nextSaturday(day(12))).toBe("2026-11-14");
  });

  it("desde el viernes salta al sábado de la semana siguiente (mañana ya es sábado y sería repetido)", () => {
    expect(nextSaturday(day(13))).toBe("2026-11-21");
  });

  it("desde el sábado es el de la semana siguiente", () => {
    expect(nextSaturday(day(14))).toBe("2026-11-21");
  });

  it("desde el domingo y el lunes es el sábado más próximo", () => {
    expect(nextSaturday(day(15))).toBe("2026-11-21");
    expect(nextSaturday(day(16))).toBe("2026-11-21");
  });

  it("siempre cae en sábado y a 2–8 días, también al cruzar de mes", () => {
    for (let d = 1; d <= 60; d++) {
      const now = new Date(2026, 10, d);
      const iso = nextSaturday(now);
      const date = new Date(`${iso}T00:00:00`);
      expect(date.getDay()).toBe(6);
      const diff = Math.round((date - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 864e5);
      expect(diff).toBeGreaterThanOrEqual(2);
      expect(diff).toBeLessThanOrEqual(8);
    }
  });
});

describe("quickDates", () => {
  it("trae hoy, mañana y el próximo sábado, distintos entre sí", () => {
    expect(quickDates(day(12))).toEqual([
      { key: "today", iso: "2026-11-12" },
      { key: "tomorrow", iso: "2026-11-13" },
      { key: "saturday", iso: "2026-11-14" },
    ]);
  });

  it("al cruzar de mes sigue bien (30 de noviembre → 1 de diciembre)", () => {
    const dates = quickDates(new Date(2026, 10, 30));
    expect(dates[1].iso).toBe("2026-12-01");
    expect(new Set(dates.map((d) => d.iso)).size).toBe(3);
  });
});

describe("QUICK_TIMES", () => {
  it("son horas válidas del campo hora, en orden", () => {
    for (const hora of QUICK_TIMES) expect(hora).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
    expect([...QUICK_TIMES].sort()).toEqual(QUICK_TIMES);
  });
});
