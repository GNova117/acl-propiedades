import { describe, expect, it } from "vitest";
import {
  calcularSubcuentaViviendaPorEmpleos,
  CREDITO_MAXIMO_ABSOLUTO,
  simularCreditoInfonavit,
  tasaInteresPorUma,
} from "./infonavitSimulator";

describe("tasaInteresPorUma", () => {
  it("usa la tasa mínima confirmada por debajo o en el límite inferior (2.6 UMA)", () => {
    expect(tasaInteresPorUma(1)).toBe(3.69);
    expect(tasaInteresPorUma(2.6)).toBe(3.69);
  });

  it("usa la tasa máxima confirmada en o por encima del límite superior (6.6 UMA)", () => {
    expect(tasaInteresPorUma(6.6)).toBe(10.45);
    expect(tasaInteresPorUma(10)).toBe(10.45);
  });

  it("interpola linealmente entre los dos extremos confirmados", () => {
    const mitad = (2.6 + 6.6) / 2;
    expect(tasaInteresPorUma(mitad)).toBeCloseTo((3.69 + 10.45) / 2);
  });
});

describe("simularCreditoInfonavit", () => {
  it("aplica el límite de edad de hombre (70 años) para el plazo máximo", () => {
    const r = simularCreditoInfonavit({ edad: 65, sexo: "hombre", salarioMensual: 15000, ssv: 0 });
    expect(r.plazoAnios).toBe(5);
    expect(r.plazoMeses).toBe(60);
  });

  it("aplica el límite de edad de mujer (75 años), más amplio que el de hombre", () => {
    const r = simularCreditoInfonavit({ edad: 65, sexo: "mujer", salarioMensual: 15000, ssv: 0 });
    expect(r.plazoAnios).toBe(10);
  });

  it("topa el plazo a 30 años aunque falten más años para el límite de edad", () => {
    const r = simularCreditoInfonavit({ edad: 20, sexo: "mujer", salarioMensual: 15000, ssv: 0 });
    expect(r.plazoAnios).toBe(30);
  });

  it("da plazo cero cuando la edad ya alcanzó o superó el límite", () => {
    const r = simularCreditoInfonavit({ edad: 71, sexo: "hombre", salarioMensual: 15000, ssv: 0 });
    expect(r.plazoAnios).toBe(0);
    expect(r.montoCredito).toBe(0);
  });

  it("la capacidad total suma el monto de crédito y el saldo de la Subcuenta de Vivienda", () => {
    const r = simularCreditoInfonavit({ edad: 30, sexo: "hombre", salarioMensual: 15000, ssv: 50000 });
    expect(r.capacidadTotal).toBeCloseTo(r.montoCredito + 50000);
    expect(r.saldoSsv).toBe(50000);
  });

  it("nunca excede el tope máximo absoluto de crédito", () => {
    const r = simularCreditoInfonavit({ edad: 25, sexo: "mujer", salarioMensual: 500000, ssv: 0 });
    expect(r.montoCredito).toBeLessThanOrEqual(CREDITO_MAXIMO_ABSOLUTO);
  });

  it("reporta gastos de titulación/financieros siempre en cero (eliminados desde mayo 2024)", () => {
    const r = simularCreditoInfonavit({ edad: 30, sexo: "hombre", salarioMensual: 15000, ssv: 0 });
    expect(r.gastosFinancierosOperacion).toBe(0);
  });

  it("trata un sexo desconocido como hombre por defecto", () => {
    const r = simularCreditoInfonavit({ edad: 65, sexo: "otro", salarioMensual: 15000, ssv: 0 });
    expect(r.plazoAnios).toBe(5);
  });
});

describe("calcularSubcuentaViviendaPorEmpleos", () => {
  it("acumula la aportación del 5% anual a lo largo de los años trabajados, por empleo", () => {
    const { detalle, total } = calcularSubcuentaViviendaPorEmpleos([
      { salarioDiario: 300, aniosTrabajados: 2 },
    ]);
    // mensual = 300*30.4 = 9120; anual = 109,440; aportación anual = 5,472; total = 10,944
    expect(detalle[0].aportacionAnual).toBeCloseTo(5472);
    expect(detalle[0].total).toBeCloseTo(10944);
    expect(total).toBeCloseTo(10944);
  });

  it("suma el total de varios empleos", () => {
    const { total } = calcularSubcuentaViviendaPorEmpleos([
      { salarioDiario: 300, aniosTrabajados: 2 },
      { salarioDiario: 200, aniosTrabajados: 1 },
    ]);
    expect(total).toBeGreaterThan(10944);
  });

  it("devuelve cero sin reventar cuando no hay empleos", () => {
    expect(calcularSubcuentaViviendaPorEmpleos([])).toEqual({ detalle: [], total: 0 });
    expect(calcularSubcuentaViviendaPorEmpleos(undefined)).toEqual({ detalle: [], total: 0 });
  });
});
