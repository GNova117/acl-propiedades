import { describe, expect, it } from "vitest";
import { mergeRecentlyViewedIds } from "./recentlyViewed";

describe("mergeRecentlyViewedIds", () => {
  it("agrega el id nuevo al frente de una lista vacía", () => {
    expect(mergeRecentlyViewedIds([], "prop-1")).toEqual(["prop-1"]);
  });

  it("pone el id más reciente primero", () => {
    expect(mergeRecentlyViewedIds(["prop-1"], "prop-2")).toEqual(["prop-2", "prop-1"]);
  });

  it("si el id ya estaba, lo mueve al frente en vez de duplicarlo", () => {
    expect(mergeRecentlyViewedIds(["prop-1", "prop-2", "prop-3"], "prop-2")).toEqual(["prop-2", "prop-1", "prop-3"]);
  });

  it("recorta al tope indicado, descartando los más viejos", () => {
    const result = mergeRecentlyViewedIds(["a", "b", "c"], "d", 3);
    expect(result).toEqual(["d", "a", "b"]);
    expect(result).toHaveLength(3);
  });

  it("sin id nuevo, regresa la lista existente recortada al tope", () => {
    expect(mergeRecentlyViewedIds(["a", "b", "c", "d"], null, 2)).toEqual(["a", "b"]);
  });

  it("usa el tope por defecto (8) cuando no se indica otro", () => {
    const ids = Array.from({ length: 10 }, (_, i) => `p${i}`);
    expect(mergeRecentlyViewedIds(ids, "nuevo")).toHaveLength(8);
  });
});
