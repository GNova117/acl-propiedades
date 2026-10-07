import { describe, expect, it } from "vitest";
import {
  calcularSubcuentaViviendaPorEmpleos,
  CREDITO_MAXIMO_ABSOLUTO,
  simularCreditoInfonavit,
  tasaInteresPorUma,
  UMA_2026,
} from "./infonavitSimulator.js";

describe("tasaInteresPorUma", () => {
  it("usa la tasa mínima confirmada hasta 2.6 UMA", () => {
    expect(tasaInteresPorUma(2.6)).toBe(3.69);
    expect(tasaInteresPorUma(1)).toBe(3.69);
  });

  it("usa la tasa máxima confirmada desde 6.6 UMA", () => {
    expect(tasaInteresPorUma(6.6)).toBe(10.45);
    expect(tasaInteresPorUma(10)).toBe(10.45);
  });

  it("interpola linealmente entre los dos extremos confirmados", () => {
    const medio = tasaInteresPorUma((2.6 + 6.6) / 2);
    expect(medio).toBeCloseTo((3.69 + 10.45) / 2, 5);
  });
});

describe("simularCreditoInfonavit", () => {
  it("calcula plazo según la regla de edad por sexo (hombres hasta 70, mujeres hasta 75)", () => {
    const hombre = simularCreditoInfonavit({ edad: 40, sexo: "hombre", salarioMensual: 15000, ssv: 0 });
    const mujer = simularCreditoInfonavit({ edad: 40, sexo: "mujer", salarioMensual: 15000, ssv: 0 });
    expect(hombre.plazoAnios).toBe(30); // 70 - 40 = 30, pero tope es 30
    expect(mujer.plazoAnios).toBe(30); // 75 - 40 = 35, topado a 30
  });

  it("recorta el plazo cuando la edad límite menos la edad actual es menor a 30 años", () => {
    const result = simularCreditoInfonavit({ edad: 65, sexo: "hombre", salarioMensual: 15000, ssv: 0 });
    expect(result.plazoAnios).toBe(5); // 70 - 65
  });

  it("da plazo y crédito cero cuando ya se rebasó la edad límite", () => {
    const result = simularCreditoInfonavit({ edad: 80, sexo: "hombre", salarioMensual: 15000, ssv: 0 });
    expect(result.plazoAnios).toBe(0);
    expect(result.montoCredito).toBe(0);
  });

  it("nunca excede el tope máximo absoluto de crédito", () => {
    const result = simularCreditoInfonavit({ edad: 25, sexo: "hombre", salarioMensual: 500000, ssv: 0 });
    expect(result.montoCredito).toBeLessThanOrEqual(CREDITO_MAXIMO_ABSOLUTO);
  });

  it("suma el saldo de la Subcuenta de Vivienda a la capacidad total de compra", () => {
    const result = simularCreditoInfonavit({ edad: 30, sexo: "mujer", salarioMensual: 10000, ssv: 50000 });
    expect(result.capacidadTotal).toBeCloseTo(result.montoCredito + 50000, 6);
  });

  it("marca exentoTitulacion solo para salarios hasta 2.6 UMA", () => {
    const bajo = simularCreditoInfonavit({ edad: 30, sexo: "hombre", salarioMensual: UMA_2026.mensual * 2, ssv: 0 });
    const alto = simularCreditoInfonavit({ edad: 30, sexo: "hombre", salarioMensual: UMA_2026.mensual * 10, ssv: 0 });
    expect(bajo.exentoTitulacion).toBe(true);
    expect(alto.exentoTitulacion).toBe(false);
    expect(alto.gastosFinancierosOperacion).toBe(0);
  });

  it("trata un sexo desconocido como hombre por default", () => {
    const result = simularCreditoInfonavit({ edad: 40, sexo: "otro", salarioMensual: 15000, ssv: 0 });
    expect(result.plazoAnios).toBe(30); // 70 - 40 = 30
  });
});

describe("calcularSubcuentaViviendaPorEmpleos", () => {
  it("calcula la aportación acumulada por empleo (salario diario x 30.4 x 12 x 5% x años)", () => {
    const { detalle, total } = calcularSubcuentaViviendaPorEmpleos([{ salarioDiario: 300, aniosTrabajados: 2 }]);
    const esperado = 300 * 30.4 * 12 * 0.05 * 2;
    expect(detalle[0].total).toBeCloseTo(esperado, 6);
    expect(total).toBeCloseTo(esperado, 6);
  });

  it("suma la aportación de varios empleos", () => {
    const { total } = calcularSubcuentaViviendaPorEmpleos([
      { salarioDiario: 300, aniosTrabajados: 1 },
      { salarioDiario: 500, aniosTrabajados: 3 },
    ]);
    const esperado = 300 * 30.4 * 12 * 0.05 * 1 + 500 * 30.4 * 12 * 0.05 * 3;
    expect(total).toBeCloseTo(esperado, 6);
  });

  it("regresa total 0 sin empleos", () => {
    expect(calcularSubcuentaViviendaPorEmpleos([]).total).toBe(0);
    expect(calcularSubcuentaViviendaPorEmpleos(undefined).total).toBe(0);
  });
});
