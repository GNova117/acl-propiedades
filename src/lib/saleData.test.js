import { describe, expect, it } from "vitest";
import { advisorOptions, defaultAdvisorId, needsSaleData, validateSaleData } from "./saleData";

describe("needsSaleData", () => {
  it("pide los datos solo al pasar a vendida y sin venta registrada", () => {
    expect(needsSaleData({ previousStatus: "disponible", nextStatus: "vendida", hasSale: false })).toBe(true);
    expect(needsSaleData({ previousStatus: "apartada", nextStatus: "vendida", hasSale: false })).toBe(true);
    expect(needsSaleData({ previousStatus: undefined, nextStatus: "vendida", hasSale: false })).toBe(true); // propiedad nueva
  });

  it("no la pide si ya era vendida, si ya hay venta o si el nuevo estatus es otro", () => {
    expect(needsSaleData({ previousStatus: "vendida", nextStatus: "vendida", hasSale: false })).toBe(false);
    expect(needsSaleData({ previousStatus: "disponible", nextStatus: "vendida", hasSale: true })).toBe(false);
    expect(needsSaleData({ previousStatus: "disponible", nextStatus: "rentada", hasSale: false })).toBe(false);
  });
});

describe("advisorOptions / defaultAdvisorId", () => {
  const advisors = [
    { id: "a1", name: "Ana", active: true },
    { id: "a2", name: "Beto", active: true },
    { id: "a3", name: "Carla", active: false },
  ];

  it("pone primero a los asesores de la propiedad y deja fuera a los inactivos", () => {
    expect(advisorOptions(advisors, ["a2"]).map((a) => a.id)).toEqual(["a2", "a1"]);
    expect(advisorOptions(advisors, ["a3"]).map((a) => a.id)).toEqual(["a1", "a2"]);
    expect(advisorOptions(undefined, [])).toEqual([]);
  });

  it("propone el primer asesor activo de la propiedad, o ninguno", () => {
    expect(defaultAdvisorId(advisors, ["a3", "a2"])).toBe("a2");
    expect(defaultAdvisorId(advisors, [])).toBe("");
    expect(defaultAdvisorId(advisors, ["a3"])).toBe("");
  });
});

describe("validateSaleData", () => {
  const hoy = "2026-11-28";

  it("exige una fecha válida y no futura", () => {
    expect(validateSaleData({ fecha_venta: "" }, hoy)).toEqual({ fecha_venta: "required" });
    expect(validateSaleData({ fecha_venta: "28/11/2026" }, hoy)).toEqual({ fecha_venta: "invalidDate" });
    expect(validateSaleData({ fecha_venta: "2026-12-01" }, hoy)).toEqual({ fecha_venta: "futureDate" });
    expect(validateSaleData({ fecha_venta: "2026-11-28" }, hoy)).toEqual({});
    expect(validateSaleData({ fecha_venta: "2026-01-05" }, hoy)).toEqual({});
  });
});
