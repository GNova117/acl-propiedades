import { describe, expect, it } from "vitest";
import { computeBrightness, computeEdgeDensity, computeSharpness, evaluateDocumentQuality, QUALITY_THRESHOLDS } from "./imageQuality";

// Construye un imageData de mentira: una función que da el nivel de gris (0-255)
// de cada pixel según su posición, replicado en R/G/B con alpha fijo.
function makeImage(width, height, grayAt) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = grayAt(x, y);
      const i = (y * width + x) * 4;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return { data, width, height };
}

const uniform = (size, value) => makeImage(size, size, () => value);
const checkerboard = (size, low, high) => makeImage(size, size, (x, y) => ((x + y) % 2 === 0 ? high : low));
// Igual que checkerboard, pero en bloques de varios pixeles: un tablero de un
// solo pixel por cuadro se cancela exactamente bajo el operador Sobel (cada
// vecino diagonal compensa al vecino recto), así que para detectar bordes de
// verdad el patrón necesita cuadros de más de un pixel.
const blockCheckerboard = (size, blockSize, low, high) =>
  makeImage(size, size, (x, y) => ((Math.floor(x / blockSize) + Math.floor(y / blockSize)) % 2 === 0 ? high : low));

describe("computeBrightness", () => {
  it("es el promedio de gris de la imagen (0-255)", () => {
    expect(computeBrightness(uniform(5, 128))).toBeCloseTo(128, 5);
    expect(computeBrightness(uniform(5, 0))).toBe(0);
    expect(computeBrightness(uniform(5, 255))).toBeCloseTo(255, 5);
  });
});

describe("computeSharpness", () => {
  it("una imagen completamente pareja no tiene variación (Laplaciano) y sale en 0", () => {
    expect(computeSharpness(uniform(6, 128))).toBe(0);
  });

  it("un patrón de alto contraste da mucha más varianza que una imagen pareja", () => {
    const flat = computeSharpness(uniform(8, 128));
    const sharp = computeSharpness(checkerboard(8, 20, 220));
    expect(sharp).toBeGreaterThan(flat);
    expect(sharp).toBeGreaterThan(QUALITY_THRESHOLDS.minSharpness * 10);
  });
});

describe("computeEdgeDensity", () => {
  it("una imagen pareja no tiene bordes", () => {
    expect(computeEdgeDensity(uniform(8, 128))).toBe(0);
  });

  it("un patrón de alto contraste tiene muchos más bordes que una imagen pareja", () => {
    const density = computeEdgeDensity(blockCheckerboard(12, 3, 20, 220));
    expect(density).toBeGreaterThan(QUALITY_THRESHOLDS.minEdgeDensity);
  });
});

describe("evaluateDocumentQuality", () => {
  it("una foto borrosa, pareja y oscura falla por varias razones a la vez", () => {
    const result = evaluateDocumentQuality(uniform(10, 30));
    expect(result.passed).toBe(false);
    expect(result.failReasons).toContain("blurry");
    expect(result.failReasons).toContain("tooDark");
    expect(result.failReasons).toContain("noDocumentDetected");
  });

  it("una foto pareja y muy clara falla por 'tooBright'", () => {
    const result = evaluateDocumentQuality(uniform(10, 240));
    expect(result.failReasons).toContain("tooBright");
  });

  it("una foto nítida, con buen contraste y exposición media pasa todas las pruebas", () => {
    const result = evaluateDocumentQuality(blockCheckerboard(12, 3, 70, 180));
    expect(result.passed).toBe(true);
    expect(result.failReasons).toEqual([]);
  });
});
