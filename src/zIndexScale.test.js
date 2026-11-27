import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// 294: las capas (z-index de 100 o más) salen de la escala de variables de index.css; los números sueltos de 1 a 99 son
// solo para apilar un elemento sobre su vecino dentro de un componente.
const SRC = new URL("../src", import.meta.url).pathname;

function cssFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return cssFiles(path);
    return path.endsWith(".css") ? [path] : [];
  });
}

describe("escala de z-index", () => {
  it("ningún CSS usa un z-index suelto de 100 o más", () => {
    const sueltos = [];
    for (const file of cssFiles(SRC)) {
      const text = readFileSync(file, "utf8");
      for (const m of text.matchAll(/z-index:\s*(\d+)\s*;/g)) {
        if (Number(m[1]) >= 100) sueltos.push(`${file.replace(SRC, "src")}: z-index ${m[1]}`);
      }
    }
    expect(sueltos).toEqual([]);
  });

  it("toda variable --z-* que se usa está definida en index.css y las capas van en orden", () => {
    const index = readFileSync(join(SRC, "index.css"), "utf8");
    const defined = new Map([...index.matchAll(/--(z-[a-z-]+):\s*(\d+);/g)].map((m) => [m[1], Number(m[2])]));
    const used = new Set();
    for (const file of cssFiles(SRC)) {
      for (const m of readFileSync(file, "utf8").matchAll(/var\(--(z-[a-z-]+)\)/g)) used.add(m[1]);
    }
    for (const name of used) expect(defined.has(name), `--${name} sin definir`).toBe(true);
    const order = ["sticky", "header", "tabbar", "contact-bar", "chat", "overlay", "popover", "drawer", "system-dialog", "dialog", "tour", "toast", "lightbox", "loading"].map((n) => defined.get(`z-${n}`));
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });
});
