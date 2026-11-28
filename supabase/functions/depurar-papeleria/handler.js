// Depuración de la papelería de clientes cumplidos los 3 años (ver la migración 0123). La lógica vive aquí, con las dependencias
// inyectadas, para probarla sin Deno.
//
// POR OMISIÓN ES UN SIMULACRO: cuenta lo vencido y lo registra, sin borrar nada. Solo con `enabled: true`
// (RETENTION_PURGE_ENABLED=true en la función) se borran los archivos y después sus filas. Primero el archivo y luego la fila: si el
// archivo no se pudo borrar, la fila se queda para el siguiente intento (así nunca queda un archivo huérfano sin registro).

export const BATCH_SIZE = 100;

const KIND_TABLE = { documento: "client_documents", expediente: "agenda_expedientes" };

// `due`: [{ kind, id, bucket, file_path }]. Devuelve el resumen de la corrida.
export async function runPapeleriaPurge({ due, enabled, removeFiles, deleteRows }) {
  const summary = { dryRun: !enabled, due: due.length, deleted: 0, filesFailed: 0, byKind: {} };
  for (const item of due) summary.byKind[item.kind] = (summary.byKind[item.kind] || 0) + 1;
  if (!enabled || due.length === 0) return summary;

  for (let i = 0; i < due.length; i += BATCH_SIZE) {
    const batch = due.slice(i, i + BATCH_SIZE);

    // 1) Archivos, por cubeta.
    const failedPaths = new Set();
    const byBucket = new Map();
    for (const item of batch) {
      if (!item.file_path) continue;
      byBucket.set(item.bucket, [...(byBucket.get(item.bucket) || []), item.file_path]);
    }
    for (const [bucket, paths] of byBucket) {
      const result = await removeFiles(bucket, paths);
      for (const path of result?.failed || []) failedPaths.add(`${bucket}/${path}`);
    }
    summary.filesFailed += failedPaths.size;

    // 2) Filas, solo de lo que ya no tiene archivo.
    const deletable = batch.filter((item) => !item.file_path || !failedPaths.has(`${item.bucket}/${item.file_path}`));
    for (const kind of Object.keys(KIND_TABLE)) {
      const ids = deletable.filter((item) => item.kind === kind).map((item) => item.id);
      if (ids.length === 0) continue;
      await deleteRows(KIND_TABLE[kind], ids);
      summary.deleted += ids.length;
    }
  }
  return summary;
}
