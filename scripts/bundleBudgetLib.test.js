import { describe, expect, it } from "vitest";
import { checkBudget, initialAssets } from "./bundleBudgetLib";

const html = `<!doctype html><html><head>
<link rel="icon" href="/favicon.svg" />
<script type="module" crossorigin src="/assets/index-AAA.js"></script>
<link rel="modulepreload" crossorigin href="/assets/vendor-BBB.js">
<link rel="stylesheet" crossorigin href="/assets/index-CCC.css">
<link rel="manifest" href="/manifest.webmanifest" />
<script src="https://www.googletagmanager.com/gtag/js"></script>
</head></html>`;

describe("initialAssets", () => {
  it("toma el script de entrada, los módulos precargados y los estilos; ignora lo externo y el resto", () => {
    expect(initialAssets(html)).toEqual({ scripts: ["assets/index-AAA.js", "assets/vendor-BBB.js"], styles: ["assets/index-CCC.css"] });
  });
  it("sin nada devuelve listas vacías", () => {
    expect(initialAssets("")).toEqual({ scripts: [], styles: [] });
  });
});

describe("checkBudget", () => {
  const initial = { scripts: ["assets/index-AAA.js", "assets/vendor-BBB.js"], styles: ["assets/index-CCC.css"] };
  const KB = 1024;
  const sizes = [
    { file: "assets/index-AAA.js", gzipBytes: 100 * KB },
    { file: "assets/vendor-BBB.js", gzipBytes: 50 * KB },
    { file: "assets/index-CCC.css", gzipBytes: 8 * KB },
    { file: "assets/Visor3D-DDD.js", gzipBytes: 200 * KB },
  ];
  const budget = { initialJsGzipKB: 160, initialCssGzipKB: 10, maxChunkGzipKB: 250 };

  it("dentro del presupuesto no hay problemas y suma lo inicial", () => {
    expect(checkBudget({ initial, sizes, budget })).toEqual({ problems: [], initialJsKB: 150, initialCssKB: 8 });
  });
  it("avisa del JS inicial, del CSS inicial y de un archivo diferido demasiado grande", () => {
    const { problems } = checkBudget({ initial, sizes, budget: { initialJsGzipKB: 120, initialCssGzipKB: 5, maxChunkGzipKB: 150 } });
    expect(problems).toHaveLength(3);
    expect(problems.join("\n")).toMatch(/JavaScript inicial: 150 KB.*120 KB/);
    expect(problems.join("\n")).toMatch(/CSS inicial/);
    expect(problems.join("\n")).toMatch(/Visor3D-DDD\.js: 200 KB/);
  });
  it("un archivo inicial grande no se cuenta dos veces como «diferido»", () => {
    const { problems } = checkBudget({ initial, sizes, budget: { ...budget, maxChunkGzipKB: 60 } });
    expect(problems.some((p) => p.includes("index-AAA"))).toBe(false);
  });
});
