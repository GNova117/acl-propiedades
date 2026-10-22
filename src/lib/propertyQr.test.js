import { readFileSync } from "node:fs";
import jsQR from "jsqr";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { QUIET_ZONE, buildQrSignPdf, darkRuns, qrMatrix, qrTargetUrl, signHeading } from "./propertyQr";

const origin = "https://acl.mx";
const property = { id: "123e4567-e89b-12d3-a456-426614174000", code: "ACL-1001", title: "Casa en Residencial Senderos", zone: "Torreón", price: 2450000, operation_type: "venta", status: "disponible" };

// Dibuja la matriz en píxeles RGBA (con su margen blanco) para que la lea jsQR,
// el mismo decodificador que ya usa el proyecto para validar documentos.
function render(matrix, scale = 6) {
  const total = (matrix.size + QUIET_ZONE * 2) * scale;
  const data = new Uint8ClampedArray(total * total * 4).fill(255);
  for (const { row, col, length } of darkRuns(matrix)) {
    for (let y = (row + QUIET_ZONE) * scale; y < (row + QUIET_ZONE + 1) * scale; y++) {
      for (let x = (col + QUIET_ZONE) * scale; x < (col + QUIET_ZONE + length) * scale; x++) {
        const i = (y * total + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = 0;
      }
    }
  }
  return { data, total };
}

describe("qrTargetUrl", () => {
  it("lleva a la ficha pública con la campaña del código de la propiedad", () => {
    expect(qrTargetUrl(property, origin)).toBe(`https://acl.mx/propiedades/${property.id}?utm_source=qr&utm_medium=impreso&utm_campaign=ACL-1001`);
  });
  it("sin código usa el id, y escapa lo que no sea seguro en una URL", () => {
    expect(qrTargetUrl({ id: "7", code: "A B&C" }, origin)).toContain("utm_campaign=A%20B%26C");
    expect(qrTargetUrl({ id: "7" }, origin)).toContain("utm_campaign=7");
  });
});

describe("qrMatrix", () => {
  it("es cuadrada y un lector la decodifica de vuelta a la misma URL", () => {
    const url = qrTargetUrl(property, origin);
    const matrix = qrMatrix(url);
    expect(matrix.size).toBeGreaterThanOrEqual(21);
    const { data, total } = render(matrix);
    expect(jsQR(data, total, total)?.data).toBe(url);
  });
  it("también lee una URL larga con acentos escapados", () => {
    const url = qrTargetUrl({ ...property, code: "ACL-ñandú-1001" }, "https://www.aclpropiedades.com");
    const { data, total } = render(qrMatrix(url));
    expect(jsQR(data, total, total)?.data).toBe(url);
  });
});

describe("darkRuns", () => {
  it("junta los módulos oscuros pegados de una fila en un solo tramo", () => {
    const cells = [
      [true, true, false, true],
      [false, false, false, false],
      [true, true, true, true],
      [false, true, false, false],
    ];
    const matrix = { size: 4, dark: (r, c) => cells[r][c] };
    expect(darkRuns(matrix)).toEqual([
      { row: 0, col: 0, length: 2 },
      { row: 0, col: 3, length: 1 },
      { row: 2, col: 0, length: 4 },
      { row: 3, col: 1, length: 1 },
    ]);
  });
});

describe("signHeading", () => {
  it("SE VENDE / SE RENTA, y VENDIDA o APARTADA según el estatus", () => {
    expect(signHeading(property)).toBe("SE VENDE");
    expect(signHeading({ ...property, operation_type: "renta" })).toBe("SE RENTA");
    expect(signHeading({ ...property, status: "vendida" })).toBe("VENDIDA");
    expect(signHeading({ ...property, status: "apartada" })).toBe("APARTADA");
  });
});

describe("buildQrSignPdf", () => {
  const template = readFileSync("public/plantilla_acl.pdf");
  it("genera un PDF de una sola página sobre la hoja membretada", async () => {
    const bytes = await buildQrSignPdf(property, { origin, template });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(bytes.length).toBeGreaterThan(5000);
  });
  it("aguanta títulos largos y propiedades sin código ni zona", async () => {
    const bytes = await buildQrSignPdf({ id: "x", title: "Casa muy grande ".repeat(12), price: 1000, operation_type: "renta" }, { origin, template });
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });
});
