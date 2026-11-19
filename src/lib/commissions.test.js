import { describe, expect, it } from "vitest";
import { commissionLines, summarizeByAdvisor, validatePayment } from "./commissions";
import { computeLiquidacion } from "./liquidacion";

describe("commissionLines", () => {
  it("la misma persona capta y vende: una sola comisión, la de captación completa", () => {
    const calc = computeLiquidacion({ precio_propiedad: 1000000, costo_total: 400000, tasa_comision_captacion: 40, tasa_comision_venta: 30, captador_id: "a", vendedor_id: "a" });
    expect(commissionLines(calc, { captadorId: "a", vendedorId: "a" })).toEqual([{ concept: "captacion", advisor_id: "a", amount: 240000 }]);
  });
  it("captador y vendedor distintos: se reparte según la tasa de venta", () => {
    const calc = computeLiquidacion({ precio_propiedad: 1000000, costo_total: 400000, tasa_comision_captacion: 40, tasa_comision_venta: 30, captador_id: "a", vendedor_id: "b" });
    expect(commissionLines(calc, { captadorId: "a", vendedorId: "b" })).toEqual([
      { concept: "captacion", advisor_id: "a", amount: 168000 },
      { concept: "venta", advisor_id: "b", amount: 72000 },
    ]);
  });
  it("sin utilidad (cálculo negativo) o sin asesor no hay líneas", () => {
    const calc = computeLiquidacion({ precio_propiedad: 100, costo_total: 400, captador_id: "a", vendedor_id: "a" });
    expect(commissionLines(calc, { captadorId: "a", vendedorId: "a" })).toEqual([]);
    expect(commissionLines(computeLiquidacion({ precio_propiedad: 1000000 }), {})).toEqual([]);
    expect(commissionLines(null, { captadorId: "a" })).toEqual([]);
  });
});

describe("validatePayment", () => {
  it("pide una fecha y no acepta una futura", () => {
    expect(validatePayment("2026-11-10", "2026-11-17").value).toBe("2026-11-10");
    expect(validatePayment("2026-11-17", "2026-11-17").value).toBe("2026-11-17");
    expect(validatePayment("", "2026-11-17").error).toBe("date");
    expect(validatePayment("2026-11-18", "2026-11-17").error).toBe("future");
  });
});

describe("summarizeByAdvisor", () => {
  it("suma pendiente y pagado por asesor, el que más debe primero", () => {
    const rows = [
      { advisor_id: "a", amount: 100, status: "pendiente" },
      { advisor_id: "a", amount: 50, status: "pagada" },
      { advisor_id: "b", amount: 300, status: "pendiente" },
    ];
    expect(summarizeByAdvisor(rows)).toEqual([
      { advisor_id: "b", pending: 300, paid: 0, count: 1 },
      { advisor_id: "a", pending: 100, paid: 50, count: 2 },
    ]);
  });
});
