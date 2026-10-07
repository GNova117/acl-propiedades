import { describe, expect, it } from "vitest";
import { polygonAreaM2, polygonToLocalMeters } from "./geoArea";

describe("polygonAreaM2", () => {
  it("devuelve 0 para una entrada que no es arreglo o con menos de 3 puntos", () => {
    expect(polygonAreaM2(null)).toBe(0);
    expect(polygonAreaM2([])).toBe(0);
    expect(polygonAreaM2([[0, 0]])).toBe(0);
    expect(polygonAreaM2([[0, 0], [0, 1]])).toBe(0);
  });

  it("calcula el área de un cuadrado pequeño cerca del ecuador, cercana al área plana esperada", () => {
    // ~100 m por lado cerca del ecuador: a esta escala la curvatura es
    // despreciable, así que el resultado debe acercarse a 100 x 100 = 10,000 m².
    const d = (100 / 6378137) * (180 / Math.PI);
    const area = polygonAreaM2([
      [0, 0],
      [0, d],
      [d, d],
      [d, 0],
    ]);
    expect(area).toBeGreaterThan(9900);
    expect(area).toBeLessThan(10100);
  });

  it("el área no depende del sentido en que se trazaron los vértices", () => {
    const points = [
      [25.54, -103.41],
      [25.541, -103.41],
      [25.541, -103.409],
      [25.54, -103.409],
    ];
    const forward = polygonAreaM2(points);
    const backward = polygonAreaM2([...points].reverse());
    expect(backward).toBeCloseTo(forward, 6);
  });
});

describe("polygonToLocalMeters", () => {
  it("devuelve un arreglo vacío para una entrada vacía o inválida", () => {
    expect(polygonToLocalMeters([])).toEqual([]);
    expect(polygonToLocalMeters(null)).toEqual([]);
  });

  it("un solo punto queda en el origen (es su propio centroide)", () => {
    expect(polygonToLocalMeters([[25.54, -103.41]])).toEqual([{ x: 0, z: 0 }]);
  });

  it("dos puntos en la misma latitud quedan simétricos en x y sin desnivel norte-sur (z=0)", () => {
    const [p1, p2] = polygonToLocalMeters([
      [25.54, -103.411],
      [25.54, -103.409],
    ]);
    expect(p1.z).toBe(0);
    expect(p2.z).toBe(0);
    expect(p1.x).toBeCloseTo(-p2.x, 2);
    // El punto con la longitud mayor (menos negativa) queda al este (x mayor).
    expect(p2.x).toBeGreaterThan(p1.x);
  });

  it("dos puntos en la misma longitud quedan sin desplazamiento este-oeste (x=0), y el más al sur tiene z mayor", () => {
    const [north, south] = polygonToLocalMeters([
      [25.541, -103.41],
      [25.539, -103.41],
    ]);
    expect(north.x).toBe(0);
    expect(south.x).toBe(0);
    expect(south.z).toBeGreaterThan(north.z);
  });
});
