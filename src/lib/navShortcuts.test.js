import { describe, expect, it } from "vitest";
import { MAX_PINS, MAX_RECENTS, itemForPath, loadPins, loadRecents, pushRecent, resolveShortcuts, savePins, saveRecents, togglePin } from "./navShortcuts";

const items = ["/admin/mi-dia", "/admin/prospectos", "/admin/agenda", "/admin/propiedades", "/admin/clientes"].map((to) => ({ to }));

describe("togglePin", () => {
  it("fija, desfija y respeta el tope", () => {
    expect(togglePin([], "/a")).toEqual(["/a"]);
    expect(togglePin(["/a", "/b"], "/a")).toEqual(["/b"]);
    const full = Array.from({ length: MAX_PINS }, (_, i) => `/p${i}`);
    expect(togglePin(full, "/otra")).toEqual(full);
    expect(togglePin(full, "/p0")).toHaveLength(MAX_PINS - 1);
  });
});

describe("pushRecent / itemForPath", () => {
  it("el último visitado va primero, sin repetirse y con tope", () => {
    expect(pushRecent(["/a", "/b"], "/b")).toEqual(["/b", "/a"]);
    let list = [];
    for (let i = 0; i < 10; i += 1) list = pushRecent(list, `/r${i}`);
    expect(list).toHaveLength(MAX_RECENTS);
    expect(list[0]).toBe("/r9");
  });
  it("encuentra el elemento del menú más específico de una dirección", () => {
    const paths = ["/admin", "/admin/propiedades", "/admin/propiedades/nueva"];
    expect(itemForPath("/admin/propiedades/abc/historial", paths)).toBe("/admin/propiedades");
    expect(itemForPath("/admin/propiedades/nueva", paths)).toBe("/admin/propiedades/nueva");
    expect(itemForPath("/otro", paths)).toBeNull();
  });
});

describe("resolveShortcuts", () => {
  it("los fijados van arriba en el orden en que se fijaron; lo que ya no existe en el rol se ignora", () => {
    const { pinned } = resolveShortcuts(items, ["/admin/agenda", "/admin/secreto", "/admin/mi-dia"], []);
    expect(pinned.map((i) => i.to)).toEqual(["/admin/agenda", "/admin/mi-dia"]);
  });
  it("los recientes no repiten lo fijado ni lo que ya se ve", () => {
    const { recent } = resolveShortcuts(items, ["/admin/agenda"], ["/admin/agenda", "/admin/prospectos", "/admin/propiedades", "/admin/secreto"], new Set(["/admin/prospectos"]));
    expect(recent.map((i) => i.to)).toEqual(["/admin/propiedades"]);
  });
});

describe("guardado", () => {
  it("por persona y tolera un almacenamiento roto", () => {
    const mem = new Map();
    const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
    savePins("Ana@x.mx", ["/a"], storage);
    saveRecents("ana@x.mx", ["/b"], storage);
    expect(loadPins("ANA@x.mx", storage)).toEqual(["/a"]);
    expect(loadRecents("ana@x.mx", storage)).toEqual(["/b"]);
    expect(loadPins("beto@x.mx", storage)).toEqual([]);
    mem.set("acl.adminNav.pins.x", "{no json");
    expect(loadPins("x", storage)).toEqual([]);
    expect(() => savePins("x", ["/a"], { setItem: () => { throw new Error("lleno"); } })).not.toThrow();
  });
});
