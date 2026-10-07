import { describe, expect, it } from "vitest";
import { computeLiquidacion, toLiquidacionFormValues, toLiquidacionPayload, EMPTY_LIQUIDACION } from "./liquidacion";

describe("computeLiquidacion", () => {
  const base = {
    precio_propiedad: 1000000,
    costo_total: 20000,
    devolucion_vendedor: 300000,
    inversion_remodelacion: 50000,
    inversion_servicios: 10000,
    gastos_bitacora: 0,
    captador_id: "asesor-1",
    vendedor_id: "asesor-1",
    tasa_comision_captacion: 40,
    tasa_comision_venta: 30,
    tasa_gastos_admin: 10,
  };

  it("resta costo de liquidación, devolución e inversión del precio para llegar al subtotal", () => {
    const r = computeLiquidacion(base);
    // 1,000,000 - 20,000 - 300,000 - (50,000 + 10,000) - 0
    expect(r.subtotal).toBe(620000);
    expect(r.inversion).toBe(60000);
  });

  it("también resta los gastos de bitácora del subtotal", () => {
    const r = computeLiquidacion({ ...base, gastos_bitacora: 15000 });
    expect(r.subtotal).toBe(605000);
    expect(r.gastos).toBe(15000);
  });

  it("cuando captador y vendedor son la misma persona, se queda con el 100% de la comisión", () => {
    const r = computeLiquidacion(base);
    expect(r.mismaPersona).toBe(true);
    expect(r.comisionVenta).toBe(0);
    expect(r.montoCaptador).toBe(r.comisionCaptacion);
  });

  it("trata vendedor_id vacío como la misma persona (sin partir la comisión)", () => {
    const r = computeLiquidacion({ ...base, vendedor_id: "" });
    expect(r.mismaPersona).toBe(true);
    expect(r.comisionVenta).toBe(0);
  });

  it("cuando vendedor_id difiere de captador_id, parte la comisión de captación", () => {
    const r = computeLiquidacion({ ...base, vendedor_id: "asesor-2" });
    expect(r.mismaPersona).toBe(false);
    // comisionCaptacion = 620,000 * 0.40 = 248,000
    expect(r.comisionCaptacion).toBeCloseTo(248000);
    // comisionVenta = 248,000 * 0.30 = 74,400
    expect(r.comisionVenta).toBeCloseTo(74400);
    expect(r.montoCaptador).toBeCloseTo(r.comisionCaptacion - r.comisionVenta);
  });

  it("calcula utilidad de oficina y neta restando gastos administrativos", () => {
    const r = computeLiquidacion(base);
    expect(r.utilidadOficina).toBeCloseTo(r.subtotal - r.comisionCaptacion);
    expect(r.gastosAdmin).toBeCloseTo(r.utilidadOficina * 0.1);
    expect(r.utilidadNeta).toBeCloseTo(r.utilidadOficina - r.gastosAdmin);
  });

  it("trata valores no numéricos o vacíos como cero en vez de producir NaN", () => {
    const r = computeLiquidacion({ ...EMPTY_LIQUIDACION, precio_propiedad: "" });
    expect(Number.isNaN(r.subtotal)).toBe(false);
    expect(r.subtotal).toBe(0);
    expect(r.utilidadNeta).toBe(0);
  });
});

describe("toLiquidacionPayload / toLiquidacionFormValues", () => {
  it("convierte montos de texto a número y cadenas vacías de ids a null", () => {
    const payload = toLiquidacionPayload({
      costo_total: "20000",
      devolucion_vendedor: "300000",
      inversion_servicios: "10000",
      captador_id: "",
      vendedor_id: "asesor-1",
      tasa_comision_captacion: "40",
      tasa_comision_venta: "30",
      tasa_gastos_admin: "10",
    });
    expect(payload).toMatchObject({
      costo_total: 20000,
      devolucion_vendedor: 300000,
      inversion_servicios: 10000,
      captador_id: null,
      vendedor_id: "asesor-1",
      tasa_comision_captacion: 40,
      tasa_comision_venta: 30,
      tasa_gastos_admin: 10,
    });
  });

  it("vuelve a los valores vacíos por defecto cuando no hay registro", () => {
    expect(toLiquidacionFormValues(null)).toEqual(EMPTY_LIQUIDACION);
  });

  it("solo toma del registro las llaves conocidas, dejando el resto en su default", () => {
    const values = toLiquidacionFormValues({ costo_total: 999, campo_desconocido: "x" });
    expect(values.costo_total).toBe(999);
    expect(values.devolucion_vendedor).toBe(EMPTY_LIQUIDACION.devolucion_vendedor);
    expect(values.campo_desconocido).toBeUndefined();
  });
});
