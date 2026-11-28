import { describe, expect, it, vi } from "vitest";
import { BATCH_SIZE, runPapeleriaPurge } from "./handler";

const doc = (id, path = `c/${id}.jpg`) => ({ kind: "documento", id, bucket: "client-documents", file_path: path });
const expediente = (id) => ({ kind: "expediente", id, bucket: "agenda-expedientes", file_path: `e/${id}.pdf` });

function deps(overrides = {}) {
  return {
    removeFiles: vi.fn(async () => ({ failed: [] })),
    deleteRows: vi.fn(async () => {}),
    ...overrides,
  };
}

describe("runPapeleriaPurge", () => {
  it("por omisión es un simulacro: cuenta lo vencido por tipo y no borra nada", async () => {
    const d = deps();
    const summary = await runPapeleriaPurge({ due: [doc("1"), doc("2"), expediente("3")], enabled: false, ...d });
    expect(summary).toEqual({ dryRun: true, due: 3, deleted: 0, filesFailed: 0, byKind: { documento: 2, expediente: 1 } });
    expect(d.removeFiles).not.toHaveBeenCalled();
    expect(d.deleteRows).not.toHaveBeenCalled();
  });

  it("sin nada vencido no toca nada, ni activada", async () => {
    const d = deps();
    const summary = await runPapeleriaPurge({ due: [], enabled: true, ...d });
    expect(summary).toMatchObject({ dryRun: false, due: 0, deleted: 0 });
    expect(d.removeFiles).not.toHaveBeenCalled();
  });

  it("activada: borra primero los archivos de cada cubeta y después las filas de cada tabla", async () => {
    const order = [];
    const d = deps({
      removeFiles: vi.fn(async (bucket, paths) => {
        order.push(`archivos:${bucket}:${paths.length}`);
        return { failed: [] };
      }),
      deleteRows: vi.fn(async (table, ids) => {
        order.push(`filas:${table}:${ids.length}`);
      }),
    });
    const summary = await runPapeleriaPurge({ due: [doc("1"), doc("2"), expediente("3")], enabled: true, ...d });
    expect(summary).toMatchObject({ dryRun: false, due: 3, deleted: 3, filesFailed: 0 });
    expect(order).toEqual(["archivos:client-documents:2", "archivos:agenda-expedientes:1", "filas:client_documents:2", "filas:agenda_expedientes:1"]);
  });

  it("si un archivo no se pudo borrar, su fila se queda para el siguiente intento", async () => {
    const d = deps({ removeFiles: vi.fn(async (bucket) => ({ failed: bucket === "client-documents" ? ["c/2.jpg"] : [] })) });
    const summary = await runPapeleriaPurge({ due: [doc("1"), doc("2"), expediente("3")], enabled: true, ...d });
    expect(summary).toMatchObject({ deleted: 2, filesFailed: 1 });
    expect(d.deleteRows).toHaveBeenCalledWith("client_documents", ["1"]);
    expect(d.deleteRows).toHaveBeenCalledWith("agenda_expedientes", ["3"]);
  });

  it("una fila sin archivo (file_path vacío) se borra sin pedirle nada al almacenamiento", async () => {
    const d = deps();
    await runPapeleriaPurge({ due: [doc("1", null)], enabled: true, ...d });
    expect(d.removeFiles).not.toHaveBeenCalled();
    expect(d.deleteRows).toHaveBeenCalledWith("client_documents", ["1"]);
  });

  it("trabaja por lotes", async () => {
    const due = Array.from({ length: BATCH_SIZE + 5 }, (_, i) => doc(String(i)));
    const d = deps();
    const summary = await runPapeleriaPurge({ due, enabled: true, ...d });
    expect(summary.deleted).toBe(BATCH_SIZE + 5);
    expect(d.deleteRows).toHaveBeenCalledTimes(2);
  });
});
