import { describe, expect, it } from "vitest";
import { averageHash, hammingDistance, photoWarnings } from "./photoCheck";

const flat = (r, g, b, w = 8, h = 8) => ({ width: w, height: h, data: Uint8ClampedArray.from({ length: w * h * 4 }, (_, i) => [r, g, b, 255][i % 4]) });
// mitad izquierda clara, mitad derecha oscura
const split = () => {
  const img = flat(0, 0, 0);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 4; x++) { const p = (y * 8 + x) * 4; img.data[p] = img.data[p + 1] = img.data[p + 2] = 255; }
  return img;
};

describe("averageHash / hammingDistance", () => {
  it("la misma imagen da el mismo hash; distinta, distancia grande", () => {
    expect(averageHash(split())).toBe(averageHash(split()));
    expect(hammingDistance(averageHash(split()), "0".repeat(64))).toBeGreaterThan(20);
  });
  it("largos distintos → infinito", () => {
    expect(hammingDistance("01", "011")).toBe(Infinity);
  });
});

describe("photoWarnings", () => {
  const hashA = averageHash(split());
  it("avisa de una foto muy oscura o muy clara", () => {
    const w = photoWarnings([{ name: "a.jpg", brightness: 20, hash: hashA }, { name: "b.jpg", brightness: 250, hash: "1".repeat(64) }]);
    expect(w).toEqual([{ name: "a.jpg", kind: "dark" }, { name: "b.jpg", kind: "bright" }]);
  });
  it("avisa de una foto repetida, citando con cuál", () => {
    const w = photoWarnings([{ name: "a.jpg", brightness: 120, hash: hashA }, { name: "copia.jpg", brightness: 121, hash: hashA }]);
    expect(w).toEqual([{ name: "copia.jpg", kind: "duplicate", of: "a.jpg" }]);
  });
  it("fotos normales y distintas no avisan", () => {
    expect(photoWarnings([{ name: "a.jpg", brightness: 120, hash: hashA }, { name: "b.jpg", brightness: 130, hash: "0".repeat(64) }])).toEqual([]);
  });
  it("sin análisis (formato que el navegador no abre) no truena", () => {
    expect(photoWarnings([{ name: "x.heic", brightness: null, hash: null }])).toEqual([]);
  });
});
