import { describe, expect, it } from "vitest";
import {
  buildVisitReport,
  daysBetween,
  isInterested,
  isValidProspectPhone,
  parseDateOnly,
  percentages,
  whatsappNumber,
} from "./visitReport.js";

describe("percentages (método del mayor residuo)", () => {
  it("siempre suma exactamente 100, incluso con empates que redondearían a 99", () => {
    const result = percentages([1, 1, 1]);
    expect(result.reduce((a, b) => a + b, 0)).toBe(100);
    expect(result).toEqual([34, 33, 33]); // el primer índice se lleva el residuo mayor en empate
  });

  it("regresa ceros cuando el total es 0, sin dividir entre cero", () => {
    expect(percentages([0, 0])).toEqual([0, 0]);
  });

  it("reparte proporcionalmente con un solo valor dominante", () => {
    const result = percentages([9, 1]);
    expect(result).toEqual([90, 10]);
  });
});

describe("parseDateOnly / daysBetween", () => {
  it("interpreta una fecha YYYY-MM-DD como fecha local, no UTC", () => {
    const d = parseDateOnly("2026-09-01");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(8); // septiembre = índice 8
    expect(d.getDate()).toBe(1);
  });

  it("cuenta días naturales entre dos fechas", () => {
    expect(daysBetween("2026-01-01", "2026-01-11")).toBe(10);
  });

  it("nunca regresa días negativos aunque 'to' sea anterior a 'from'", () => {
    expect(daysBetween("2026-01-11", "2026-01-01")).toBe(0);
  });
});

describe("isInterested", () => {
  it("cuenta todo lo que no es 'descartado' como interesado", () => {
    expect(isInterested("muy_interesado")).toBe(true);
    expect(isInterested("oferta_realizada")).toBe(true);
    expect(isInterested("descartado")).toBe(false);
  });
});

describe("teléfono del prospecto", () => {
  it("valida solo por cantidad de dígitos (10 a 15)", () => {
    expect(isValidProspectPhone("871 123 4567")).toBe(true);
    expect(isValidProspectPhone("12345")).toBe(false);
    expect(isValidProspectPhone("1".repeat(16))).toBe(false);
  });

  it("antepone la lada 52 solo a números de 10 dígitos", () => {
    expect(whatsappNumber("8711234567")).toBe("528711234567");
    expect(whatsappNumber("528711234567")).toBe("528711234567");
  });
});

describe("buildVisitReport", () => {
  const payload = {
    property: { created_at: "2026-01-01T00:00:00.000Z" },
    visits: [
      { visited_at: "2026-01-05T10:00:00.000Z", interest: "interesado", reasons: ["precio", "ubicacion"] },
      { visited_at: "2026-01-10T10:00:00.000Z", interest: "descartado", reasons: ["precio"] },
      { visited_at: "2026-01-15T10:00:00.000Z", interest: "oferta_realizada", reasons: [] },
    ],
  };

  it("cuenta interesados, descartados y ofertas por visita, no por persona", () => {
    const report = buildVisitReport(payload, { now: new Date("2026-01-20T00:00:00.000Z") });
    expect(report.totalVisits).toBe(3);
    expect(report.interested).toBe(2); // interesado + oferta_realizada
    expect(report.discarded).toBe(1);
    expect(report.withOffer).toBe(1);
  });

  it("cuenta cada motivo una vez por visita y reparte el porcentaje sobre el total de menciones", () => {
    const report = buildVisitReport(payload, { now: new Date("2026-01-20T00:00:00.000Z") });
    const precio = report.reasons.find((r) => r.key === "precio");
    const ubicacion = report.reasons.find((r) => r.key === "ubicacion");
    expect(precio.count).toBe(2);
    expect(ubicacion.count).toBe(1);
    expect(report.reasonMentions).toBe(3);
    expect(report.reasons.reduce((sum, r) => sum + r.pct, 0)).toBe(100);
  });

  it("cuenta días en el mercado hasta hoy si no se ha vendido", () => {
    const report = buildVisitReport(payload, { now: new Date("2026-01-11T00:00:00.000Z") });
    expect(report.daysOnMarket).toBe(10);
    expect(report.sold).toBe(false);
  });

  it("cuenta días en el mercado hasta la fecha de venta, no hasta hoy", () => {
    const report = buildVisitReport(
      { ...payload, sold_on: "2026-01-06" },
      { now: new Date("2026-06-01T00:00:00.000Z") },
    );
    expect(report.sold).toBe(true);
    expect(report.daysOnMarket).toBe(5); // de 2026-01-01 a 2026-01-06
  });

  it("ordena las visitas de más reciente a más antigua en el log", () => {
    const report = buildVisitReport(payload, { now: new Date("2026-01-20T00:00:00.000Z") });
    const dates = report.log.map((v) => v.visited_at);
    expect(dates).toEqual([...dates].sort().reverse());
  });
});
