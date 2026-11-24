import { describe, expect, it } from "vitest";
import { clearItems, forgetItem, getItems, groupItems, itemPath, MY_SPACE_MAX, rememberItem } from "./mySpace";

const memoryStorage = () => {
  const data = new Map();
  return { getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, v), removeItem: (k) => data.delete(k), data };
};
const T1 = "a".repeat(32);
const T2 = "b".repeat(32);

describe("mySpace", () => {
  it("anota un enlace y lo devuelve con su ruta", () => {
    const storage = memoryStorage();
    rememberItem({ kind: "visit", token: T1, title: "Casa en Senderos", detail: "12 de nov · 10:00" }, { storage, now: 100 });
    const [item] = getItems({ storage });
    expect(item).toMatchObject({ kind: "visit", token: T1, title: "Casa en Senderos", detail: "12 de nov · 10:00", at: 100 });
    expect(itemPath(item)).toBe(`/visita/${T1}`);
    expect(itemPath({ kind: "portal", token: T2 })).toBe(`/documentos/${T2}`);
    expect(itemPath({ kind: "sign", token: T2 })).toBe(`/firmar/${T2}`);
    expect(itemPath({ kind: "selection", token: T2 })).toBe(`/seleccion/${T2}`);
  });

  it("volver a abrir el mismo enlace lo actualiza y lo sube al principio, sin duplicarlo", () => {
    const storage = memoryStorage();
    rememberItem({ kind: "visit", token: T1, title: "A", detail: "uno" }, { storage, now: 1 });
    rememberItem({ kind: "portal", token: T2, title: "B" }, { storage, now: 2 });
    rememberItem({ kind: "visit", token: T1, title: "A", detail: "dos" }, { storage, now: 3 });
    const items = getItems({ storage });
    expect(items.map((i) => i.token)).toEqual([T1, T2]);
    expect(items[0].detail).toBe("dos");
  });

  it("el mismo token en otro tipo de enlace es otro enlace", () => {
    const storage = memoryStorage();
    rememberItem({ kind: "visit", token: T1, title: "A" }, { storage });
    rememberItem({ kind: "sign", token: T1, title: "B" }, { storage });
    expect(getItems({ storage })).toHaveLength(2);
  });

  it("rechaza tipos o tokens que no son de un enlace y limita la cantidad", () => {
    const storage = memoryStorage();
    rememberItem({ kind: "otro", token: T1, title: "x" }, { storage });
    rememberItem({ kind: "visit", token: "corto", title: "x" }, { storage });
    rememberItem({ kind: "visit", token: "<script>alert(1)</script>", title: "x" }, { storage });
    expect(getItems({ storage })).toEqual([]);
    for (let i = 0; i < MY_SPACE_MAX + 5; i += 1) rememberItem({ kind: "visit", token: `t${String(i).padStart(20, "0")}`, title: "x" }, { storage, now: i });
    expect(getItems({ storage })).toHaveLength(MY_SPACE_MAX);
  });

  it("recorta los textos largos y limpia espacios", () => {
    const storage = memoryStorage();
    rememberItem({ kind: "visit", token: T1, title: `  ${"x".repeat(300)}  \n y`, detail: null }, { storage });
    const [item] = getItems({ storage });
    expect(item.title.length).toBe(120);
    expect(item.detail).toBe("");
  });

  it("quita uno o todos", () => {
    const storage = memoryStorage();
    rememberItem({ kind: "visit", token: T1, title: "A" }, { storage });
    rememberItem({ kind: "portal", token: T2, title: "B" }, { storage });
    forgetItem("visit", T1, { storage });
    expect(getItems({ storage }).map((i) => i.kind)).toEqual(["portal"]);
    clearItems({ storage });
    expect(getItems({ storage })).toEqual([]);
  });

  it("ignora datos dañados o con elementos inválidos", () => {
    const storage = memoryStorage();
    storage.setItem("acl_my_space", "{roto");
    expect(getItems({ storage })).toEqual([]);
    storage.setItem("acl_my_space", JSON.stringify([{ kind: "visit", token: T1, title: "ok", at: 1 }, { kind: "x", token: T1 }, null, "texto"]));
    expect(getItems({ storage })).toHaveLength(1);
  });

  it("agrupa por tipo en el orden de la pantalla", () => {
    const items = [
      { kind: "selection", token: T1 },
      { kind: "visit", token: T2 },
      { kind: "visit", token: T1 },
    ];
    expect(groupItems(items).map((g) => [g.kind, g.items.length])).toEqual([["visit", 2], ["selection", 1]]);
  });
});
