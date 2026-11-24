// Mantiene supabase/schema.sql (para pegar en el SQL Editor) y supabase/migrations/ (para aplicar por pasos) en sincronía.
//   node scripts/buildSchema.mjs            → regenera schema.sql uniendo las migraciones
//   node scripts/buildSchema.mjs --check    → falla si schema.sql no es exactamente la unión (lo corre CI)
//   node scripts/buildSchema.mjs --split    → UNA VEZ: parte el schema.sql actual en migraciones (ya hecho; no repetir)
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { migrationFileName, parseMigrationFileName, splitSchema } from "./schemaMigrations.js";

const DIR = new URL("../supabase/migrations/", import.meta.url);
const SCHEMA = new URL("../supabase/schema.sql", import.meta.url);

const migrationFiles = () =>
  existsSync(DIR)
    ? readdirSync(DIR).filter((f) => parseMigrationFileName(f)).sort()
    : [];

const joined = () => migrationFiles().map((f) => readFileSync(new URL(f, DIR), "utf8")).join("");

if (process.argv.includes("--split")) {
  if (migrationFiles().length) {
    console.error("supabase/migrations ya tiene archivos: no se vuelve a partir. Agrega migraciones nuevas a mano.");
    process.exit(1);
  }
  mkdirSync(DIR, { recursive: true });
  const parts = splitSchema(readFileSync(SCHEMA, "utf8"));
  parts.forEach((part, i) => writeFileSync(new URL(migrationFileName(i, part.title), DIR), part.sql));
  console.log(`${parts.length} migraciones creadas en supabase/migrations/`);
} else if (process.argv.includes("--check")) {
  if (joined() !== readFileSync(SCHEMA, "utf8")) {
    console.error("supabase/schema.sql no coincide con supabase/migrations/. Corre `npm run schema:build` y sube el resultado.");
    process.exit(1);
  }
  console.log(`schema.sql está en sincronía con ${migrationFiles().length} migraciones.`);
} else {
  writeFileSync(SCHEMA, joined());
  console.log(`schema.sql regenerado a partir de ${migrationFiles().length} migraciones.`);
}
