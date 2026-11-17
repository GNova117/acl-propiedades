import { describe, expect, it } from "vitest";
import { hourRange, layoutDay, minutesOf, shiftIso, weekDays } from "./agendaWeek";

const cita = (id, hora, extra = {}) => ({ id, hora, titulo: id, ...extra });

describe("weekDays / shiftIso", () => {
  it("la semana va de lunes a domingo y contiene el día dado", () => {
    // 2026-11-17 es martes
    expect(weekDays("2026-11-17")).toEqual(["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22"]);
    expect(weekDays("2026-11-22")[0]).toBe("2026-11-16"); // domingo
    expect(weekDays("2026-11-16")[0]).toBe("2026-11-16"); // lunes
  });
  it("cruza meses y años", () => {
    expect(weekDays("2026-12-31")).toContain("2027-01-03");
    expect(shiftIso("2026-11-30", 1)).toBe("2026-12-01");
    expect(shiftIso("2026-01-01", -1)).toBe("2025-12-31");
    expect(shiftIso("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("hourRange", () => {
  it("por defecto 8 a 20 y se amplía para que quepa todo", () => {
    expect(hourRange([])).toEqual({ start: 8, end: 20 });
    expect(hourRange([cita("a", "07:30:00")])).toEqual({ start: 7, end: 20 });
    expect(hourRange([cita("a", "19:30:00", { duracion_min: 90 })])).toEqual({ start: 8, end: 21 });
    expect(hourRange([cita("a", null)])).toEqual({ start: 8, end: 20 });
    expect(hourRange([cita("a", "23:30:00", { duracion_min: 120 })]).end).toBe(24);
  });
});

describe("layoutDay", () => {
  it("una cita sola ocupa toda la columna; las de todo el día van aparte", () => {
    const { timed, allDay } = layoutDay([cita("a", "10:00:00"), cita("b", null)]);
    expect(timed).toHaveLength(1);
    expect(timed[0]).toMatchObject({ startMin: 600, endMin: 660, column: 0, columns: 1 });
    expect(allDay.map((c) => c.id)).toEqual(["b"]);
  });

  it("las que se traslapan quedan lado a lado y las que no, cada una completa", () => {
    const { timed } = layoutDay([cita("a", "10:00:00", { duracion_min: 90 }), cita("b", "10:30:00"), cita("c", "13:00:00"), cita("d", "11:00:00")]);
    const by = Object.fromEntries(timed.map((t) => [t.cita.id, t]));
    // a (10:00–11:30), b (10:30–11:30) y d (11:00–12:00) se traslapan entre sí: tres columnas.
    expect(by.a).toMatchObject({ column: 0, columns: 3 });
    expect(by.b).toMatchObject({ column: 1, columns: 3 });
    expect(by.d).toMatchObject({ column: 2, columns: 3 });
    expect(by.c).toMatchObject({ column: 0, columns: 1 });
  });

  it("citas pegadas (una termina cuando empieza la otra) no se traslapan", () => {
    const { timed } = layoutDay([cita("a", "10:00:00"), cita("b", "11:00:00")]);
    expect(timed.every((t) => t.columns === 1 && t.column === 0)).toBe(true);
  });

  it("minutesOf lee HH:MM y HH:MM:SS", () => {
    expect(minutesOf("09:05")).toBe(545);
    expect(minutesOf("09:05:00")).toBe(545);
  });
});
