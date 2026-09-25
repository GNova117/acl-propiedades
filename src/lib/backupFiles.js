// Núcleo del respaldo con archivos: lista los archivos del Storage y los va
// metiendo a un ZIP en flujo (sin armar todo el ZIP en memoria). No importa
// Supabase ni el navegador: recibe adaptadores (`storage` y `sink`), así se
// puede probar aparte con archivos de mentira.
//
// storage.list(bucket, prefix)      → [{ name, id, metadata: { size } }]  (id vacío = carpeta)
// storage.download(bucket, path)    → Blob
// sink.write(Uint8Array) / sink.close()

import { Zip, ZipDeflate, ZipPassThrough, strToU8 } from "fflate";

// `heavy`: solo con la casilla "incluir videos" (pueden pesar cientos de MB).
export const STORAGE_BUCKETS = [
  { id: "property-images" },
  { id: "advisor-photos" },
  { id: "client-documents" },
  { id: "remodel-progress" },
  { id: "agenda-expedientes" },
  { id: "property-log-files" },
  { id: "property-videos", heavy: true },
];

// Recorre el bucket completo (las "carpetas" de Storage son prefijos).
export async function listAllFiles(storage, buckets, { signal } = {}) {
  const files = [];
  const walk = async (bucket, prefix) => {
    if (signal?.aborted) throw new DOMException("Cancelado", "AbortError");
    const entries = await storage.list(bucket, prefix);
    for (const entry of entries) {
      if (!entry.name || entry.name === ".emptyFolderPlaceholder") continue;
      if (entry.id == null) await walk(bucket, `${prefix}${entry.name}/`);
      else files.push({ bucket, path: `${prefix}${entry.name}`, size: Number(entry.metadata?.size) || 0 });
    }
  };
  for (const bucket of buckets) await walk(bucket.id, "");
  return files;
}

// Escribe el ZIP: `datos/respaldo.json` + un archivo por cada elemento de `files`
// (carpeta = nombre del bucket). Un archivo que falla no detiene el respaldo:
// se anota en `failed` y sigue.
export async function writeBackupZip({ files, storage, dataJson, sink, onProgress, signal }) {
  let pending = Promise.resolve();
  let zipError = null;
  const zip = new Zip((err, chunk) => {
    if (err) {
      zipError = err;
      return;
    }
    pending = pending.then(() => sink.write(chunk));
  });

  const failed = [];
  let added = 0;
  let bytes = 0;

  // JSON de datos (se comprime; las fotos y PDFs ya vienen comprimidos).
  const dataEntry = new ZipDeflate("datos/respaldo.json", { level: 6 });
  zip.add(dataEntry);
  dataEntry.push(strToU8(dataJson), true);
  await pending;

  for (let i = 0; i < files.length; i++) {
    if (signal?.aborted) throw new DOMException("Cancelado", "AbortError");
    const file = files[i];
    onProgress?.({ phase: "files", done: i, total: files.length, name: `${file.bucket}/${file.path}` });
    try {
      const blob = await storage.download(file.bucket, file.path);
      const entry = new ZipPassThrough(`${file.bucket}/${file.path}`);
      zip.add(entry);
      const reader = blob.stream().getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.length;
        entry.push(value, false);
      }
      entry.push(new Uint8Array(0), true);
      added += 1;
    } catch (err) {
      if (err?.name === "AbortError") throw err;
      failed.push({ path: `${file.bucket}/${file.path}`, error: err?.message || String(err) });
    }
    await pending; // no acumular en memoria más de un archivo
    if (zipError) throw zipError;
  }

  if (failed.length > 0) {
    const report = new ZipDeflate("datos/archivos_no_descargados.json", { level: 6 });
    zip.add(report);
    report.push(strToU8(JSON.stringify(failed, null, 2)), true);
  }

  zip.end();
  await pending;
  if (zipError) throw zipError;
  await sink.close();
  return { added, failed, bytes };
}

// Destinos ────────────────────────────────────────────────────────────────

// Guarda directo en disco (Chrome, Edge, Brave): no ocupa memoria y aguanta
// respaldos grandes. showSaveFilePicker exige haber sido llamado desde un clic.
export async function createDiskSink(suggestedName) {
  const handle = await window.showSaveFilePicker({
    suggestedName,
    types: [{ description: "Archivo ZIP", accept: { "application/zip": [".zip"] } }],
  });
  const writable = await handle.createWritable();
  return { write: (chunk) => writable.write(chunk), close: () => writable.close(), abort: () => writable.abort().catch(() => {}), kind: "disk" };
}

// Alternativa sin File System Access: junta el ZIP en memoria y lo descarga al final.
export function createMemorySink(fileName) {
  const parts = [];
  return {
    kind: "memory",
    async abort() {
      parts.length = 0;
    },
    async write(chunk) {
      parts.push(chunk.slice());
    },
    async close() {
      const url = URL.createObjectURL(new Blob(parts, { type: "application/zip" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    },
  };
}

export const supportsDiskSink = () => typeof window !== "undefined" && typeof window.showSaveFilePicker === "function";

// Sobre cuántos MB el respaldo en memoria deja de ser prudente.
export const MEMORY_LIMIT_BYTES = 400 * 1024 * 1024;
