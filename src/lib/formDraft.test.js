import { describe, expect, it } from "vitest";
import { clearDraft, draftKey, isMeaningful, loadDraft, saveDraft } from "./formDraft";

const memory = () => {
  const data = new Map();
  return { getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)), removeItem: (k) => data.delete(k), data };
};

describe("formDraft", () => {
  it("guarda y recupera el borrador con su fecha", () => {
    const storage = memory();
    const key = draftKey("propiedad", "nuevo");
    expect(saveDraft(key, { title: "Casa" }, { now: 1000, storage })).toBe(true);
    expect(loadDraft(key, { now: 2000, storage })).toEqual({ savedAt: 1000, data: { title: "Casa" } });
  });
  it("no devuelve nada si no hay borrador, está dañado o ya caducó (y lo borra)", () => {
    const storage = memory();
    expect(loadDraft("x", { storage })).toBeNull();
    storage.setItem("malo", "{no es json");
    expect(loadDraft("malo", { storage })).toBeNull();
    saveDraft("viejo", { a: 1 }, { now: 0, storage });
    expect(loadDraft("viejo", { now: 15 * 86400000, storage })).toBeNull();
    expect(storage.data.has("viejo")).toBe(false);
  });
  it("tolera un almacenamiento que falla o no existe", () => {
    const roto = { getItem: () => { throw new Error("bloqueado"); }, setItem: () => { throw new Error("lleno"); }, removeItem: () => { throw new Error("bloqueado"); } };
    expect(saveDraft("k", {}, { storage: roto })).toBe(false);
    expect(loadDraft("k", { storage: roto })).toBeNull();
    expect(() => clearDraft("k", { storage: roto })).not.toThrow();
    expect(saveDraft("k", {}, { storage: null })).toBe(false);
  });
  it("clearDraft borra y la llave distingue formulario y registro", () => {
    const storage = memory();
    saveDraft(draftKey("propiedad", "p1"), { a: 1 }, { storage });
    clearDraft(draftKey("propiedad", "p1"), { storage });
    expect(loadDraft(draftKey("propiedad", "p1"), { storage })).toBeNull();
    expect(draftKey("propiedad", "p1")).not.toBe(draftKey("nave", "p1"));
  });
  it("solo vale la pena guardar si cambió algo", () => {
    expect(isMeaningful({ a: 1 }, { a: 1 })).toBe(false);
    expect(isMeaningful({ a: 2 }, { a: 1 })).toBe(true);
  });
});
