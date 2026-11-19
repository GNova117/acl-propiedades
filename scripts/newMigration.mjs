// Crea la siguiente migración vacía con su encabezado: npm run migration:new -- "Título de lo que hace"
// Después: escribe el SQL (re-ejecutable si se puede), corre `npm run schema:build` y sube ambos archivos.
import { readdirSync, writeFileSync } from "node:fs";
import { migrationFileName, parseMigrationFileName } from "./schemaMigrations.js";

const title = process.argv.slice(2).join(" ").trim();
if (!title) {
  console.error('Uso: npm run migration:new -- "Título de lo que hace"');
  process.exit(2);
}
const dir = new URL("../supabase/migrations/", import.meta.url);
const count = readdirSync(dir).filter((f) => parseMigrationFileName(f)).length;
const date = new Date().toISOString().slice(0, 10);
const file = migrationFileName(count, title);
const rule = "-- ─────────────────────────────────────────────";
writeFileSync(
  new URL(file, dir),
  `\n${rule}\n-- ${title} (${date})\n-- (Explica aquí qué cambia y por qué.)\n-- (bloque re-ejecutable: usa «if not exists», «create or replace», «drop policy if exists»…)\n${rule}\n\n`,
);
console.log(`Creada supabase/migrations/${file}\nSiguiente: escribe el SQL, corre \`npm run schema:build\` y sube ambos.`);
