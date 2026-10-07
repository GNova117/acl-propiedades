import { describe, expect, it } from "vitest";
import {
  advisorVisitStats,
  inMonth,
  isReportSent,
  monthOptions,
  monthPayload,
  monthValue,
  parseMonthValue,
  previousMonthValue,
  reportableProperties,
  setReportSent,
  topReasons,
} from "./visitMonthly";

describe("monthValue / parseMonthValue", () => {
  it("son inversas entre sí", () => {
    expect(monthValue(2026, 0)).toBe("2026-01");
    expect(parseMonthValue("2026-01")).toEqual({ year: 2026, month: 0 });
  });

  it("devuelve null para un valor que no tiene la forma 'YYYY-MM'", () => {
    expect(parseMonthValue("2026-13")).toBeNull();
    expect(parseMonthValue("basura")).toBeNull();
    expect(parseMonthValue(undefined)).toBeNull();
  });
});

describe("previousMonthValue / monthOptions", () => {
  it("previousMonthValue retrocede un mes, incluso cruzando de año", () => {
    expect(previousMonthValue(new Date(2026, 0, 15))).toBe("2025-12");
    expect(previousMonthValue(new Date(2026, 5, 15))).toBe("2026-05");
  });

  it("monthOptions da los últimos N meses empezando por el actual", () => {
    const opts = monthOptions(3, new Date(2026, 0, 15));
    expect(opts).toEqual(["2026-01", "2025-12", "2025-11"]);
  });
});

describe("inMonth", () => {
  it("compara solo año y mes, sin importar el día u hora", () => {
    expect(inMonth("2026-03-15T10:00:00", "2026-03")).toBe(true);
    expect(inMonth("2026-04-01T00:00:00", "2026-03")).toBe(false);
  });

  it("devuelve false sin reventar con fecha o mes vacíos/inválidos", () => {
    expect(inMonth(null, "2026-03")).toBe(false);
    expect(inMonth("2026-03-15", "basura")).toBe(false);
  });
});

describe("monthPayload", () => {
  it("se queda solo con las visitas del mes pedido, conservando el resto del payload", () => {
    const payload = {
      property: { id: "p1" },
      visits: [{ visited_at: "2026-03-10" }, { visited_at: "2026-04-10" }],
    };
    const filtered = monthPayload(payload, "2026-03");
    expect(filtered.property).toEqual({ id: "p1" });
    expect(filtered.visits).toHaveLength(1);
  });
});

describe("topReasons", () => {
  it("cuenta cada motivo una vez por visita, aunque se repita en la misma visita", () => {
    const visits = [{ reasons: ["precio", "precio", "ubicacion"] }, { reasons: ["precio"] }];
    const top = topReasons(visits);
    expect(top[0]).toEqual({ key: "precio", count: 2 });
    expect(top[1]).toEqual({ key: "ubicacion", count: 1 });
  });
});

describe("advisorVisitStats", () => {
  const visits = [
    { advisor_id: "a1", prospect_name: "Juan Pérez", property_id: "p1", interest: "interesado", visited_at: "2026-03-01" },
    { advisor_id: "a1", prospect_name: "juan perez", property_id: "p2", interest: "oferta_realizada", visited_at: "2026-03-05" },
    { advisor_id: "a1", prospect_name: "Ana", property_id: "p1", interest: "descartado", visited_at: "2026-04-01" },
    { advisor_id: "a2", prospect_name: "Beto", property_id: "p3", interest: "interesado", visited_at: "2026-03-10" },
  ];

  it("cuenta clientes distintos, no visitas: el mismo nombre (sin acentos/mayúsculas) que visita dos veces cuenta una vez", () => {
    const stats = advisorVisitStats(visits, "2026-03");
    const a1 = stats.find((s) => s.advisorId === "a1");
    expect(a1.visits).toBe(2);
    expect(a1.clients).toBe(1);
    expect(a1.properties).toBe(2);
  });

  it("filtra por mes cuando se pide, y da todo el historial cuando value es null", () => {
    expect(advisorVisitStats(visits, "2026-03").find((s) => s.advisorId === "a1").visits).toBe(2);
    expect(advisorVisitStats(visits, null).find((s) => s.advisorId === "a1").visits).toBe(3);
  });

  it("ordena de más a menos clientes atendidos", () => {
    const stats = advisorVisitStats(visits, null);
    expect(stats[0].advisorId).toBe("a1");
  });
});

describe("reportableProperties", () => {
  const properties = [
    { id: "p1", active: true, status: "disponible" },
    { id: "p2", active: true, status: "vendida" },
    { id: "p3", active: false, status: "disponible" },
  ];
  const visits = [{ property_id: "p2", visited_at: "2026-03-10" }];

  it("incluye las disponibles aunque no tengan visitas ese mes", () => {
    const list = reportableProperties(properties, [], "2026-03").map((p) => p.id);
    expect(list).toContain("p1");
  });

  it("incluye una ya no disponible si tuvo visitas ese mes, pero no una inactiva", () => {
    const list = reportableProperties(properties, visits, "2026-03").map((p) => p.id);
    expect(list).toContain("p2");
    expect(list).not.toContain("p3");
  });
});

describe("isReportSent / setReportSent sin almacenamiento disponible", () => {
  it("no revientan y se quedan del lado seguro (se asume que no se ha enviado)", () => {
    expect(isReportSent("2026-03", "p1")).toBe(false);
    expect(() => setReportSent("2026-03", "p1", true)).not.toThrow();
  });
});
