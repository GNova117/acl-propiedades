// Verificación de tipos del código JavaScript, de forma gradual. El proyecto tiene ~60 archivos TypeScript (que pasan en
// modo estricto con `tsc -p tsconfig.json`) y ~500 de JavaScript, que de golpe darían cientos de errores. Aquí se revisan,
// con reglas más suaves (tsconfig.js.json), solo los archivos de scripts/typecheck-js-files.txt, y se falla únicamente si
// hay errores EN ELLOS. La lista solo debe crecer: al dejar limpio otro archivo se agrega y de ahí en adelante no puede
// romperse. Para ver cuáles están listos: `npm run typecheck:js -- --candidates`.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { parseTscErrors, summarize } from "./typecheckJsLib.js";

const listed = readFileSync(new URL("./typecheck-js-files.txt", import.meta.url), "utf8")
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith("#"));

// Todos los .js (sin pruebas) de las carpetas que revisa tsconfig.js.json.
function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = `${dir}/${name}`;
    if (statSync(path).isDirectory()) return name === "node_modules" ? [] : sourceFiles(path);
    return path.endsWith(".js") && !path.endsWith(".test.js") ? [path] : [];
  });
}
const everything = [...sourceFiles("src"), ...sourceFiles("server"), ...sourceFiles("api"), "middleware.js"].filter(existsSync);

const missing = listed.filter((file) => !existsSync(file));
if (missing.length) {
  console.error(`Archivos de la lista que ya no existen (quítalos de scripts/typecheck-js-files.txt):\n  ${missing.join("\n  ")}`);
  process.exit(1);
}

const run = spawnSync("npx", ["tsc", "-p", "tsconfig.js.json", "--pretty", "false"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const errors = parseTscErrors(`${run.stdout}\n${run.stderr}`);
const { failing, candidates } = summarize(errors, listed, everything);

if (process.argv.includes("--candidates")) {
  console.log(candidates.join("\n"));
  process.exit(0);
}

if (failing.length) {
  console.error(`Errores de tipos en ${new Set(failing.map((e) => e.file)).size} archivo(s) de la lista:`);
  for (const e of failing.slice(0, 50)) console.error(`  ${e.file}(${e.line},${e.col}): ${e.code} ${e.message}`);
  process.exit(1);
}
console.log(`Tipos de JavaScript: ${listed.length} archivos revisados, sin errores. (${candidates.length} más podrían sumarse: npm run typecheck:js -- --candidates)`);
