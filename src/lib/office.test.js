import { readdirSync, readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { OFFICE, OFFICE_WHATSAPP } from "./office";

describe("OFFICE", () => {
  it("los formatos del teléfono salen todos del mismo número", () => {
    expect(OFFICE.phoneDisplay).toBe("871 324 3271");
    expect(OFFICE.phoneTel).toBe("+528713243271");
    expect(OFFICE.whatsapp).toBe("528713243271");
    expect(OFFICE.whatsappUrl).toBe("https://wa.me/528713243271");
    expect(OFFICE_WHATSAPP).toBe(OFFICE.whatsapp);
    expect(OFFICE.phoneDisplay.replace(/\s/g, "")).toBe(OFFICE.phoneTel.slice(3));
  });
});

// Que nadie vuelva a copiar el teléfono, el WhatsApp o el correo de la oficina: todo debe salir de src/lib/office.js.
// (Los textos legales de los archivos de idiomas —el aviso de privacidad— llevan su propia copia a propósito: son texto
// jurídico y se revisan completos, no por pedazos.)
function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = `${dir}/${name}`;
    if (statSync(path).isDirectory()) return name === "i18n" || name === "node_modules" ? [] : sourceFiles(path);
    return /\.(js|jsx|ts|tsx)$/.test(path) && !/\.test\./.test(path) && !path.endsWith("src/lib/office.js") ? [path] : [];
  });
}

describe("una sola fuente de los datos de la oficina", () => {
  const files = sourceFiles("src");
  const FORBIDDEN = [
    [/3243271|324[ -]3271/, "el teléfono de la oficina"],
    [/inmobiliaria@aclpropiedades\.com/, "el correo de la oficina"],
    [/Plaza San Luciano/, "la dirección de la oficina"],
  ];
  // Excepciones con motivo: datos de ejemplo del modo demo.
  const ALLOWED = new Set(["src/lib/seedData.js"]);

  for (const [pattern, what] of FORBIDDEN) {
    it(`nadie copia ${what}`, () => {
      const offenders = files.filter((f) => !ALLOWED.has(f) && pattern.test(readFileSync(f, "utf8")));
      expect(offenders, `usa src/lib/office.js en vez de copiar ${what}`).toEqual([]);
    });
  }
});
