import { describe, expect, it } from "vitest";
import { computeLiquidacion, EMPTY_LIQUIDACION, toLiquidacionFormValues, toLiquidacionPayload } from "./liquidacion.js";

const baseForm = {
  precio_propiedad: 1000000,
  costo_total: 50000,
  devolucion_vendedor: 200000,
  inversion_remodelacion: 100000,
  inversion_servicios: 20000,
  gastos_bitacora: 0,
  captador_id: "asesor-1",
  vendedor_id: "asesor-1",
  tasa_comision_captacion: 40,
  tasa_comision_venta: 30,
  tasa_gastos_admin: 10,
};

describe("computeLiquidacion", () => {
  it("calcula la cascada completa cuando el mismo asesor capta y vende", () => {
    const result = computeLiquidacion(baseForm);

    // subtotal = 1,000,000 - 50,000 - 200,000 - (100,000 + 20,000) - 0
    expect(result.subtotal).toBe(630000);
    expect(result.mismaPersona).toBe(true);
    expect(result.comisionCaptacion).toBe(252000); // 40% de 630,000
    expect(result.comisionVenta).toBe(0);
    expect(result.montoCaptador).toBe(252000);
    expect(result.utilidadOficina).toBe(378000); // 630,000 - 252,000
    expect(result.gastosAdmin).toBe(37800); // 10% de 378,000
    expect(result.utilidadNeta).toBe(340200);
  });

  it("reparte la comisión de venta cuando el vendedor es distinto del captador", () => {
    const result = computeLiquidacion({ ...baseForm, vendedor_id: "asesor-2" });

    expect(result.mismaPersona).toBe(false);
    expect(result.comisionCaptacion).toBe(252000);
    expect(result.comisionVenta).toBe(75600); // 30% de 252,000
    expect(result.montoCaptador).toBe(176400); // 252,000 - 75,600
  });

  it("trata vendedor_id vacío como la misma persona que captó", () => {
    const result = computeLiquidacion({ ...baseForm, vendedor_id: "" });
    expect(result.mismaPersona).toBe(true);
    expect(result.comisionVenta).toBe(0);
  });

  it("resta los gastos de bitácora como una línea aparte de inversión y servicios", () => {
    const sinGastos = computeLiquidacion(baseForm);
    const conGastos = computeLiquidacion({ ...baseForm, gastos_bitacora: 10000 });

    expect(conGastos.gastos).toBe(10000);
    expect(conGastos.subtotal).toBe(sinGastos.subtotal - 10000);
  });

  it("trata valores no numéricos o vacíos como cero en vez de NaN", () => {
    const result = computeLiquidacion({
      precio_propiedad: "",
      costo_total: "abc",
      devolucion_vendedor: undefined,
      inversion_remodelacion: null,
      inversion_servicios: "",
      tasa_comision_captacion: "",
      tasa_comision_venta: "",
      tasa_gastos_admin: "",
    });

    expect(result.subtotal).toBe(0);
    expect(result.utilidadNeta).toBe(0);
    expect(Number.isNaN(result.utilidadNeta)).toBe(false);
  });

  it("trata EMPTY_LIQUIDACION con precio vacío como subtotal y utilidad en cero", () => {
    const r = computeLiquidacion({ ...EMPTY_LIQUIDACION, precio_propiedad: "" });
    expect(Number.isNaN(r.subtotal)).toBe(false);
    expect(r.subtotal).toBe(0);
    expect(r.utilidadNeta).toBe(0);
  });
});

describe("toLiquidacionPayload", () => {
  it("convierte el formulario a un payload con números y null para ids vacíos", () => {
    const payload = toLiquidacionPayload({ ...baseForm, vendedor_id: "" });
    expect(payload.vendedor_id).toBeNull();
    expect(payload.captador_id).toBe("asesor-1");
    expect(payload.costo_total).toBe(50000);
    expect(typeof payload.tasa_comision_captacion).toBe("number");
  });

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
});

describe("toLiquidacionFormValues", () => {
  it("regresa los valores por default cuando no hay registro guardado", () => {
    const values = toLiquidacionFormValues(null);
    expect(values.tasa_comision_captacion).toBe(40);
    expect(values.costo_total).toBe("");
  });

  it("vuelve a los valores vacíos por defecto cuando no hay registro (igual a EMPTY_LIQUIDACION)", () => {
    expect(toLiquidacionFormValues(null)).toEqual(EMPTY_LIQUIDACION);
  });

  it("solo sobreescribe las llaves presentes y no nulas del registro", () => {
    const values = toLiquidacionFormValues({ costo_total: 12345, devolucion_vendedor: null });
    expect(values.costo_total).toBe(12345);
    expect(values.devolucion_vendedor).toBe(""); // null no pisa el default
  });

  it("solo toma del registro las llaves conocidas, dejando el resto en su default", () => {
    const values = toLiquidacionFormValues({ costo_total: 999, campo_desconocido: "x" });
    expect(values.costo_total).toBe(999);
    expect(values.devolucion_vendedor).toBe(EMPTY_LIQUIDACION.devolucion_vendedor);
    expect(values.campo_desconocido).toBeUndefined();
  });
});
