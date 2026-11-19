import { describe, expect, it } from "vitest";
import { swipeDirection } from "./swipe";

describe("swipeDirection", () => {
  it("izquierda = siguiente, derecha = anterior", () => {
    expect(swipeDirection(200, 100, 100, 105)).toBe(1);
    expect(swipeDirection(100, 100, 200, 95)).toBe(-1);
  });
  it("un deslizamiento corto no cuenta", () => {
    expect(swipeDirection(100, 100, 130, 100)).toBeNull();
  });
  it("uno más vertical que horizontal es scroll, no cambio de foto", () => {
    expect(swipeDirection(100, 100, 150, 200)).toBeNull();
  });
});
