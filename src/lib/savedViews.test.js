import { describe, expect, it } from "vitest";
import { MAX_VIEWS, addView, hasActiveFilters, loadViews, removeView, sanitizeFilters, saveViews } from "./savedViews";

const schema = { query: "string", hotOnly: "boolean", minPrice: "string", page: "number" };

describe("sanitizeFilters", () => {
  it("solo deja los campos del esquema con el tipo correcto", () => {
    expect(sanitizeFilters({ query: "casa", hotOnly: true, minPrice: 5, page: NaN, otro: "x", constructor: "y" }, schema)).toEqual({ query: "casa", hotOnly: true });
    expect(sanitizeFilters(null, schema)).toEqual({});
  });
});

describe("hasActiveFilters", () => {
  it("una vista sin ningún filtro puesto no vale la pena guardarla", () => {
    expect(hasActiveFilters({ query: "", hotOnly: false })).toBe(false);
    expect(hasActiveFilters({ query: "", hotOnly: true })).toBe(true);
    expect(hasActiveFilters({ sortBy: "recent" }, { sortBy: "recent" })).toBe(false);
    expect(hasActiveFilters({ sortBy: "temperature" }, { sortBy: "recent" })).toBe(true);
  });
});

describe("addView / removeView", () => {
  it("agrega con el nombre limpio y rechaza vacío, repetido y de más", () => {
    const first = addView([], "  Calientes de Ana ", { hotOnly: true }, schema);
    expect(first.views).toEqual([{ name: "Calientes de Ana", filters: { hotOnly: true } }]);
    expect(addView([], "   ", {}, schema).error).toBe("name");
    expect(addView(first.views, "calientes DE ana", {}, schema).error).toBe("exists");
    const many = Array.from({ length: MAX_VIEWS }, (_, i) => ({ name: `v${i}`, filters: {} }));
    expect(addView(many, "otra", {}, schema).error).toBe("full");
  });
  it("con replace, sobrescribe la del mismo nombre (aunque ya esté el tope)", () => {
    const many = Array.from({ length: MAX_VIEWS }, (_, i) => ({ name: `v${i}`, filters: {} }));
    const r = addView(many, "V3", { hotOnly: true }, schema, { replace: true });
    expect(r.views).toHaveLength(MAX_VIEWS);
    expect(r.views[3]).toEqual({ name: "V3", filters: { hotOnly: true } });
  });
  it("recorta el nombre largo y quita una vista por nombre", () => {
    expect(addView([], "x".repeat(100), {}, schema).views[0].name).toHaveLength(40);
    expect(removeView([{ name: "a" }, { name: "b" }], "a")).toEqual([{ name: "b" }]);
  });
});

describe("loadViews / saveViews", () => {
  it("guarda por lista, limpia lo que ya no es válido y tolera basura", () => {
    const mem = new Map();
    const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
    saveViews("prospectos", [{ name: "Mías", filters: { query: "a", viejo: 1 } }], storage);
    expect(loadViews("prospectos", schema, storage)).toEqual([{ name: "Mías", filters: { query: "a" } }]);
    expect(loadViews("propiedades", schema, storage)).toEqual([]);
    mem.set("acl.savedViews.x", "{no json");
    expect(loadViews("x", schema, storage)).toEqual([]);
    mem.set("acl.savedViews.y", JSON.stringify([{ name: "" }, 5, { name: "ok" }]));
    expect(loadViews("y", schema, storage)).toEqual([{ name: "ok", filters: {} }]);
    expect(() => saveViews("z", [], { setItem: () => { throw new Error("lleno"); } })).not.toThrow();
  });
});
