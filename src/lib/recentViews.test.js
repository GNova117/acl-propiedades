import { describe, expect, it } from "vitest";
import { MIN_VIEWS_TO_SHOW, shouldShowRecentViews } from "./recentViews";

describe("shouldShowRecentViews", () => {
  it("se oculta con 0 o 1 vista", () => {
    expect(shouldShowRecentViews(0)).toBe(false);
    expect(shouldShowRecentViews(1)).toBe(false);
  });

  it(`se muestra a partir de ${MIN_VIEWS_TO_SHOW} vistas`, () => {
    expect(shouldShowRecentViews(MIN_VIEWS_TO_SHOW)).toBe(true);
    expect(shouldShowRecentViews(MIN_VIEWS_TO_SHOW + 5)).toBe(true);
  });

  it("acepta valores no numéricos sin lanzar error", () => {
    expect(shouldShowRecentViews(null)).toBe(false);
    expect(shouldShowRecentViews(undefined)).toBe(false);
  });
});
