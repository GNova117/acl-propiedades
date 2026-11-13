import { describe, expect, it } from "vitest";
import { absenceFor, absentAdvisorIds, absentUntil, cleanAbsences, nextDay, firstPresentAdvisor, upcomingAbsences, validateAbsence } from "./absences";

const off = (advisor_id, fecha_inicio, fecha_fin, motivo = null) => ({ advisor_id, fecha_inicio, fecha_fin, motivo });
const rows = [off("a1", "2026-11-20", "2026-11-23", "Vacaciones"), off("a1", "2026-11-24", "2026-11-27"), off("a2", "2026-11-10", "2026-11-12")];

describe("absenceFor / absentAdvisorIds", () => {
  it("los dos extremos cuentan", () => {
    expect(absenceFor(rows, "a1", "2026-11-20")?.motivo).toBe("Vacaciones");
    expect(absenceFor(rows, "a1", "2026-11-23")?.motivo).toBe("Vacaciones");
    expect(absenceFor(rows, "a1", "2026-11-19")).toBeNull();
    expect(absenceFor(rows, "a1", "2026-11-28")).toBeNull();
  });
  it("quién no está hoy", () => {
    expect([...absentAdvisorIds(rows, "2026-11-21")]).toEqual(["a1"]);
    expect([...absentAdvisorIds(rows, "2026-11-11")]).toEqual(["a2"]);
    expect(absentAdvisorIds(rows, "2026-12-01").size).toBe(0);
  });
});

describe("absentUntil", () => {
  it("junta ausencias seguidas", () => {
    expect(absentUntil(rows, "a1", "2026-11-21")).toBe("2026-11-27");
    expect(absentUntil(rows, "a1", "2026-11-25")).toBe("2026-11-27");
  });
  it("con un hueco de un día ya son dos ausencias; sin ausencia hoy es null", () => {
    expect(absentUntil([off("a1", "2026-11-20", "2026-11-22"), off("a1", "2026-11-24", "2026-11-27")], "a1", "2026-11-21")).toBe("2026-11-22");
    expect(absentUntil(rows, "a1", "2026-11-19")).toBeNull();
    expect(absentUntil(rows, "a3", "2026-11-21")).toBeNull();
  });
  it("cruza el fin de mes y de año", () => {
    expect(nextDay("2026-11-30")).toBe("2026-12-01");
    expect(nextDay("2026-12-31")).toBe("2027-01-01");
    expect(absentUntil([off("a1", "2026-12-28", "2026-12-31"), off("a1", "2027-01-01", "2027-01-03")], "a1", "2026-12-29")).toBe("2027-01-03");
  });
});

describe("upcomingAbsences", () => {
  it("quita las pasadas y ordena por inicio", () => {
    const list = upcomingAbsences([off("a1", "2026-12-01", "2026-12-05"), off("a1", "2026-11-01", "2026-11-05"), off("a1", "2026-11-14", "2026-11-14")], "2026-11-14");
    expect(list.map((r) => r.fecha_inicio)).toEqual(["2026-11-14", "2026-12-01"]);
  });
});

describe("validateAbsence", () => {
  it("pide las dos fechas, en orden y no pasadas", () => {
    expect(validateAbsence({ fecha_inicio: "", fecha_fin: "2026-11-20" }, "2026-11-14")).toEqual({ dates: "absences.errors.required" });
    expect(validateAbsence({ fecha_inicio: "2026-11-20", fecha_fin: "2026-11-19" }, "2026-11-14")).toEqual({ dates: "absences.errors.order" });
    expect(validateAbsence({ fecha_inicio: "2026-11-01", fecha_fin: "2026-11-10" }, "2026-11-14")).toEqual({ dates: "absences.errors.past" });
    expect(validateAbsence({ fecha_inicio: "2026-11-10", fecha_fin: "2026-11-14" }, "2026-11-14")).toEqual({});
    expect(validateAbsence({ fecha_inicio: "2026-11-14", fecha_fin: "2026-11-14" }, "2026-11-14")).toEqual({});
  });
});

describe("cleanAbsences", () => {
  it("descarta lo incompleto o al revés, recorta el motivo, quita repetidas y ordena", () => {
    expect(
      cleanAbsences([
        off("a1", "2026-12-01", "2026-12-03", "  Viaje  "),
        off("a1", "2026-12-01", "2026-12-03", "Viaje"),
        { fecha_inicio: "", fecha_fin: "2026-12-05" },
        off("a1", "2026-12-09", "2026-12-08"),
        off("a1", "2026-11-20", "2026-11-21", "   "),
        off("a1", "2026-12-10", "2026-12-11", "x".repeat(300)),
      ]).map((r) => [r.fecha_inicio, r.fecha_fin, r.motivo?.length ?? null]),
    ).toEqual([["2026-11-20", "2026-11-21", null], ["2026-12-01", "2026-12-03", 5], ["2026-12-10", "2026-12-11", 120]]);
  });
});

describe("firstPresentAdvisor", () => {
  const advisors = [{ id: "a1" }, { id: "a2" }, { id: "a3" }];
  it("el primero que no esté ausente", () => {
    expect(firstPresentAdvisor(advisors, new Set(["a1"])).id).toBe("a2");
    expect(firstPresentAdvisor(advisors, new Set()).id).toBe("a1");
  });
  it("si todos están ausentes se queda con el primero; sin asesores, null", () => {
    expect(firstPresentAdvisor(advisors, new Set(["a1", "a2", "a3"])).id).toBe("a1");
    expect(firstPresentAdvisor([], new Set())).toBeNull();
    expect(firstPresentAdvisor(undefined)).toBeNull();
  });
});
