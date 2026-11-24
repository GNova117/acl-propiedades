import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseTscErrors, summarize } from "./typecheckJsLib";

describe("parseTscErrors", () => {
  it("lee archivo, posición, código y mensaje", () => {
    const out = "src/lib/a.js(12,5): error TS2339: Property 'x' does not exist on type 'Y'.\nruido que no es un error\nsrc/b.js(1,1): error TS2322: Otro.";
    expect(parseTscErrors(out)).toEqual([
      { file: "src/lib/a.js", line: 12, col: 5, code: "TS2339", message: "Property 'x' does not exist on type 'Y'." },
      { file: "src/b.js", line: 1, col: 1, code: "TS2322", message: "Otro." },
    ]);
    expect(parseTscErrors("")).toEqual([]);
    expect(parseTscErrors(null)).toEqual([]);
  });
});

describe("summarize", () => {
  const errors = [
    { file: "src/lib/listado.js", line: 1, col: 1, code: "TS1", message: "m" },
    { file: "src/lib/sucio.js", line: 1, col: 1, code: "TS2", message: "m" },
  ];
  it("solo fallan los archivos de la lista y se sugieren los limpios que faltan", () => {
    const result = summarize(errors, ["src/lib/listado.js", "src/lib/limpio.js"], ["src/lib/listado.js", "src/lib/limpio.js", "src/lib/sucio.js", "src/lib/otro.js"]);
    expect(result.failing.map((e) => e.file)).toEqual(["src/lib/listado.js"]);
    expect(result.candidates).toEqual(["src/lib/otro.js"]);
  });
  it("sin errores en la lista, todo bien", () => {
    expect(summarize([], ["a.js"], ["a.js"]).failing).toEqual([]);
  });
});

describe("la lista real", () => {
  it("no tiene repetidos ni pruebas", () => {
    const lines = readFileSync(new URL("./typecheck-js-files.txt", import.meta.url), "utf8").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
    expect(new Set(lines).size).toBe(lines.length);
    expect(lines.every((l) => l.endsWith(".js") && !l.endsWith(".test.js"))).toBe(true);
  });
});
