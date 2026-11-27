import { describe, expect, it } from "vitest";
import { moveItem, moveWithMain, remapIndex } from "./imageOrder";

describe("moveItem", () => {
  it("mueve a la derecha y a la izquierda", () => {
    expect(moveItem(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
    expect(moveItem(["a", "b", "c"], 2, 1)).toEqual(["a", "c", "b"]);
  });
  it("fuera de rango o sin cambio devuelve la misma lista", () => {
    const list = ["a", "b"];
    expect(moveItem(list, 0, 5)).toBe(list);
    expect(moveItem(list, 1, 1)).toBe(list);
    expect(moveItem(list, 0, -1)).toBe(list);
  });
});

describe("remapIndex", () => {
  it("la foto movida lleva su principal con ella", () => {
    expect(remapIndex(0, 0, 1)).toBe(1);
  });
  it("la vecina que se recorre ajusta la principal", () => {
    expect(remapIndex(1, 0, 1)).toBe(0);
    expect(remapIndex(0, 1, 0)).toBe(1);
  });
  it("las demás no cambian", () => {
    expect(remapIndex(3, 0, 1)).toBe(3);
  });
});

describe("moveWithMain", () => {
  it("considera el desplazamiento de las fotos nuevas", () => {
    // 2 guardadas + 3 nuevas; la principal es la primera nueva (índice 2); la movemos a la derecha dentro de las nuevas.
    expect(moveWithMain(2, 2, 0, 1, 3)).toBe(3);
  });
  it("no se sale de la lista", () => {
    expect(moveWithMain(0, 0, 0, -1, 3)).toBe(0);
    expect(moveWithMain(0, 0, 2, 3, 3)).toBe(0);
  });
});
