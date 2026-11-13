import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveAccess, resolveSession } from "./authStartup";
import { recallLastAccount, rememberAccess } from "./offlineAccess";

// localStorage de mentira (el entorno de pruebas es node).
const backing = new Map();
globalThis.localStorage = {
  getItem: (k) => (backing.has(k) ? backing.get(k) : null),
  setItem: (k, v) => backing.set(k, String(v)),
  removeItem: (k) => backing.delete(k),
};

const ACCESS = { advisor_id: "adv-7", role: { id: "r1", slug: "asesor", name: "Asesor", sections: ["prospectos", "agenda"] } };
const networkError = () => Object.assign(new Error("network request failed"), { name: "AuthRetryableFetchError" });
const fetchError = () => new TypeError("Failed to fetch");

beforeEach(() => backing.clear());

describe("resolveSession", () => {
  it("con sesión guardada y válida, la entrega tal cual", async () => {
    const session = { user: { email: "ana@acl.mx" } };
    const db = { getCurrentSession: vi.fn(async () => session) };
    expect(await resolveSession(db)).toEqual({ session, offline: false });
  });

  it("sin sesión (nunca entró o cerró sesión) no inventa una", async () => {
    rememberAccess("ana@acl.mx", ACCESS); // recordada de antes, pero la lectura dice «sin sesión» sin fallo de red
    expect(await resolveSession({ getCurrentSession: async () => null })).toEqual({ session: null, offline: false });
  });

  it("sesión caducada y sin red: abre con la cuenta recordada, marcada como sin conexión", async () => {
    rememberAccess("ana@acl.mx", ACCESS);
    const out = await resolveSession({ getCurrentSession: async () => Promise.reject(networkError()) });
    expect(out).toEqual({ session: { user: { email: "ana@acl.mx" }, offline: true }, offline: true });
  });

  it("también con el error crudo de fetch", async () => {
    rememberAccess("ana@acl.mx", ACCESS);
    const out = await resolveSession({ getCurrentSession: async () => Promise.reject(fetchError()) });
    expect(out.offline).toBe(true);
  });

  it("sin red y sin cuenta recordada, no hay sesión (irá al inicio de sesión)", async () => {
    expect(await resolveSession({ getCurrentSession: async () => Promise.reject(networkError()) })).toEqual({ session: null, offline: false });
  });

  it("un fallo que no es de red no abre nada y no deja cargando", async () => {
    rememberAccess("ana@acl.mx", ACCESS);
    const out = await resolveSession({ getCurrentSession: async () => Promise.reject(new Error("boom")) });
    expect(out).toEqual({ session: null, offline: false });
  });
});

describe("resolveAccess", () => {
  it("con red: rol y asesor vigentes, y los recuerda", async () => {
    const db = { getMyAccess: vi.fn(async () => ACCESS) };
    expect(await resolveAccess(db, "ana@acl.mx")).toEqual({ role: ACCESS.role, advisorId: "adv-7", saved: false });
    expect(recallLastAccount()).toMatchObject({ email: "ana@acl.mx", advisor_id: "adv-7" });
  });

  it("con red pero sin fila de acceso: sin rol, y olvida lo recordado", async () => {
    rememberAccess("ana@acl.mx", ACCESS);
    expect(await resolveAccess({ getMyAccess: async () => null }, "ana@acl.mx")).toEqual({ role: null, advisorId: null, saved: false });
    expect(recallLastAccount()).toBeNull();
  });

  it("sin red: usa el rol recordado de esa cuenta y avisa que es el recordado", async () => {
    rememberAccess("ana@acl.mx", ACCESS);
    const out = await resolveAccess({ getMyAccess: async () => Promise.reject(fetchError()) }, "ana@acl.mx");
    expect(out).toEqual({ role: ACCESS.role, advisorId: "adv-7", saved: true });
  });

  it("sin red y con el rol recordado de OTRA cuenta: lanza (no se presta el acceso de otro)", async () => {
    rememberAccess("luis@acl.mx", ACCESS);
    await expect(resolveAccess({ getMyAccess: async () => Promise.reject(fetchError()) }, "ana@acl.mx")).rejects.toThrow("Failed to fetch");
  });

  it("un error que no es de red (p. ej. permisos) se lanza aunque haya algo recordado", async () => {
    rememberAccess("ana@acl.mx", ACCESS);
    await expect(resolveAccess({ getMyAccess: async () => Promise.reject(new Error("permission denied")) }, "ana@acl.mx")).rejects.toThrow("permission denied");
  });
});
