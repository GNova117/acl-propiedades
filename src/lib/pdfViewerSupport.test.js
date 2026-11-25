import { describe, expect, it } from "vitest";
import { prefersCanvasViewer } from "./pdfViewerSupport";

describe("prefersCanvasViewer", () => {
  it("usa el visor por páginas en pantallas chicas o táctiles", () => {
    expect(prefersCanvasViewer({ matchMedia: () => ({ matches: true }) })).toBe(true);
  });
  it("deja el visor nativo en escritorio", () => {
    expect(prefersCanvasViewer({ matchMedia: () => ({ matches: false }) })).toBe(false);
  });
  it("sin matchMedia o si falla, no rompe", () => {
    expect(prefersCanvasViewer({})).toBe(false);
    expect(prefersCanvasViewer(undefined)).toBe(false);
    expect(prefersCanvasViewer({ matchMedia: () => { throw new Error("x"); } })).toBe(false);
  });
});
