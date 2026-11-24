import { describe, expect, it } from "vitest";
import { ariaSort, loadHiddenColumns, nextSort, saveHiddenColumns, sortRows, toggleColumn } from "./tableTools";

describe("nextSort / ariaSort", () => {
  it("cicla sin orden → ascendente → descendente → sin orden, y al cambiar de columna empieza en ascendente", () => {
    let s = null;
    s = nextSort(s, "price");
    expect(s).toEqual({ key: "price", dir: "asc" });
    s = nextSort(s, "price");
    expect(s).toEqual({ key: "price", dir: "desc" });
    expect(nextSort(s, "price")).toBeNull();
    expect(nextSort({ key: "price", dir: "desc" }, "title")).toEqual({ key: "title", dir: "asc" });
  });
  it("aria-sort de cada columna", () => {
    expect(ariaSort({ key: "a", dir: "asc" }, "a")).toBe("ascending");
    expect(ariaSort({ key: "a", dir: "desc" }, "a")).toBe("descending");
    expect(ariaSort({ key: "a", dir: "desc" }, "b")).toBe("none");
    expect(ariaSort(null, "a")).toBe("none");
  });
});

describe("sortRows", () => {
  const rows = [
    { id: 1, name: "Ñandú", price: 300, date: "2026-03-01", ok: true },
    { id: 2, name: "álamo", price: null, date: "2026-01-01", ok: false },
    { id: 3, name: "Zorro", price: 100, date: "2026-02-01", ok: true },
    { id: 4, name: "casa 10", price: 100, date: null, ok: false },
    { id: 5, name: "casa 2", price: 200, date: "2026-02-15", ok: true },
  ];
  const acc = { name: (r) => r.name, price: (r) => r.price, date: (r) => r.date, ok: (r) => r.ok };
  const ids = (sort) => sortRows(rows, sort, acc).map((r) => r.id);

  it("sin orden devuelve las filas como vienen", () => {
    expect(sortRows(rows, null, acc)).toBe(rows);
    expect(sortRows(rows, { key: "otra", dir: "asc" }, acc)).toBe(rows);
  });
  it("texto sin importar acentos ni mayúsculas y con números naturales (casa 2 antes que casa 10)", () => {
    expect(ids({ key: "name", dir: "asc" })).toEqual([2, 5, 4, 1, 3]);
    expect(ids({ key: "name", dir: "desc" })).toEqual([3, 1, 4, 5, 2]);
  });
  it("números: lo vacío siempre al final (en los dos sentidos) y las iguales conservan su orden", () => {
    expect(ids({ key: "price", dir: "asc" })).toEqual([3, 4, 5, 1, 2]);
    expect(ids({ key: "price", dir: "desc" })).toEqual([1, 5, 3, 4, 2]);
  });
  it("fechas y booleanos", () => {
    expect(ids({ key: "date", dir: "asc" })).toEqual([2, 3, 5, 1, 4]);
    expect(ids({ key: "ok", dir: "desc" })).toEqual([1, 3, 5, 2, 4]);
  });
  it("no modifica la lista original", () => {
    const copy = [...rows];
    sortRows(rows, { key: "name", dir: "asc" }, acc);
    expect(rows).toEqual(copy);
  });
});

describe("columnas que se ven", () => {
  const known = ["price", "zone", "area"];
  it("ocultar y mostrar, ignorando lo que no existe", () => {
    let hidden = new Set();
    hidden = toggleColumn(hidden, "price", known);
    expect([...hidden]).toEqual(["price"]);
    expect(toggleColumn(hidden, "otra", known)).toBe(hidden);
    expect([...toggleColumn(hidden, "price", known)]).toEqual([]);
  });
  it("se guarda por tabla y tolera datos viejos o un almacenamiento roto", () => {
    const mem = new Map();
    const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
    saveHiddenColumns("propiedades", new Set(["price", "columna-que-ya-no-existe"]), storage);
    expect([...loadHiddenColumns("propiedades", known, storage)]).toEqual(["price"]);
    expect(loadHiddenColumns("clientes", known, storage).size).toBe(0);
    mem.set("acl.tableColumns.x", "{no json");
    expect(loadHiddenColumns("x", known, storage).size).toBe(0);
    expect(() => saveHiddenColumns("x", new Set(), { setItem: () => { throw new Error("lleno"); } })).not.toThrow();
  });
});
