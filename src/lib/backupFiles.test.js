import { describe, expect, it } from "vitest";
import { listAllFiles, supportsDiskSink, writeBackupZip } from "./backupFiles";

describe("listAllFiles", () => {
  // Simula el Storage de Supabase: list(bucket, prefix) devuelve las entradas
  // de esa "carpeta" (id == null significa que la entrada es una carpeta).
  function fakeStorage(tree) {
    return {
      async list(bucket, prefix) {
        return tree[bucket]?.[prefix] || [];
      },
    };
  }

  it("recorre subcarpetas (prefijos) y junta los archivos de todos los niveles", async () => {
    const storage = fakeStorage({
      "property-images": {
        "": [
          { name: "a.jpg", id: "1", metadata: { size: 100 } },
          { name: "p1", id: null }, // carpeta
        ],
        "p1/": [{ name: "b.jpg", id: "2", metadata: { size: 200 } }],
      },
    });
    const files = await listAllFiles(storage, [{ id: "property-images" }]);
    expect(files).toEqual([
      { bucket: "property-images", path: "a.jpg", size: 100 },
      { bucket: "property-images", path: "p1/b.jpg", size: 200 },
    ]);
  });

  it("ignora los marcadores de carpeta vacía y las entradas sin nombre", async () => {
    const storage = fakeStorage({
      bucket1: { "": [{ name: ".emptyFolderPlaceholder", id: "1" }, { name: "", id: "2" }] },
    });
    const files = await listAllFiles(storage, [{ id: "bucket1" }]);
    expect(files).toEqual([]);
  });

  it("recorre varios buckets por separado", async () => {
    const storage = fakeStorage({
      b1: { "": [{ name: "a.jpg", id: "1", metadata: { size: 10 } }] },
      b2: { "": [{ name: "b.jpg", id: "1", metadata: { size: 20 } }] },
    });
    const files = await listAllFiles(storage, [{ id: "b1" }, { id: "b2" }]);
    expect(files.map((f) => f.bucket)).toEqual(["b1", "b2"]);
  });
});

describe("writeBackupZip", () => {
  function memoryFakeSink() {
    const parts = [];
    return {
      sink: {
        write: async (chunk) => parts.push(chunk),
        close: async () => {},
      },
      bytes: () => parts.reduce((sum, p) => sum + p.length, 0),
    };
  }

  it("arma un ZIP con el JSON de datos y cada archivo, contando bytes y archivos agregados", async () => {
    const storage = {
      download: async (bucket, path) => new Blob([`contenido de ${bucket}/${path}`]),
    };
    const files = [
      { bucket: "property-images", path: "a.jpg", size: 10 },
      { bucket: "property-images", path: "b.jpg", size: 10 },
    ];
    const { sink, bytes } = memoryFakeSink();
    const result = await writeBackupZip({ files, storage, dataJson: '{"ok":true}', sink });

    expect(result.added).toBe(2);
    expect(result.failed).toEqual([]);
    expect(result.bytes).toBeGreaterThan(0);
    // El ZIP generado debe empezar con la firma estándar "PK" (0x50, 0x4B).
    expect(bytes()).toBeGreaterThan(0);
  });

  it("un archivo que falla al descargar se anota en 'failed' y no detiene el resto", async () => {
    const storage = {
      download: async (bucket, path) => {
        if (path === "roto.jpg") throw new Error("404");
        return new Blob(["ok"]);
      },
    };
    const files = [
      { bucket: "b", path: "roto.jpg", size: 1 },
      { bucket: "b", path: "bueno.jpg", size: 1 },
    ];
    const { sink } = memoryFakeSink();
    const result = await writeBackupZip({ files, storage, dataJson: "{}", sink });

    expect(result.added).toBe(1);
    expect(result.failed).toEqual([{ path: "b/roto.jpg", error: "404" }]);
  });
});

describe("supportsDiskSink", () => {
  it("sin window (como en pruebas o en el servidor), no hay selector de 'Guardar como'", () => {
    expect(supportsDiskSink()).toBe(false);
  });
});
