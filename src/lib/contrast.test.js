import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { composite, contrastRatio, cssVariables, parseColor } from "./contrast";

// Revisión de contraste (WCAG 2.x AA) de las parejas de colores del sitio, en claro y en oscuro: 4.5:1 para texto normal y
// 3:1 para lo que no es texto (iconos, bordes de controles). Si un color nuevo no se lee, esta prueba falla.
const srcDir = new URL("../", import.meta.url).pathname;
const css = readFileSync(new URL("../index.css", import.meta.url), "utf8");
const light = cssVariables(css.slice(css.indexOf(":root {"), css.indexOf('[data-theme="dark"]')));
const dark = { ...light, ...cssVariables(css.slice(css.indexOf('[data-theme="dark"]'), css.indexOf("* {"))) };
const color = (vars, name) => {
  const c = parseColor(vars[name]);
  if (!c) throw new Error(`No se pudo leer ${name}: ${vars[name]}`);
  return c;
};

// [texto, fondo]
const TEXT_PAIRS = [
  ["--color-text", "--color-bg"],
  ["--color-text", "--color-surface"],
  ["--color-text", "--color-bg-alt"],
  ["--color-text-muted", "--color-bg"],
  ["--color-text-muted", "--color-surface"],
  ["--color-text-muted", "--color-bg-alt"],
  ["--color-primary", "--color-bg"],
  ["--color-primary", "--color-surface"],
  ["--color-primary", "--color-bg-alt"],
  ["--color-success", "--color-bg"],
  ["--color-success", "--color-surface"],
  ["--color-danger", "--color-bg"],
  ["--color-danger", "--color-surface"],
  ["--color-warning", "--color-bg"],
  ["--color-warning", "--color-surface"],
  ["--color-muted-soft", "--color-bg"],
  ["--color-muted-soft", "--color-surface"],
  ["--color-muted-soft", "--color-bg-alt"],
  // texto blanco sobre los fondos de color
  ["--color-on-primary", "--color-primary-solid"],
  ["--color-on-primary", "--color-primary-deep"],
  ["--color-on-primary", "--color-success-solid"],
  ["--color-on-primary", "--color-danger-solid"],
];

// Lo que no es texto (el corazón de favoritos, las estrellas): 3:1.
const GRAPHIC_PAIRS = [
  ["--color-favorite", "--color-surface"],
  ["--color-attention", "--color-surface"],
];

describe.each([
  ["claro", light],
  ["oscuro", dark],
])("contraste en modo %s", (_name, vars) => {
  it.each(TEXT_PAIRS)("%s sobre %s: texto normal (4.5:1)", (fg, bg) => {
    expect(contrastRatio(color(vars, fg), color(vars, bg)), `${fg} sobre ${bg}`).toBeGreaterThanOrEqual(4.5);
  });

  // El color de atención es ámbar: solo cumple 3:1 sobre fondo oscuro; en claro es decorativo (bordes y puntos), nunca texto.
  it.each(GRAPHIC_PAIRS.filter(([fg]) => !(_name === "claro" && fg === "--color-attention")))("%s sobre %s: elemento gráfico (3:1)", (fg, bg) => {
    expect(contrastRatio(color(vars, fg), color(vars, bg)), `${fg} sobre ${bg}`).toBeGreaterThanOrEqual(3);
  });

  it("las insignias (color sobre su propio tinte al 12–14 %) se leen", () => {
    const surface = color(vars, "--color-surface");
    for (const name of ["--color-success", "--color-danger", "--color-warning"]) {
      const fg = color(vars, name);
      const tint = composite({ ...fg, a: 0.14 }, surface);
      expect(contrastRatio(fg, tint), name).toBeGreaterThanOrEqual(4.5);
    }
  });
});

// Regla de código: un fondo de color con texto blanco debe usar la variante «-solid» (igual en claro y oscuro), no el
// --color-primary/success/danger de texto, que en modo oscuro se aclara y el blanco dejaría de leerse.
const cssFiles = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? cssFiles(path) : path.endsWith(".css") ? [path] : [];
  });

describe("fondos de color con texto blanco", () => {
  it("no usan las variables de texto como fondo", () => {
    const offenders = [];
    for (const file of cssFiles(srcDir)) {
      for (const [, selector, body] of readFileSync(file, "utf8").matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
        if (!/(^|[;\s])color:\s*var\(--color-on-primary\)/.test(body)) continue;
        if (/background(?:-color)?:\s*var\(--color-(primary|success|danger)\)/.test(body)) offenders.push(`${file.replace(srcDir, "")}: ${selector.trim().split("\n").pop()}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
