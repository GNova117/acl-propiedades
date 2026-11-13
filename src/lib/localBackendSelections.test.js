import { beforeEach, describe, expect, it } from "vitest";

// Selecciones de propiedades en el modo demo (espejo de property_selections y selection_open de schema.sql).
const store = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  },
};

const { localBackend: db } = await import("./localBackend");

const input = (over = {}) => ({ propertyIds: ["prop-1", "prop-2"], title: "Para Luis", note: "Hola", advisorId: "advisor-1", prospectoId: "p1", ...over });

beforeEach(() => store.clear());

describe("modo demo: crear selección", () => {
  it("guarda propiedades, mensaje, asesor y prospecto, con un token de 32 hex y 60 días de vigencia, sin aperturas", async () => {
    const s = await db.createSelection(input());
    expect(s).toMatchObject({ property_ids: ["prop-1", "prop-2"], title: "Para Luis", note: "Hola", advisor_id: "advisor-1", prospecto_id: "p1", open_count: 0, first_opened_at: null, revoked_at: null });
    expect(s.token).toMatch(/^[0-9a-f]{32}$/);
    const days = (new Date(s.expires_at) - new Date(s.created_at)) / 864e5;
    expect(Math.round(days)).toBe(60);
  });

  it("limpia repetidas y rechaza una selección vacía", async () => {
    expect((await db.createSelection(input({ propertyIds: ["a", "a", "b"] }))).property_ids).toEqual(["a", "b"]);
    await expect(db.createSelection(input({ propertyIds: [] }))).rejects.toThrow("al menos una");
  });

  it("dos selecciones no comparten token, y la lista las da de la más reciente a la más antigua", async () => {
    const a = await db.createSelection(input({ title: "A" }));
    await new Promise((r) => setTimeout(r, 5));
    const b = await db.createSelection(input({ title: "B" }));
    expect(a.token).not.toBe(b.token);
    expect((await db.getSelections()).map((s) => s.title)).toEqual(["B", "A"]);
  });
});

describe("modo demo: abrir por token (la página pública)", () => {
  it("entrega lo de la página y anota la apertura (primera, última y cuántas)", async () => {
    const s = await db.createSelection(input());
    const first = await db.openSelection(s.token);
    expect(first).toMatchObject({ status: "ok", title: "Para Luis", note: "Hola", advisor_id: "advisor-1", property_ids: ["prop-1", "prop-2"] });
    await db.openSelection(s.token);
    const [stored] = await db.getSelections();
    expect(stored.open_count).toBe(2);
    expect(stored.first_opened_at).toBeTruthy();
    expect(stored.last_opened_at >= stored.first_opened_at).toBe(true);
  });

  it("con track: false (el asesor viendo como el cliente) no cuenta", async () => {
    const s = await db.createSelection(input());
    await db.openSelection(s.token, { track: false });
    expect((await db.getSelections())[0]).toMatchObject({ open_count: 0, first_opened_at: null });
  });

  it("un token que no existe da null", async () => {
    expect(await db.openSelection("0".repeat(32))).toBeNull();
  });

  it("desactivada: status revoked, sin propiedades y sin contar", async () => {
    const s = await db.createSelection(input());
    await db.revokeSelection(s.id);
    expect(await db.openSelection(s.token)).toMatchObject({ status: "revoked", property_ids: [], advisor_id: "advisor-1" });
    expect((await db.getSelections())[0].open_count).toBe(0);
  });

  it("vencida: status expired, sin propiedades y sin contar", async () => {
    const s = await db.createSelection(input());
    const items = JSON.parse(store.get("acl_local_selecciones"));
    items[0].expires_at = new Date(Date.now() - 864e5).toISOString();
    store.set("acl_local_selecciones", JSON.stringify(items));
    expect(await db.openSelection(s.token)).toMatchObject({ status: "expired", property_ids: [] });
    expect((await db.getSelections())[0].open_count).toBe(0);
  });

  it("desactivar una que no existe avisa", async () => {
    await expect(db.revokeSelection("nada")).rejects.toThrow("no encontrada");
  });
});
