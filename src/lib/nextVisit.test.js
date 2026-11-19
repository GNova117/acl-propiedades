import { describe, expect, it } from "vitest";
import { indexNextSlots, nextVisitTag } from "./nextVisit";

// 2026-11-17 10:00 en México (UTC-6).
const NOW = new Date("2026-11-17T16:00:00Z");

describe("nextVisitTag", () => {
  it("hoy y mañana", () => {
    expect(nextVisitTag({ fecha: "2026-11-17" }, NOW)).toEqual({ kind: "today" });
    expect(nextVisitTag({ fecha: "2026-11-18" }, NOW)).toEqual({ kind: "tomorrow" });
  });
  it("de 2 a 3 días dice el día de la semana", () => {
    expect(nextVisitTag({ fecha: "2026-11-19" }, NOW)).toEqual({ kind: "weekday", weekday: 4 }); // jueves
    expect(nextVisitTag({ fecha: "2026-11-20" }, NOW)).toEqual({ kind: "weekday", weekday: 5 }); // viernes
  });
  it("más lejos, en el pasado o sin horario no hay etiqueta", () => {
    expect(nextVisitTag({ fecha: "2026-11-21" }, NOW)).toBeNull();
    expect(nextVisitTag({ fecha: "2026-11-16" }, NOW)).toBeNull();
    expect(nextVisitTag(null, NOW)).toBeNull();
    expect(nextVisitTag({ fecha: "mañana" }, NOW)).toBeNull();
  });
  it("usa la fecha de México, no la del navegador", () => {
    // 02:00 UTC del 18 sigue siendo el 17 por la noche en México.
    expect(nextVisitTag({ fecha: "2026-11-17" }, new Date("2026-11-18T02:00:00Z"))).toEqual({ kind: "today" });
  });
});

describe("indexNextSlots", () => {
  it("indexa por propiedad y se queda con el primero", () => {
    const map = indexNextSlots([
      { property_id: "a", fecha: "2026-11-18", hora: "10:00" },
      { property_id: "a", fecha: "2026-11-19", hora: "10:00" },
      { property_id: "b", fecha: "2026-11-18", hora: "12:00" },
      { fecha: "x" },
    ]);
    expect(Object.keys(map)).toEqual(["a", "b"]);
    expect(map.a.fecha).toBe("2026-11-18");
  });
  it("tolera lo que no es lista", () => {
    expect(indexNextSlots(null)).toEqual({});
    expect(indexNextSlots({})).toEqual({});
  });
});
