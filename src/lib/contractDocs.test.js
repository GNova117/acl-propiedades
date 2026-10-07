import { describe, expect, it } from "vitest";
import { amountInWords, buildContractContent, defaultContractValues, numberToWords, validateContractValues } from "./contractDocs";

describe("numberToWords", () => {
  it("números de un dígito y casos irregulares conocidos (quince, veintiuno, cien)", () => {
    expect(numberToWords(0)).toBe("cero");
    expect(numberToWords(15)).toBe("quince");
    expect(numberToWords(21)).toBe("veintiuno");
    expect(numberToWords(100)).toBe("cien");
    expect(numberToWords(101)).toBe("ciento uno");
  });

  it("decenas y centenas compuestas", () => {
    expect(numberToWords(45)).toBe("cuarenta y cinco");
    expect(numberToWords(999)).toBe("novecientos noventa y nueve");
  });

  it("miles: 'mil' solo (no 'uno mil'), y apocope de 'uno'/'veintiuno' antes de mil", () => {
    expect(numberToWords(1000)).toBe("mil");
    expect(numberToWords(1001)).toBe("mil uno");
    expect(numberToWords(21000)).toBe("veintiún mil");
    expect(numberToWords(2000)).toBe("dos mil");
  });

  it("millones: 'un millón' en singular, apocope antes de 'millones'", () => {
    expect(numberToWords(1000000)).toBe("un millón");
    expect(numberToWords(2000000)).toBe("dos millones");
    expect(numberToWords(21000000)).toBe("veintiún millones");
  });

  it("combina millones, miles y el resto en un solo texto", () => {
    expect(numberToWords(1250000)).toBe("un millón doscientos cincuenta mil");
    expect(numberToWords(1000001)).toBe("un millón uno");
  });
});

describe("amountInWords", () => {
  it("el ejemplo documentado: 1,250,000.50 → pesos y centavos como texto", () => {
    expect(amountInWords(1250000.5)).toBe("UN MILLÓN DOSCIENTOS CINCUENTA MIL PESOS 50/100 M.N.");
  });

  it("un peso exacto usa 'UN PESO' en singular, no 'UN PESOS'", () => {
    expect(amountInWords(1)).toBe("UN PESO 00/100 M.N.");
  });

  it("agrega 'DE' antes de 'PESOS' solo en millones exactos (un millón DE pesos)", () => {
    expect(amountInWords(1000000)).toBe("UN MILLÓN DE PESOS 00/100 M.N.");
    expect(amountInWords(1250000)).not.toContain(" DE PESOS");
  });

  it("apocopa 'uno' también antes de la palabra 'pesos' (treinta y un pesos, mil un pesos)", () => {
    expect(amountInWords(31)).toBe("TREINTA Y UN PESOS 00/100 M.N.");
    expect(amountInWords(1001)).toBe("MIL UN PESOS 00/100 M.N.");
  });

  it("rellena los centavos a dos dígitos", () => {
    expect(amountInWords(5.5)).toBe("CINCO PESOS 50/100 M.N.");
    expect(amountInWords(5.05)).toBe("CINCO PESOS 05/100 M.N.");
  });
});

describe("validateContractValues", () => {
  it("un monto en cero o vacío es inválido (tiene que ser > 0)", () => {
    const errors = validateContractValues("recibo_apartado", { monto: "0", fecha_limite: "2026-01-01" });
    expect(errors.monto).toBe(true);
  });

  it("un campo de texto/fecha requerido vacío es inválido", () => {
    const errors = validateContractValues("recibo_apartado", { monto: "1000", fecha_limite: "" });
    expect(errors.fecha_limite).toBe(true);
  });

  it("sin errores cuando todos los campos requeridos están bien", () => {
    expect(validateContractValues("recibo_apartado", { monto: "1000", fecha_limite: "2026-01-01" })).toEqual({});
  });

  it("la comisión de autorización de venta no puede superar 100%, aunque los demás campos estén completos", () => {
    const errors = validateContractValues("autorizacion_venta", { precio: "1000000", comision_pct: "150", vigencia_meses: "6", fecha_inicio: "2026-01-01" });
    expect(errors.comision_pct).toBe(true);
  });
});

describe("defaultContractValues", () => {
  it("recibo_apartado arranca sin reembolso y con transferencia como forma de pago", () => {
    const values = defaultContractValues("recibo_apartado", {});
    expect(values.forma_pago).toBe("transferencia");
    expect(values.reembolso).toBe("no_reembolsable");
  });

  it("autorizacion_venta toma el precio vigente de la propiedad y sugiere 5% de comisión, exclusiva", () => {
    const values = defaultContractValues("autorizacion_venta", { price: 1500000 });
    expect(values.precio).toBe("1500000");
    expect(values.comision_pct).toBe("5");
    expect(values.exclusiva).toBe(true);
  });

  it("un tipo desconocido no revienta: da un objeto vacío", () => {
    expect(defaultContractValues("algo_raro", {})).toEqual({});
  });
});

describe("buildContractContent", () => {
  const client = { name: "Ana López" };
  const property = { title: "Casa X", code: "C1", price: 1000000, address: "Calle 1", zone: "Centro" };
  const advisor = { name: "Beto" };

  it("agrega la fila 'Saldo por cubrir' solo cuando el apartado es menor al precio", () => {
    const content = buildContractContent("recibo_apartado", {
      client,
      property,
      advisor,
      values: { monto: "300000", forma_pago: "transferencia", fecha_limite: "2026-06-01", reembolso: "reembolsable", notas: "" },
    });
    expect(content.data.find(([label]) => label === "Saldo por cubrir")).toEqual(["Saldo por cubrir", "$700,000.00"]);
    expect(content.clauses.some((c) => c.includes("devuelto íntegramente al Cliente") && c.startsWith("Si la operación no se formaliza"))).toBe(true);
  });

  it("sin reembolso, la cláusula dice que el apartado no es reembolsable", () => {
    const content = buildContractContent("recibo_apartado", {
      client,
      property,
      advisor,
      values: { monto: "1000000", forma_pago: "efectivo", fecha_limite: "2026-06-01", reembolso: "no_reembolsable", notas: "" },
    });
    expect(content.data.find(([label]) => label === "Saldo por cubrir")).toBeUndefined();
    expect(content.clauses.some((c) => c.includes("no será reembolsable"))).toBe(true);
  });

  it("el nombre de archivo combina el tipo de documento y el nombre del cliente", () => {
    const content = buildContractContent("recibo_apartado", {
      client,
      property,
      advisor,
      values: { monto: "1000", forma_pago: "efectivo", fecha_limite: "2026-06-01", reembolso: "no_reembolsable", notas: "" },
    });
    expect(content.fileName).toBe("recibo_apartado_Ana López");
  });
});
