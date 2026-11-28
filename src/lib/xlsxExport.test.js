import { describe, expect, it } from "vitest";
import { buildXlsx, columnName } from "./xlsxExport";

const text = (bytes) => new TextDecoder().decode(bytes);

// Lee el directorio central del ZIP: { nombre → contenido } (todo va sin comprimir).
function readZip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = bytes.length - 22;
  expect(view.getUint32(eocd, true)).toBe(0x06054b50);
  const count = view.getUint16(eocd + 10, true);
  let at = view.getUint32(eocd + 16, true);
  const files = {};
  for (let i = 0; i < count; i++) {
    expect(view.getUint32(at, true)).toBe(0x02014b50);
    const size = view.getUint32(at + 24, true);
    const nameLen = view.getUint16(at + 28, true);
    const offset = view.getUint32(at + 42, true);
    const name = text(bytes.subarray(at + 46, at + 46 + nameLen));
    const localNameLen = view.getUint16(offset + 26, true);
    const start = offset + 30 + localNameLen;
    files[name] = text(bytes.subarray(start, start + size));
    at += 46 + nameLen;
  }
  return files;
}

describe("columnName", () => {
  it("A, Z, AA, AB", () => {
    expect([0, 25, 26, 27, 701, 702].map(columnName)).toEqual(["A", "Z", "AA", "AB", "ZZ", "AAA"]);
  });
});

describe("buildXlsx", () => {
  const rows = [["Nombre", "Teléfono", "Precio"], ["Ana & <Co>", "+52 871 555 0100", 1250000], ["Beto", null, 0]];
  const files = readZip(buildXlsx(rows, { sheet: "Clientes" }));

  it("trae las partes que Excel necesita", () => {
    expect(Object.keys(files).sort()).toEqual(["[Content_Types].xml", "_rels/.rels", "xl/_rels/workbook.xml.rels", "xl/styles.xml", "xl/workbook.xml", "xl/worksheets/sheet1.xml"]);
    expect(files["xl/workbook.xml"]).toContain('name="Clientes"');
  });
  it("los números quedan numéricos y los textos como texto (con XML escapado)", () => {
    const sheet = files["xl/worksheets/sheet1.xml"];
    expect(sheet).toContain('<c r="C2"><v>1250000</v></c>');
    expect(sheet).toContain("Ana &amp; &lt;Co&gt;");
    expect(sheet).toContain('<c r="B2" t="inlineStr"><is><t xml:space="preserve">+52 871 555 0100</t></is></c>');
    expect(sheet).toContain('<c r="C3"><v>0</v></c>');
  });
  it("el encabezado va en negritas y las celdas vacías se omiten", () => {
    const sheet = files["xl/worksheets/sheet1.xml"];
    expect(sheet).toContain('<c r="A1" t="inlineStr" s="1">');
    expect(sheet).not.toContain('r="B3"');
  });
  it("una celda que parece fórmula se guarda como texto, no como fórmula", () => {
    const sheet = readZip(buildXlsx([["x"], ['=HYPERLINK("http://malo","clic")']]))["xl/worksheets/sheet1.xml"];
    expect(sheet).toContain("t=\"inlineStr\"");
    expect(sheet).not.toContain("<f>");
  });
  it("el nombre de la hoja se limpia y se recorta a 31 caracteres", () => {
    const wb = readZip(buildXlsx([["x"]], { sheet: "Clientes/2026: [abril] con un nombre muy muy largo" }))["xl/workbook.xml"];
    const name = /name="([^"]+)"/.exec(wb)[1];
    expect(name.length).toBeLessThanOrEqual(31);
    expect(name).not.toMatch(/[\\/?*[\]:]/);
  });
});
