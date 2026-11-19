import { beforeEach, describe, expect, it } from "vitest";

// Modo demo (espejo de property_contracts, commissions y merge_prospects de schema.sql).
const store = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  },
};
globalThis.localStorage = globalThis.window.localStorage;

const { localBackend: db } = await import("./localBackend");
const put = (key, value) => store.set(key, JSON.stringify(value));
const get = (key) => JSON.parse(store.get(key) || "[]");

beforeEach(() => store.clear());

describe("modo demo: contratos de intermediación", () => {
  it("guarda uno por propiedad (reemplaza), ordenados por vencimiento, y lo borra", async () => {
    await db.setPropertyContract("p1", { kind: "exclusiva", expiresOn: "2026-12-31" });
    await db.setPropertyContract("p2", { kind: "abierta", expiresOn: "2026-11-30", note: " ojo " });
    await db.setPropertyContract("p1", { kind: "abierta", expiresOn: "2027-01-15" });
    const list = await db.getPropertyContracts();
    expect(list.map((c) => [c.property_id, c.kind])).toEqual([["p2", "abierta"], ["p1", "abierta"]]);
    expect(list[0].note).toBe("ojo");
    await db.deletePropertyContract("p1");
    expect((await db.getPropertyContracts()).map((c) => c.property_id)).toEqual(["p2"]);
  });

  it("valida tipo y fecha", async () => {
    await expect(db.setPropertyContract("p1", { kind: "x", expiresOn: "2026-12-31" })).rejects.toThrow("contract:kind");
    await expect(db.setPropertyContract("p1", { kind: "abierta", expiresOn: "" })).rejects.toThrow("contract:date");
  });
});

describe("modo demo: comisiones", () => {
  it("registra una por propiedad y concepto, actualiza el monto mientras está pendiente y no toca una pagada", async () => {
    const a = await db.saveCommission("p1", { advisor_id: "a1", concept: "captacion", amount: 50000.4 });
    expect(a).toMatchObject({ amount: 50000, status: "pendiente", paid_on: null });
    await db.saveCommission("p1", { advisor_id: "a1", concept: "captacion", amount: 60000 });
    await db.saveCommission("p1", { advisor_id: "a2", concept: "venta", amount: 20000 });
    expect(await db.getCommissions("p1")).toHaveLength(2);
    expect((await db.getCommissions("p1")).find((c) => c.concept === "captacion").amount).toBe(60000);

    await db.setCommissionPaid(a.id, "2026-11-10");
    await expect(db.saveCommission("p1", { advisor_id: "a1", concept: "captacion", amount: 1 })).rejects.toThrow("commission:paid");
    expect((await db.getCommissions("p1")).find((c) => c.id === a.id)).toMatchObject({ status: "pagada", paid_on: "2026-11-10" });
    expect((await db.setCommissionPaid(a.id, null)).status).toBe("pendiente");
    await db.deleteCommission(a.id);
    expect(await db.getCommissions("p1")).toHaveLength(1);
  });

  it("valida concepto, asesor, monto y fecha de pago", async () => {
    await expect(db.saveCommission("p1", { advisor_id: "a1", concept: "x", amount: 1 })).rejects.toThrow("commission:invalid");
    await expect(db.saveCommission("p1", { advisor_id: "", concept: "venta", amount: 1 })).rejects.toThrow("commission:invalid");
    await expect(db.saveCommission("p1", { advisor_id: "a1", concept: "venta", amount: -1 })).rejects.toThrow("commission:invalid");
    const c = await db.saveCommission("p1", { advisor_id: "a1", concept: "venta", amount: 5 });
    await expect(db.setCommissionPaid(c.id, "2999-01-01")).rejects.toThrow("commission:future");
    await expect(db.setCommissionPaid(c.id, "ayer")).rejects.toThrow("commission:date");
  });
});

describe("modo demo: fusión de prospectos", () => {
  const prospect = (id, extra) => ({ id, name: id, phone: null, email: null, stage: "nuevo", advisor_id: "a1", notes: null, created_at: "2026-11-01T00:00:00.000Z", ...extra });

  it("pasa la historia al conservado, junta los datos y borra el otro", async () => {
    put("acl_local_prospectos", [prospect("k", { phone: "8711111111", stage: "contactado", notes: "A" }), prospect("r", { email: "r@x.mx", stage: "interesado", notes: "B" }), prospect("otro")]);
    put("acl_local_prospect_stages", [{ prospecto_id: "r", stage: "nuevo" }, { prospecto_id: "k", stage: "nuevo" }]);
    put("acl_local_prospect_contacts", [{ prospecto_id: "r", channel: "llamada" }]);
    put("acl_local_agenda_citas", [{ id: "c1", prospecto_id: "r" }]);
    put("acl_local_selecciones", [{ id: "s1", prospecto_id: "r" }]);
    put("acl_local_internal_notes", [
      { id: "n1", entity_type: "prospect", entity_id: "r", body: "x" },
      { id: "n2", entity_type: "client", entity_id: "r", body: "de cliente" },
    ]);

    expect(await db.mergeProspects("k", "r")).toEqual({ ok: true, kept: "k" });
    const prospects = get("acl_local_prospectos");
    expect(prospects.map((p) => p.id).sort()).toEqual(["k", "otro"]);
    expect(prospects.find((p) => p.id === "k")).toMatchObject({ phone: "8711111111", email: "r@x.mx", stage: "interesado" });
    expect(get("acl_local_prospect_stages").every((s) => s.prospecto_id === "k")).toBe(true);
    expect(get("acl_local_prospect_contacts")[0].prospecto_id).toBe("k");
    expect(get("acl_local_agenda_citas")[0].prospecto_id).toBe("k");
    expect(get("acl_local_selecciones")[0].prospecto_id).toBe("k");
    const notes = get("acl_local_internal_notes");
    expect(notes.find((n) => n.id === "n1").entity_id).toBe("k");
    expect(notes.find((n) => n.id === "n2").entity_id).toBe("r"); // la nota de un cliente no se toca
  });

  it("rechaza lo inválido", async () => {
    put("acl_local_prospectos", [prospect("k"), prospect("r")]);
    await expect(db.mergeProspects("k", "k")).rejects.toThrow("merge:invalid");
    await expect(db.mergeProspects("k", "zzz")).rejects.toThrow("merge:not_found");
  });
});
