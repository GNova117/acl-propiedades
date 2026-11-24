// Prueba el SQL del proyecto contra una base de datos de pruebas (NUNCA la de producción): corre cada archivo de
// supabase/testdb/tests/*.sql con psql (los archivos usan `assert` y fallan si algo no se cumple; los que modifican datos
// terminan en rollback). Antes hay que preparar la base: ver supabase/testdb/README.md (`npm run db:test:setup`).
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Falta DATABASE_URL de la base de PRUEBAS.");
  process.exit(2);
}
if (/supabase\.co|pooler\.supabase/i.test(url) && !process.env.ALLOW_REMOTE_TEST_DB) {
  console.error("DATABASE_URL parece una base de Supabase. Estas pruebas crean y revierten datos: úsalas solo en una base de pruebas (o define ALLOW_REMOTE_TEST_DB=1 si es tu proyecto de pruebas).");
  process.exit(2);
}

const dir = new URL("../supabase/testdb/tests/", import.meta.url);
const tests = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
let failed = 0;
for (const file of tests) {
  const run = spawnSync("psql", [url, "-v", "ON_ERROR_STOP=1", "-q", "-X", "-f", new URL(file, dir).pathname], { encoding: "utf8" });
  if (run.status === 0) {
    console.log(`✔ ${file}`);
  } else {
    failed += 1;
    console.log(`✘ ${file}\n${(run.stderr || run.stdout).trim().split("\n").filter((l) => !/^NOTICE/.test(l)).join("\n")}`);
  }
}
console.log(`\n${tests.length - failed} de ${tests.length} pruebas de SQL pasan.`);
process.exit(failed ? 1 : 0);
