// Presupuesto de peso del paquete: corre después de `npm run build` y falla si el sitio pesa más de lo acordado
// (scripts/bundle-budget.json). Para subir un tope hay que decidirlo a propósito en un PR, no por accidente.
import { readFileSync, readdirSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { checkBudget, initialAssets } from "./bundleBudgetLib.js";

const dist = new URL("../dist/", import.meta.url);
const budget = JSON.parse(readFileSync(new URL("./bundle-budget.json", import.meta.url), "utf8"));
const initial = initialAssets(readFileSync(new URL("index.html", dist), "utf8"));
const sizes = readdirSync(new URL("assets/", dist))
  .filter((f) => /\.(js|css)$/.test(f))
  .map((f) => ({ file: `assets/${f}`, gzipBytes: gzipSync(readFileSync(new URL(`assets/${f}`, dist)), { level: 9 }).length }));

const { problems, initialJsKB, initialCssKB } = checkBudget({ initial, sizes, budget });
console.log(`Carga inicial: ${initialJsKB} KB de JavaScript y ${initialCssKB} KB de CSS (gzip). Topes: ${budget.initialJsGzipKB} y ${budget.initialCssGzipKB} KB.`);
if (problems.length) {
  console.error(`\nPresupuesto excedido:\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log("Dentro del presupuesto.");
