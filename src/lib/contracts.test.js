import { describe, expect, it } from "vitest";
import { contractState, contractsNeedingAttention, validateContract } from "./contracts";

const today = "2026-11-17";
const c = (expires_on, extra = {}) => ({ property_id: "p", kind: "exclusiva", expires_on, ...extra });

describe("validateContract", () => {
  it("acepta tipo y fecha, y limpia la nota", () => {
    expect(validateContract({ kind: "exclusiva", expiresOn: "2026-12-31", note: "  renovar con el dueño " })).toEqual({
      value: { kind: "exclusiva", expires_on: "2026-12-31", note: "renovar con el dueño" },
    });
    expect(validateContract({ kind: "abierta", expiresOn: "2026-12-31" }).value.note).toBeNull();
  });
  it("rechaza tipo y fecha inválidos", () => {
    expect(validateContract({ kind: "otra", expiresOn: "2026-12-31" }).error).toBe("kind");
    expect(validateContract({ kind: "abierta", expiresOn: "" }).error).toBe("date");
    expect(validateContract({ kind: "abierta", expiresOn: "31/12/2026" }).error).toBe("date");
    expect(validateContract({}).error).toBe("kind");
  });
  it("una fecha ya pasada sí se acepta (el contrato venció y conviene registrarlo)", () => {
    expect(validateContract({ kind: "exclusiva", expiresOn: "2020-01-01" }).value).toBeTruthy();
  });
});

describe("contractState", () => {
  it("vigente, por vencer, urgente y vencido según los días que faltan", () => {
    expect(contractState(c("2027-02-01"), today)).toEqual({ state: "vigente", daysLeft: 76 });
    expect(contractState(c("2026-12-17"), today)).toEqual({ state: "porVencer", daysLeft: 30 });
    expect(contractState(c("2026-11-24"), today)).toEqual({ state: "urgente", daysLeft: 7 });
    expect(contractState(c("2026-11-17"), today)).toEqual({ state: "urgente", daysLeft: 0 });
    expect(contractState(c("2026-11-10"), today)).toEqual({ state: "vencido", daysLeft: -7 });
  });
});

describe("contractsNeedingAttention", () => {
  it("deja fuera los vigentes y pone arriba lo que primero vence", () => {
    const list = contractsNeedingAttention([c("2027-06-01"), c("2026-12-01"), c("2026-11-05"), c("2026-11-20")], today);
    expect(list.map((e) => e.contract.expires_on)).toEqual(["2026-11-05", "2026-11-20", "2026-12-01"]);
  });
});
