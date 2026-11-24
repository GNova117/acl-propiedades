import { describe, expect, it } from "vitest";
import { listBucketFiles, planDownloads, safeRelativePath } from "./storageBackupLib";

// Un bucket falso: carpetas (id null) y archivos, con paginación de 100.
function fakeBucket(tree) {
  return async (prefix, offset) => {
    const node = prefix ? prefix.split("/").reduce((n, p) => n[p], tree) : tree;
    const items = Object.entries(node).map(([name, value]) => (typeof value === "number" ? { name, id: `id-${name}`, metadata: { size: value } } : { name, id: null }));
    return items.slice(offset, offset + 100);
  };
}

describe("listBucketFiles", () => {
  it("recorre carpetas y devuelve rutas completas con su tamaño", async () => {
    const files = await listBucketFiles(fakeBucket({ "a.jpg": 10, cliente1: { "ine.jpg": 20, nivel: { "x.pdf": 5 } }, "z.png": 1 }));
    expect(files).toEqual([
      { path: "a.jpg", size: 10 },
      { path: "cliente1/ine.jpg", size: 20 },
      { path: "cliente1/nivel/x.pdf", size: 5 },
      { path: "z.png", size: 1 },
    ]);
  });
  it("junta varias páginas (más de 100 archivos)", async () => {
    const many = Object.fromEntries(Array.from({ length: 250 }, (_, i) => [`f${String(i).padStart(3, "0")}.jpg`, 1]));
    expect(await listBucketFiles(fakeBucket(many))).toHaveLength(250);
  });
  it("un bucket vacío da lista vacía", async () => {
    expect(await listBucketFiles(fakeBucket({}))).toEqual([]);
  });
});

describe("planDownloads", () => {
  it("respeta el tope y reporta lo omitido", () => {
    const files = [{ path: "a", size: 6 }, { path: "b", size: 6 }, { path: "c", size: 3 }];
    expect(planDownloads(files, 10)).toEqual({ chosen: [{ path: "a", size: 6 }, { path: "c", size: 3 }], skipped: [{ path: "b", size: 6 }], bytes: 9 });
    expect(planDownloads(files, 100).skipped).toEqual([]);
  });
});

describe("safeRelativePath", () => {
  it("no deja escapar de la carpeta de salida", () => {
    expect(safeRelativePath("../../etc/passwd")).toBe("etc/passwd");
    expect(safeRelativePath("/abs/ruta/./x.jpg")).toBe("abs/ruta/x.jpg");
    expect(safeRelativePath("cliente/ine.jpg")).toBe("cliente/ine.jpg");
  });
});
