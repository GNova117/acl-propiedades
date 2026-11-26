import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// JSON.parse se queda en silencio con la ÚLTIMA de dos llaves repetidas: al agregar un grupo nuevo con un nombre que ya existía
// (p. ej. «installApp»), el grupo viejo desaparecía y la pantalla mostraba «installApp.button» en vez de su texto. Esta prueba
// detecta llaves repetidas en cualquier nivel de los dos idiomas.
function duplicateKeys(text) {
  const duplicates = [];
  // Recorre el JSON con una pila de objetos: cada «"clave":» a nivel de objeto se anota en el objeto actual.
  const stack = [];
  let i = 0;
  const pathOf = () => stack.map((s) => s.name).filter(Boolean).join(".");
  while (i < text.length) {
    const ch = text[i];
    if (ch === '"') {
      let j = i + 1;
      while (text[j] !== '"') j += text[j] === "\\" ? 2 : 1;
      const str = text.slice(i + 1, j);
      let k = j + 1;
      while (/\s/.test(text[k])) k += 1;
      const top = stack[stack.length - 1];
      if (text[k] === ":" && top && top.type === "object" && top.expectKey) {
        if (top.keys.has(str)) duplicates.push(`${pathOf()}.${str}`.replace(/^\./, ""));
        top.keys.add(str);
        top.expectKey = false;
        top.pendingName = str;
      }
      i = j + 1;
      continue;
    }
    if (ch === "{") {
      const parent = stack[stack.length - 1];
      stack.push({ type: "object", keys: new Set(), expectKey: true, name: parent?.pendingName || "" });
    } else if (ch === "[") {
      const parent = stack[stack.length - 1];
      stack.push({ type: "array", name: parent?.pendingName || "" });
    } else if (ch === "}" || ch === "]") {
      stack.pop();
    } else if (ch === ",") {
      const top = stack[stack.length - 1];
      if (top?.type === "object") top.expectKey = true;
    }
    i += 1;
  }
  return duplicates;
}

describe("archivos de idiomas", () => {
  for (const lang of ["es", "en"]) {
    it(`${lang}.json no repite llaves`, () => {
      const text = readFileSync(new URL(`./locales/${lang}.json`, import.meta.url), "utf8");
      expect(duplicateKeys(text)).toEqual([]);
    });
  }

  it("el detector sí encuentra una repetida", () => {
    expect(duplicateKeys('{"a": {"x": 1, "x": 2}, "b": 1, "b": 2}')).toEqual(["a.x", "b"]);
    expect(duplicateKeys('{"a": {"x": 1}, "b": {"x": 2}}')).toEqual([]);
  });
});

// El inglés ya no va en el paquete inicial (se baja bajo demanda), así que nada lo compara con el español al compilar:
// esta prueba evita que una llave exista en un idioma y falte en el otro.
function leafKeys(value, prefix = "") {
  if (value === null || typeof value !== "object") return [prefix];
  return Object.entries(value).flatMap(([k, v]) => leafKeys(v, prefix ? `${prefix}.${k}` : k));
}

describe("es.json y en.json", () => {
  it("tienen las mismas llaves", () => {
    const read = (lang) => JSON.parse(readFileSync(new URL(`./locales/${lang}.json`, import.meta.url), "utf8"));
    const es = new Set(leafKeys(read("es")));
    const en = new Set(leafKeys(read("en")));
    expect([...es].filter((k) => !en.has(k))).toEqual([]);
    expect([...en].filter((k) => !es.has(k))).toEqual([]);
  });
});
