// Junta en UN solo archivo el SQL de las migraciones nuevas (desde una versión en adelante) para pegarlo completo, una sola vez, en el
// SQL Editor de Supabase. Cada migración es re-ejecutable y van en orden. Al final se anotan como aplicadas (para `npm run db:migrate`).
import { parseMigrationFileName } from "./schemaMigrations.js";

const quote = (text) => `'${String(text).replace(/'/g, "''")}'`;

// files: [{ name: "0118_xxx.sql", sql }] ya ordenados. from: número de la primera migración a incluir.
export function buildPendingSql(files, from) {
  const selected = files
    .map((file) => ({ ...file, parsed: parseMigrationFileName(file.name) }))
    .filter((file) => file.parsed && Number(file.parsed.version) >= from);
  if (selected.length === 0) return "";
  const first = selected[0].parsed.version;
  const last = selected[selected.length - 1].parsed.version;
  const header =
    `-- ─────────────────────────────────────────────\n` +
    `-- SQL PENDIENTE DE APLICAR en Supabase — migraciones ${first} a ${last} (${selected.length} archivos), todo junto.\n` +
    `-- Pégalo COMPLETO en el SQL Editor y ejecútalo UNA vez. Cada bloque es re-ejecutable y van en orden: lo que ya exista se respeta.\n` +
    `-- Al final anota las migraciones como aplicadas y devuelve la cuenta. Se genera con \`npm run sql:pendiente\`; no lo edites a mano.\n` +
    `-- ─────────────────────────────────────────────\n\n`;
  const body = selected.map((file) => file.sql.replace(/\s+$/, "") + "\n").join("\n");
  const marks =
    `\n-- ── Anotar como aplicadas (para llevar la cuenta con \`npm run db:migrate\`) ──\n` +
    `create schema if not exists supabase_migrations;\n` +
    `create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);\n` +
    `insert into supabase_migrations.schema_migrations (version, name) values\n` +
    selected.map((file, i) => `  (${quote(file.parsed.version)}, ${quote(file.parsed.name)})${i === selected.length - 1 ? "" : ","}`).join("\n") +
    `\non conflict (version) do nothing;\n\n` +
    `-- Comprobación: debe devolver ${last} (la última versión anotada).\n` +
    `select max(version) as ultima_migracion_anotada from supabase_migrations.schema_migrations;\n`;
  return header + body + marks;
}
