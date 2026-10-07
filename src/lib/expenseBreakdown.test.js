import { describe, expect, it } from "vitest";
import { computeBreakdown, conceptAmount, creditRefund, toConceptFields, validateConcept } from "./expenseBreakdown";

describe("conceptAmount", () => {
  it("un rubro fijo devuelve su valor sin importar precio o crédito", () => {
    const concept = { kind: "fixed", value: 1500, base: "price" };
    expect(conceptAmount(concept, { price: 1000000, credit: 0 })).toBe(1500);
  });

  it("un rubro porcentual sobre el precio se calcula del precio de venta", () => {
    const concept = { kind: "percent", value: 2, base: "price" };
    expect(conceptAmount(concept, { price: 1000000, credit: 0 })).toBe(20000);
  });

  it("un rubro porcentual con base 'credit' se calcula del monto del crédito, no del precio", () => {
    const concept = { kind: "percent", value: 1, base: "credit" };
    expect(conceptAmount(concept, { price: 1000000, credit: 500000 })).toBe(5000);
  });

  it("redondea a centavos para evitar ruido de punto flotante", () => {
    const concept = { kind: "percent", value: 0.1, base: "price" };
    expect(conceptAmount(concept, { price: 333333, credit: 0 })).toBe(333.33);
  });
});

describe("computeBreakdown", () => {
  const concepts = [
    { municipality: "Torreón", profile: "comprador", name: "B", kind: "fixed", value: 1000, sort_order: 1 },
    { municipality: "Torreón", profile: "comprador", name: "A", kind: "fixed", value: 500, sort_order: 0 },
    { municipality: "Torreón", profile: "vendedor", name: "C", kind: "fixed", value: 2000, sort_order: 0 },
    { municipality: "Lerdo", profile: "comprador", name: "D", kind: "fixed", value: 9999, sort_order: 0 },
  ];

  it("solo incluye los rubros del municipio y perfil pedidos", () => {
    const { rows, total } = computeBreakdown(concepts, { municipality: "Torreón", profile: "comprador", price: 0, credit: 0 });
    expect(rows.map((r) => r.name)).toEqual(["A", "B"]);
    expect(total).toBe(1500);
  });

  it("ordena los rubros por sort_order", () => {
    const { rows } = computeBreakdown(concepts, { municipality: "Torreón", profile: "comprador", price: 0, credit: 0 });
    expect(rows[0].name).toBe("A");
    expect(rows[1].name).toBe("B");
  });
});

describe("creditRefund", () => {
  it("cuando el crédito alcanza y sobra para los gastos, devuelve el sobrante al comprador", () => {
    const r = creditRefund({ price: 1000000, credit: 1200000, totalExpenses: 50000 });
    expect(r.surplus).toBe(200000);
    expect(r.refund).toBe(150000);
    expect(r.shortfall).toBe(0);
  });

  it("cuando el sobrante no alcanza para los gastos, el comprador cubre la diferencia (shortfall)", () => {
    const r = creditRefund({ price: 1000000, credit: 1020000, totalExpenses: 50000 });
    expect(r.surplus).toBe(20000);
    expect(r.refund).toBe(0);
    expect(r.shortfall).toBe(30000);
  });

  it("sin crédito o con crédito menor al precio, todo queda en cero", () => {
    expect(creditRefund({ price: 1000000, credit: 0, totalExpenses: 50000 })).toEqual({ surplus: 0, refund: 0, shortfall: 50000 });
    expect(creditRefund({})).toEqual({ surplus: 0, refund: 0, shortfall: 0 });
  });
});

describe("validateConcept", () => {
  it("exige nombre", () => {
    expect(validateConcept({ name: "", value: "10", kind: "fixed" }).name).toBe("required");
  });

  it("exige un valor numérico no negativo", () => {
    expect(validateConcept({ name: "X", value: "-1", kind: "fixed" }).value).toBe("invalid");
    expect(validateConcept({ name: "X", value: "abc", kind: "fixed" }).value).toBe("invalid");
  });

  it("un porcentaje no puede superar 100", () => {
    expect(validateConcept({ name: "X", value: "150", kind: "percent" }).value).toBe("invalid");
    expect(validateConcept({ name: "X", value: "100", kind: "percent" }).value).toBeUndefined();
  });

  it("un monto fijo sí puede superar 100", () => {
    expect(validateConcept({ name: "X", value: "150", kind: "fixed" }).value).toBeUndefined();
  });
});

describe("toConceptFields", () => {
  it("fuerza base a 'price' cuando el rubro no es porcentual", () => {
    const fields = toConceptFields({ municipality: "Torreón", profile: "comprador", name: " X ", kind: "fixed", base: "credit", value: "10", sort_order: "2" });
    expect(fields.base).toBe("price");
    expect(fields.name).toBe("X");
    expect(fields.value).toBe(10);
    expect(fields.sort_order).toBe(2);
  });

  it("conserva la base elegida cuando el rubro es porcentual", () => {
    const fields = toConceptFields({ municipality: "Torreón", profile: "comprador", name: "X", kind: "percent", base: "credit", value: "1" });
    expect(fields.base).toBe("credit");
  });
});
