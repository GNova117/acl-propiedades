import { beforeEach, describe, expect, it } from "vitest";
import { forgetAccess, offlineSessionFor, recallAccess, recallLastAccount, rememberAccess } from "./offlineAccess";

// localStorage de mentira (el entorno de pruebas es node).
const backing = new Map();
let failWrites = false;
globalThis.localStorage = {
  getItem: (k) => (backing.has(k) ? backing.get(k) : null),
  setItem: (k, v) => {
    if (failWrites) throw new Error("QuotaExceededError");
    backing.set(k, String(v));
  },
  removeItem: (k) => backing.delete(k),
};

const ACCESS = { id: "acc-1", email: "ana@acl.mx", advisor_id: "adv-7", role: { id: "r1", slug: "asesor", name: "Asesor", sections: ["prospectos", "agenda"], created_at: "2026-01-01" } };

beforeEach(() => {
  backing.clear();
  failWrites = false;
});

describe("rememberAccess / recallAccess", () => {
  it("recuerda rol (solo lo necesario) y asesor de esa cuenta, sin importar mayúsculas del correo", () => {
    rememberAccess("Ana@ACL.mx", ACCESS);
    expect(recallAccess("ana@acl.mx")).toEqual({ role: { id: "r1", slug: "asesor", name: "Asesor", sections: ["prospectos", "agenda"] }, advisor_id: "adv-7" });
    expect(JSON.stringify([...backing.values()])).not.toContain("created_at");
  });

  it("no entrega el acceso de otra cuenta que haya entrado antes en el dispositivo", () => {
    rememberAccess("ana@acl.mx", ACCESS);
    expect(recallAccess("luis@acl.mx")).toBeNull();
  });

  it("la cuenta nueva reemplaza a la anterior", () => {
    rememberAccess("ana@acl.mx", ACCESS);
    rememberAccess("luis@acl.mx", { ...ACCESS, advisor_id: null, role: { ...ACCESS.role, slug: "oficina", sections: ["prospectos"] } });
    expect(recallAccess("ana@acl.mx")).toBeNull();
    expect(recallAccess("luis@acl.mx")).toMatchObject({ advisor_id: null, role: { slug: "oficina" } });
  });

  it("sin acceso o sin rol, olvida lo que hubiera (no se abre un panel que el servidor ya no concede)", () => {
    rememberAccess("ana@acl.mx", ACCESS);
    rememberAccess("ana@acl.mx", null);
    expect(recallLastAccount()).toBeNull();
    rememberAccess("ana@acl.mx", ACCESS);
    rememberAccess("ana@acl.mx", { advisor_id: null, role: null });
    expect(recallLastAccount()).toBeNull();
  });

  it("forgetAccess lo borra (cerrar sesión)", () => {
    rememberAccess("ana@acl.mx", ACCESS);
    forgetAccess();
    expect(recallLastAccount()).toBeNull();
  });

  it("un valor guardado dañado o incompleto se ignora", () => {
    backing.set("acl_access_v1", "{no es json");
    expect(recallLastAccount()).toBeNull();
    backing.set("acl_access_v1", JSON.stringify({ email: "ana@acl.mx", role: { slug: "x" } }));
    expect(recallLastAccount()).toBeNull();
  });

  it("si el almacenamiento está lleno no truena", () => {
    failWrites = true;
    expect(() => rememberAccess("ana@acl.mx", ACCESS)).not.toThrow();
    expect(recallLastAccount()).toBeNull();
  });
});

describe("offlineSessionFor", () => {
  it("arma una sesión solo con el correo y marcada como sin conexión", () => {
    rememberAccess("ana@acl.mx", ACCESS);
    expect(offlineSessionFor(recallLastAccount())).toEqual({ user: { email: "ana@acl.mx" }, offline: true });
  });
  it("sin cuenta recordada no hay sesión", () => {
    expect(offlineSessionFor(null)).toBeNull();
    expect(offlineSessionFor(recallLastAccount())).toBeNull();
  });
});
