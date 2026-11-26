// Genera supabase/pendiente-de-aplicar-0118-en-adelante.sql: TODO el SQL nuevo de esta rama junto, para pegarlo una sola vez.
//   node scripts/buildPendingSql.mjs [--from 0118]     regenera el archivo
//   node scripts/buildPendingSql.mjs --check           falla si el archivo no está al día (lo vigila una prueba)
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { buildPendingSql } from "./pendingSqlLib.js";
import { parseMigrationFileName } from "./schemaMigrations.js";

const DIR = new URL("../supabase/migrations/", import.meta.url);
const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
};
const from = Number(arg("--from") || "118");
const out = new URL(`../supabase/pendiente-de-aplicar-${String(from).padStart(4, "0")}-en-adelante.sql`, import.meta.url);

const files = readdirSync(DIR)
  .filter((name) => parseMigrationFileName(name))
  .sort()
  .map((name) => ({ name, sql: readFileSync(new URL(name, DIR), "utf8") }));
const sql = buildPendingSql(files, from);

if (process.argv.includes("--check")) {
  let current = "";
  try {
    current = readFileSync(out, "utf8");
  } catch {
    /* no existe */
  }
  if (current !== sql) {
    console.error("El SQL pendiente no está al día. Corre `npm run sql:pendiente` y sube el resultado.");
    process.exit(1);
  }
  console.log("SQL pendiente al día.");
} else {
  writeFileSync(out, sql);
  console.log(`${out.pathname.split("/").pop()} regenerado (${sql.split("\n").length} líneas).`);
}
