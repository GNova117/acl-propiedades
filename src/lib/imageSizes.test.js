import { describe, expect, it } from "vitest";
import { unsplashSrcSet } from "./imageSizes";

describe("unsplashSrcSet", () => {
  it("arma un srcset con un ancho por entrada, conservando el resto de la dirección", () => {
    const set = unsplashSrcSet("https://images.unsplash.com/photo-1?w=900&q=80");
    expect(set).toBe("https://images.unsplash.com/photo-1?w=480&q=80 480w, https://images.unsplash.com/photo-1?w=900&q=80 900w");
  });

  it("acepta otros anchos", () => {
    expect(unsplashSrcSet("https://images.unsplash.com/p?w=1400&q=80", [640, 1400])).toContain("w=640&q=80 640w");
  });

  it("no toca fotos que no son de Unsplash, sin ancho en la dirección o direcciones inválidas", () => {
    expect(unsplashSrcSet("https://miservidor.com/foto.jpg?w=900")).toBeNull();
    expect(unsplashSrcSet("https://images.unsplash.com/photo-1?q=80")).toBeNull();
    expect(unsplashSrcSet("/sin-foto.svg")).toBeNull();
    expect(unsplashSrcSet("")).toBeNull();
    expect(unsplashSrcSet(undefined)).toBeNull();
  });
});
