import { describe, expect, it } from "vitest";
import { holdState, holdsNeedingAttention, offersSummary, validateHold, validateOffer } from "./offers";

describe("validateOffer", () => {
  it("limpia y acepta una oferta válida", () => {
    expect(validateOffer({ party: "cliente", buyerName: "  Luis Pérez ", amount: "$1,250,000.4", note: " baja " })).toEqual({
      value: { party: "cliente", buyer_name: "Luis Pérez", amount: 1250000, note: "baja" },
    });
  });
  it("rechaza tipo, nombre y monto inválidos", () => {
    expect(validateOffer({ party: "x", buyerName: "a", amount: 1 }).error).toBe("party");
    expect(validateOffer({ party: "cliente", buyerName: "  ", amount: 1 }).error).toBe("name");
    expect(validateOffer({ party: "cliente", buyerName: "a", amount: 0 }).error).toBe("amount");
    expect(validateOffer({ party: "cliente", buyerName: "a", amount: "abc" }).error).toBe("amount");
    expect(validateOffer({ party: "cliente", buyerName: "a", amount: -5 }).error).toBe("amount");
  });
  it("recorta lo que pasa del máximo", () => {
    const { value } = validateOffer({ party: "propietario", buyerName: "n".repeat(500), amount: 10, note: "x".repeat(900) });
    expect(value.buyer_name).toHaveLength(120);
    expect(value.note).toHaveLength(300);
  });
});

describe("validateHold", () => {
  const today = "2026-11-17";
  it("acepta el apartado sin monto y con fecha de hoy en adelante", () => {
    expect(validateHold({ buyerName: "Ana", amount: "", dueDate: "2026-11-17" }, today).value).toMatchObject({ amount: 0, due_date: "2026-11-17", buyer_phone: null });
  });
  it("rechaza fecha pasada, fecha rota, monto negativo y sin nombre", () => {
    expect(validateHold({ buyerName: "Ana", dueDate: "2026-11-16" }, today).error).toBe("pastDate");
    expect(validateHold({ buyerName: "Ana", dueDate: "mañana" }, today).error).toBe("date");
    expect(validateHold({ buyerName: "Ana", amount: -1, dueDate: "2026-12-01" }, today).error).toBe("amount");
    expect(validateHold({ buyerName: "", dueDate: "2026-12-01" }, today).error).toBe("name");
  });
});

describe("holdState", () => {
  const today = "2026-11-17";
  const hold = (due_date, status = "vigente") => ({ due_date, status });
  it("vigente, por vencer y vencido según la fecha", () => {
    expect(holdState(hold("2026-12-01"), today)).toEqual({ state: "vigente", daysLeft: 14 });
    expect(holdState(hold("2026-11-20"), today)).toEqual({ state: "porVencer", daysLeft: 3 });
    expect(holdState(hold("2026-11-17"), today)).toEqual({ state: "porVencer", daysLeft: 0 });
    expect(holdState(hold("2026-11-15"), today)).toEqual({ state: "vencido", daysLeft: -2 });
  });
  it("los cerrados no se vencen nunca", () => {
    expect(holdState(hold("2026-01-01", "concretado"), today).state).toBe("concretado");
    expect(holdState(hold("2026-01-01", "cancelado"), today).state).toBe("cancelado");
  });
  it("lista solo los que piden atención, el más urgente primero", () => {
    const list = holdsNeedingAttention([hold("2026-12-30"), hold("2026-11-19"), hold("2026-11-10"), hold("2026-11-10", "cancelado")], today);
    expect(list.map((e) => e.hold.due_date)).toEqual(["2026-11-10", "2026-11-19"]);
  });
});

describe("offersSummary", () => {
  it("toma la oferta abierta más alta del cliente y la compara con el precio de lista", () => {
    const s = offersSummary(
      [
        { party: "cliente", amount: 900, status: "abierta" },
        { party: "cliente", amount: 950, status: "abierta" },
        { party: "cliente", amount: 990, status: "rechazada" },
        { party: "propietario", amount: 980, status: "abierta" },
      ],
      1000
    );
    expect(s.openCount).toBe(3);
    expect(s.best.amount).toBe(950);
    expect(s.pctVsList).toBe(-5);
  });
  it("sin ofertas del cliente no hay mejor oferta", () => {
    expect(offersSummary([], 1000)).toEqual({ openCount: 0, best: null, pctVsList: null });
  });
});
