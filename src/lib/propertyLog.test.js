import { describe, expect, it } from "vitest";
import { amount, budgetStatus, expensesByCategory, groupByDay, logMonths, sumExpenses, toLogFields, validateLogFile, validateLogForm } from "./propertyLog";

describe("amount", () => {
  it("quita comas de miles y convierte a número", () => {
    expect(amount("1,250.50")).toBe(1250.5);
  });

  it("da 0 para vacío o texto no numérico, nunca NaN", () => {
    expect(amount("")).toBe(0);
    expect(amount("abc")).toBe(0);
    expect(amount(undefined)).toBe(0);
  });
});

describe("validateLogForm", () => {
  it("una nota solo exige fecha y descripción", () => {
    expect(validateLogForm({ kind: "nota", entry_date: "2026-01-01", descripcion: "" }).descripcion).toBe("required");
    expect(validateLogForm({ kind: "nota", entry_date: "2026-01-01", descripcion: "todo bien" })).toEqual({});
  });

  it("un gasto exige categoría, concepto y un monto mayor a cero", () => {
    const errors = validateLogForm({ kind: "gasto", entry_date: "2026-01-01", categoria: "", concepto: "", monto: "0" });
    expect(errors.categoria).toBe("required");
    expect(errors.concepto).toBe("required");
    expect(errors.monto).toBe("amount");
  });

  it("un gasto válido no tiene errores", () => {
    expect(validateLogForm({ kind: "gasto", entry_date: "2026-01-01", categoria: "agua", concepto: "Recibo de agua", monto: "350" })).toEqual({});
  });
});

describe("validateLogFile", () => {
  it("acepta imágenes y PDF, rechaza otros tipos", () => {
    expect(validateLogFile({ type: "image/jpeg", size: 1000 })).toBeNull();
    expect(validateLogFile({ type: "application/pdf", size: 1000 })).toBeNull();
    expect(validateLogFile({ type: "application/zip", name: "a.zip", size: 1000 })).toBe("type");
  });

  it("rechaza un archivo que excede el tope de tamaño", () => {
    expect(validateLogFile({ type: "image/jpeg", size: 21 * 1024 * 1024 })).toBe("size");
  });

  it("sin archivo no hay error", () => {
    expect(validateLogFile(null)).toBeNull();
  });
});

describe("toLogFields", () => {
  it("un gasto guarda monto y concepto; una nota guarda descripción y deja monto en null", () => {
    const gasto = toLogFields({ kind: "gasto", entry_date: "2026-01-01", categoria: "agua", concepto: " Recibo ", monto: "350", descripcion: "" });
    expect(gasto.monto).toBe(350);
    expect(gasto.concepto).toBe("Recibo");
    expect(gasto.descripcion).toBeNull();

    const nota = toLogFields({ kind: "nota", entry_date: "2026-01-01", descripcion: " Visita del plomero ", categoria: "", monto: "" });
    expect(nota.monto).toBeNull();
    expect(nota.descripcion).toBe("Visita del plomero");
  });
});

describe("sumExpenses / expensesByCategory", () => {
  const entries = [
    { kind: "gasto", categoria: "agua", monto: 100 },
    { kind: "gasto", categoria: "luz", monto: 200 },
    { kind: "gasto", categoria: "agua", monto: 50 },
    { kind: "nota", categoria: "agua", monto: 9999 }, // una nota nunca suma
  ];

  it("sumExpenses solo suma gastos, nunca notas, y puede filtrar por categoría", () => {
    expect(sumExpenses(entries)).toBe(350);
    expect(sumExpenses(entries, "agua")).toBe(150);
  });

  it("expensesByCategory agrupa de mayor a menor y manda un gasto sin categoría a 'otro'", () => {
    const totals = expensesByCategory([...entries, { kind: "gasto", categoria: null, monto: 500 }]);
    expect(totals[0]).toEqual({ categoria: "otro", total: 500, count: 1 });
    expect(totals.find((t) => t.categoria === "agua")).toEqual({ categoria: "agua", total: 150, count: 2 });
  });
});

describe("groupByDay", () => {
  it("agrupa por día, más reciente primero, con el acumulado de toda la historia", () => {
    const entries = [
      { kind: "gasto", entry_date: "2026-01-01", monto: 100, created_at: "2026-01-01T10:00" },
      { kind: "gasto", entry_date: "2026-01-02", monto: 200, created_at: "2026-01-02T10:00" },
    ];
    const days = groupByDay(entries);
    expect(days[0].date).toBe("2026-01-02");
    expect(days[0].dayTotal).toBe(200);
    expect(days[0].cumulative).toBe(300);
    expect(days[1].cumulative).toBe(100);
  });
});

describe("budgetStatus", () => {
  it("sin presupuesto (0 o vacío) devuelve null, no 0%", () => {
    expect(budgetStatus(500, 0)).toBeNull();
    expect(budgetStatus(500, "")).toBeNull();
  });

  it("clasifica en ok / warn (>=90%) / over (ya se pasó)", () => {
    expect(budgetStatus(500, 1000).level).toBe("ok");
    expect(budgetStatus(950, 1000).level).toBe("warn");
    expect(budgetStatus(1100, 1000).level).toBe("over");
  });
});

describe("logMonths", () => {
  it("da los meses con al menos una entrada, del más reciente al más antiguo, sin repetir", () => {
    const entries = [{ entry_date: "2026-01-05" }, { entry_date: "2026-01-20" }, { entry_date: "2026-03-01" }];
    expect(logMonths(entries)).toEqual(["2026-03", "2026-01"]);
  });
});
