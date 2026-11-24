// Aplica las migraciones de supabase/migrations/ a una base de datos, llevando la cuenta de las que ya se aplicaron en
// supabase_migrations.schema_migrations (la misma tabla que usa la CLI de Supabase). Necesita `psql` y DATABASE_URL
// (en Supabase: Project Settings → Database → Connection string, la «Session pooler» o la directa).
//
//   node scripts/migrate.mjs status                     qué está aplicado y qué falta
//   node scripts/migrate.mjs up [--to 0100] [--dry-run] aplica lo pendiente, en orden, cada una en su transacción
//   node scripts/migrate.mjs baseline --through 0114    marca como aplicadas (SIN ejecutarlas) las migraciones hasta esa
//                                                       versión: para una base que ya las tiene (la de producción de hoy)
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { parseMigrationFileName, planMigrations } from "./schemaMigrations.js";

const DIR = new URL("../supabase/migrations/", import.meta.url);
const files = readdirSync(DIR).filter((f) => parseMigrationFileName(f));
const [command = "status", ...rest] = process.argv.slice(2);
const option = (name) => {
  const i = rest.indexOf(name);
  return i === -1 ? undefined : rest[i + 1];
};

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Falta DATABASE_URL (la cadena de conexión de la base).");
  process.exit(2);
}

function psql(args, { capture = false } = {}) {
  const run = spawnSync("psql", [url, "-v", "ON_ERROR_STOP=1", "-q", "-X", ...args], { encoding: "utf8" });
  if (run.status !== 0) {
    console.error(run.stderr || run.stdout);
    process.exit(1);
  }
  return capture ? run.stdout : "";
}

const quote = (text) => `'${String(text).replace(/'/g, "''")}'`;

psql(["-c", "create schema if not exists supabase_migrations; create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);"]);
const applied = psql(["-At", "-c", "select version from supabase_migrations.schema_migrations order by version"], { capture: true })
  .split("\n")
  .map((l) => l.trim())
  .filter(Boolean);

if (command === "status") {
  const all = files.sort();
  const done = new Set(applied);
  for (const file of all) console.log(`${done.has(parseMigrationFileName(file).version) ? "✔" : "·"} ${file}`);
  const pending = planMigrations(files, applied);
  console.log(`\n${all.length - pending.length} aplicadas, ${pending.length} pendientes.`);
} else if (command === "up") {
  const pending = planMigrations(files, applied, { to: option("--to") });
  if (pending.length === 0) {
    console.log("Nada pendiente.");
  } else if (rest.includes("--dry-run")) {
    console.log(`Se aplicarían ${pending.length}:\n${pending.map((m) => `  ${m.file}`).join("\n")}`);
  } else {
    for (const m of pending) {
      process.stdout.write(`Aplicando ${m.file}… `);
      psql(["--single-transaction", "-f", new URL(m.file, DIR).pathname, "-c", `insert into supabase_migrations.schema_migrations (version, name) values (${quote(m.version)}, ${quote(m.name)})`]);
      console.log("ok");
    }
  }
} else if (command === "baseline") {
  const through = option("--through");
  if (!through) {
    console.error("Indica hasta qué versión: baseline --through 0114");
    process.exit(2);
  }
  const toMark = planMigrations(files, applied, { to: through });
  for (const m of toMark) {
    psql(["-c", `insert into supabase_migrations.schema_migrations (version, name) values (${quote(m.version)}, ${quote(m.name)}) on conflict do nothing`]);
  }
  console.log(`${toMark.length} migraciones marcadas como aplicadas (sin ejecutarlas).`);
} else {
  console.error(`Comando desconocido: ${command}. Usa status, up o baseline.`);
  process.exit(2);
}
