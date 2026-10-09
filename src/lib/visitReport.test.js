import { describe, expect, it } from "vitest";
import {
  buildVisitReport,
  daysBetween,
  generateReportToken,
  isInterested,
  isValidProspectPhone,
  parseDateOnly,
  percentages,
  phoneDigits,
  reportPath,
  reportUrl,
  REPORT_TOKEN_PATTERN,
  toLocalInputValue,
  toVisitFields,
  validateVisitForm,
  whatsappNumber,
} from "./visitReport.js";

describe("percentages (método del mayor residuo)", () => {
  it("siempre suma exactamente 100, incluso con empates que redondearían a 99", () => {
    const result = percentages([1, 1, 1]);
    expect(result.reduce((a, b) => a + b, 0)).toBe(100);
    expect(result).toEqual([34, 33, 33]); // el primer índice se lleva el residuo mayor en empate
  });

  it("no inventa reparto cuando el total ya cae exacto", () => {
    expect(percentages([5, 3, 2])).toEqual([50, 30, 20]);
  });

  it("regresa ceros (no NaN) cuando el total es 0, sin dividir entre cero", () => {
    expect(percentages([0, 0])).toEqual([0, 0]);
  });

  it("reparte proporcionalmente con un solo valor dominante", () => {
    expect(percentages([9, 1])).toEqual([90, 10]);
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
    expect(daysBetween("2026-01-10", "2026-01-01")).toBe(0);
  });
});

describe("isInterested", () => {
  it("cuenta todo lo que no es 'descartado' como interesado, incluida una oferta", () => {
    expect(isInterested("muy_interesado")).toBe(true);
    expect(isInterested("oferta_realizada")).toBe(true);
    expect(isInterested("descartado")).toBe(false);
  });
});

describe("toLocalInputValue", () => {
  it("formatea una fecha local para <input type=datetime-local>", () => {
    expect(toLocalInputValue(new Date(2026, 2, 5, 9, 3))).toBe("2026-03-05T09:03");
  });
});

describe("phoneDigits / isValidProspectPhone / whatsappNumber", () => {
  it("quita todo lo que no sea dígito", () => {
    expect(phoneDigits("871-487-1494")).toBe("8714871494");
  });

  it("valida teléfonos de 10 a 15 dígitos", () => {
    expect(isValidProspectPhone("871 123 4567")).toBe(true);
    expect(isValidProspectPhone("12345")).toBe(false);
    expect(isValidProspectPhone("1".repeat(16))).toBe(false);
  });

  it("antepone la lada 52 solo a números de 10 dígitos (sin lada de país)", () => {
    expect(whatsappNumber("8714871494")).toBe("528714871494");
    expect(whatsappNumber("528714871494")).toBe("528714871494");
  });
});

describe("validateVisitForm", () => {
  const validForm = {
    property_id: "p1",
    advisor_id: "a1",
    visited_at: "2026-01-01T10:00",
    interest: "interesado",
    potential_client: false,
    prospect_phone: "",
  };

  it("exige propiedad, asesor, fecha e interés", () => {
    const errors = validateVisitForm({ ...validForm, property_id: "", advisor_id: "", interest: "" });
    expect(errors.property_id).toBe("required");
    expect(errors.advisor_id).toBe("required");
    expect(errors.interest).toBe("required");
  });

  it("rechaza una fecha futura más allá de la tolerancia del reloj", () => {
    const now = new Date("2026-01-01T10:00:00");
    const errors = validateVisitForm({ ...validForm, visited_at: "2026-01-01T11:00" }, { now });
    expect(errors.visited_at).toBe("future");
  });

  it("acepta un pequeño desfase de reloj sin marcarlo como futuro", () => {
    const now = new Date("2026-01-01T10:00:00");
    const errors = validateVisitForm({ ...validForm, visited_at: "2026-01-01T10:05" }, { now });
    expect(errors.visited_at).toBeUndefined();
  });

  it("solo valida el teléfono si se marcó 'posible cliente' y se escribió algo", () => {
    expect(validateVisitForm({ ...validForm, potential_client: false, prospect_phone: "123" }).prospect_phone).toBeUndefined();
    expect(validateVisitForm({ ...validForm, potential_client: true, prospect_phone: "" }).prospect_phone).toBeUndefined();
    expect(validateVisitForm({ ...validForm, potential_client: true, prospect_phone: "123" }).prospect_phone).toBe("phone");
  });
});

describe("toVisitFields", () => {
  it("convierte cadenas vacías a null, recorta espacios y deduplica motivos", () => {
    const fields = toVisitFields({
      property_id: "p1",
      advisor_id: "a1",
      visited_at: "2026-01-01T10:00",
      prospect_name: "  ",
      interest: "interesado",
      reasons: ["precio", "precio", "ubicacion"],
      comments: " ",
      internal_notes: "",
      potential_client: false,
      prospect_phone: "871",
      looking_for: "casa",
    });
    expect(fields.prospect_name).toBeNull();
    expect(fields.comments).toBeNull();
    expect(fields.reasons).toEqual(["precio", "ubicacion"]);
  });

  it("solo guarda teléfono y 'qué busca' cuando potential_client está marcado", () => {
    const unmarked = toVisitFields({
      property_id: "p1",
      advisor_id: "a1",
      visited_at: "2026-01-01T10:00",
      prospect_name: "",
      interest: "interesado",
      reasons: [],
      comments: "",
      internal_notes: "",
      potential_client: false,
      prospect_phone: "8714871494",
      looking_for: "casa",
    });
    expect(unmarked.prospect_phone).toBeNull();
    expect(unmarked.looking_for).toBeNull();
  });
});

describe("buildVisitReport", () => {
  const payload = {
    property: { created_at: "2026-01-01T00:00:00.000Z" },
    visits: [
      { visited_at: "2026-01-05T00:00:00.000Z", interest: "muy_interesado", reasons: ["precio", "ubicacion"] },
      { visited_at: "2026-01-06T00:00:00.000Z", interest: "descartado", reasons: ["precio"] },
      { visited_at: "2026-01-07T00:00:00.000Z", interest: "oferta_realizada", reasons: [] },
    ],
  };

  it("cuenta interesados, descartados y ofertas por visita (no por persona)", () => {
    const report = buildVisitReport(payload, { now: new Date("2026-01-11T00:00:00.000Z") });
    expect(report.totalVisits).toBe(3);
    expect(report.interested).toBe(2);
    expect(report.discarded).toBe(1);
    expect(report.withOffer).toBe(1);
  });

  it("los porcentajes de motivos suman 100 sobre el total de menciones, no de visitas", () => {
    const report = buildVisitReport(payload, { now: new Date("2026-01-11T00:00:00.000Z") });
    expect(report.reasonMentions).toBe(3);
    expect(report.reasons.reduce((sum, r) => sum + r.pct, 0)).toBe(100);
    expect(report.reasons[0]).toMatchObject({ key: "precio", count: 2 });
  });

  it("cuenta días en el mercado desde el alta de la propiedad hasta 'ahora' si no se ha vendido", () => {
    const report = buildVisitReport(payload, { now: new Date("2026-01-11T00:00:00.000Z") });
    expect(report.daysOnMarket).toBe(10);
    expect(report.sold).toBe(false);
  });

  it("si ya se vendió, cuenta los días hasta la fecha de venta, no hasta hoy", () => {
    const report = buildVisitReport(
      { ...payload, sold_on: "2026-01-08" },
      { now: new Date("2026-02-01T00:00:00.000Z") }
    );
    expect(report.sold).toBe(true);
    expect(report.daysOnMarket).toBe(7);
  });

  it("sin fecha de alta real, daysOnMarket es null en vez de un número engañoso", () => {
    const report = buildVisitReport({ property: {}, visits: [] });
    expect(report.daysOnMarket).toBeNull();
  });

  it("ordena las visitas de más reciente a más antigua en el log", () => {
    const report = buildVisitReport(payload, { now: new Date("2026-01-11T00:00:00.000Z") });
    const dates = report.log.map((v) => v.visited_at);
    expect(dates).toEqual([...dates].sort().reverse());
  });
});

describe("enlace de informe", () => {
  it("el token generado cumple el patrón de 32 hex que exige la base de datos", () => {
    expect(generateReportToken()).toMatch(REPORT_TOKEN_PATTERN);
  });

  it("reportUrl combina el origin con la ruta del token", () => {
    const token = "a".repeat(32);
    expect(reportPath(token)).toBe(`/informe/${token}`);
    expect(reportUrl(token, "https://aclpropiedades.com")).toBe(`https://aclpropiedades.com/informe/${token}`);
  });
});
