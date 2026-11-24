// Parte pura del respaldo de archivos de Supabase Storage (scripts/backupStorage.mjs): recorrer un bucket (sus carpetas) y
// decidir qué se baja según un tope de tamaño. El acceso a la red se inyecta para poder probarlo.
const PAGE = 100;

// listPage(prefix, offset) → [{ name, id, metadata: { size } }] ; las carpetas vienen con id null.
// → [{ path, size }] con la ruta completa de cada archivo, en orden.
export async function listBucketFiles(listPage, prefix = "") {
  const files = [];
  for (let offset = 0; ; offset += PAGE) {
    const items = await listPage(prefix, offset);
    for (const item of items) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null || item.id === undefined) files.push(...(await listBucketFiles(listPage, path)));
      else files.push({ path, size: Number(item.metadata?.size) || 0 });
    }
    if (items.length < PAGE) break;
  }
  return files;
}

// Elige qué archivos bajar sin pasar de `maxBytes` en total (los más recientes primero NO se conocen aquí: se respeta el orden
// recibido). → { chosen, skipped, bytes }
export function planDownloads(files, maxBytes) {
  const chosen = [];
  const skipped = [];
  let bytes = 0;
  for (const file of files) {
    if (bytes + file.size <= maxBytes) {
      chosen.push(file);
      bytes += file.size;
    } else {
      skipped.push(file);
    }
  }
  return { chosen, skipped, bytes };
}

// Que una ruta de Storage no pueda escribir fuera de la carpeta de salida (../ o rutas absolutas).
export function safeRelativePath(path) {
  const parts = String(path).split("/").filter((p) => p && p !== "." && p !== "..");
  return parts.join("/");
}
