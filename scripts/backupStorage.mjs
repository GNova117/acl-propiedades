// Respalda los archivos de Supabase Storage (fotos, INE, PDFs…) a una carpeta local. Uso:
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/backupStorage.mjs [carpeta-de-salida]
// Opcionales: BACKUP_BUCKETS (lista separada por comas; por omisión todos los de la app), BACKUP_MAX_GB (tope total, 2 por omisión).
// La llave de servicio lee TODO el Storage: úsala solo en el servidor de respaldos (secreto de GitHub), nunca en el navegador.
import { mkdirSync, writeFileSync, createWriteStream } from "node:fs";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { listBucketFiles, planDownloads, safeRelativePath } from "./storageBackupLib.js";

const BUCKETS = ["client-documents", "agenda-expedientes", "construccion-fondos", "construccion-fotos", "inspection-photos", "property-log-files", "property-images", "property-videos", "property-360", "advisor-photos", "blog-images"];

const base = process.env.SUPABASE_URL?.replace(/\/$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!base || !key) {
  console.error("Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(2);
}
const out = process.argv[2] || "backup/storage";
const buckets = (process.env.BACKUP_BUCKETS || BUCKETS.join(",")).split(",").map((b) => b.trim()).filter(Boolean);
const maxBytes = Math.round(Number(process.env.BACKUP_MAX_GB || 2) * 1024 ** 3);
const headers = { Authorization: `Bearer ${key}`, apikey: key };

const listPageFor = (bucket) => async (prefix, offset) => {
  const res = await fetch(`${base}/storage/v1/object/list/${bucket}`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ prefix, limit: 100, offset, sortBy: { column: "name", order: "asc" } }),
  });
  if (res.status === 404) return []; // el bucket no existe en este proyecto
  if (!res.ok) throw new Error(`No se pudo listar ${bucket}/${prefix}: HTTP ${res.status}`);
  return res.json();
};

const manifest = { startedAt: new Date().toISOString(), buckets: {} };
let remaining = maxBytes;
let failures = 0;

for (const bucket of buckets) {
  const files = await listBucketFiles(listPageFor(bucket));
  const { chosen, skipped, bytes } = planDownloads(files, remaining);
  remaining -= bytes;
  const entry = { files: files.length, downloaded: 0, bytes: 0, skippedForSize: skipped.length, failed: [] };
  for (const file of chosen) {
    try {
      const res = await fetch(`${base}/storage/v1/object/${bucket}/${file.path.split("/").map(encodeURIComponent).join("/")}`, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const target = join(out, bucket, safeRelativePath(file.path));
      mkdirSync(dirname(target), { recursive: true });
      await pipeline(Readable.fromWeb(res.body), createWriteStream(target));
      entry.downloaded += 1;
      entry.bytes += file.size;
    } catch (err) {
      failures += 1;
      entry.failed.push({ path: file.path, error: String(err.message || err) });
    }
  }
  manifest.buckets[bucket] = entry;
  console.log(`${bucket}: ${entry.downloaded}/${files.length} archivos, ${(entry.bytes / 1024 ** 2).toFixed(1)} MB${skipped.length ? `, ${skipped.length} omitidos por el tope` : ""}${entry.failed.length ? `, ${entry.failed.length} con error` : ""}`);
}

mkdirSync(out, { recursive: true });
manifest.finishedAt = new Date().toISOString();
writeFileSync(join(out, "manifest.json"), JSON.stringify(manifest, null, 2));
const skippedAny = Object.values(manifest.buckets).some((b) => b.skippedForSize > 0);
if (failures > 0 || skippedAny) {
  console.error(`\nRespaldo INCOMPLETO: ${failures} archivo(s) con error${skippedAny ? " y archivos omitidos por el tope de tamaño (sube BACKUP_MAX_GB)" : ""}. Ver manifest.json.`);
  process.exit(1);
}
