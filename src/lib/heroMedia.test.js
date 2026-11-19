import { describe, expect, it } from "vitest";
import { browserVideoConditions, heroMedia, safeMediaUrl, shouldPlayVideo } from "./heroMedia";

describe("safeMediaUrl", () => {
  it("acepta https y rutas del sitio; rechaza lo demás", () => {
    expect(safeMediaUrl("https://cdn.x.mx/a.jpg")).toBe("https://cdn.x.mx/a.jpg");
    expect(safeMediaUrl("/hero/laguna.jpg")).toBe("/hero/laguna.jpg");
    for (const bad of ["", undefined, "http://x.mx/a.jpg", "//evil.com/a.jpg", "javascript:alert(1)", "data:image/png;base64,AAAA", "no es url"]) expect(safeMediaUrl(bad)).toBeNull();
  });
});

describe("heroMedia", () => {
  it("sin variables no hay nada (la portada queda como siempre)", () => {
    expect(heroMedia({})).toEqual({ image: null, video: null, poster: null });
  });
  it("toma foto, video y póster; el póster cae en la foto", () => {
    expect(heroMedia({ VITE_HERO_IMAGE_URL: "/hero/a.jpg", VITE_HERO_VIDEO_URL: "/hero/a.mp4" })).toEqual({ image: "/hero/a.jpg", video: "/hero/a.mp4", poster: "/hero/a.jpg" });
    expect(heroMedia({ VITE_HERO_VIDEO_URL: "https://cdn.x.mx/v.webm?v=2", VITE_HERO_POSTER_URL: "/p.jpg" })).toMatchObject({ video: "https://cdn.x.mx/v.webm?v=2", poster: "/p.jpg" });
  });
  it("un «video» que no es mp4 ni webm se ignora", () => {
    expect(heroMedia({ VITE_HERO_VIDEO_URL: "/hero/a.gif" }).video).toBeNull();
    expect(heroMedia({ VITE_HERO_VIDEO_URL: "/hero/a.exe" }).video).toBeNull();
  });
});

describe("shouldPlayVideo", () => {
  it("no reproduce con movimiento reducido, ahorro de datos o conexión lenta", () => {
    expect(shouldPlayVideo({})).toBe(true);
    expect(shouldPlayVideo({ reducedMotion: true })).toBe(false);
    expect(shouldPlayVideo({ saveData: true })).toBe(false);
    for (const effectiveType of ["slow-2g", "2g", "3g"]) expect(shouldPlayVideo({ effectiveType })).toBe(false);
    expect(shouldPlayVideo({ effectiveType: "4g" })).toBe(true);
  });
  it("lee el navegador sin romperse cuando no trae la API de conexión", () => {
    expect(browserVideoConditions({ navigator: {}, matchMedia: () => ({ matches: true }) })).toEqual({ reducedMotion: true, saveData: false, effectiveType: "4g" });
    expect(browserVideoConditions({ navigator: { connection: { saveData: true, effectiveType: "2g" } } })).toEqual({ reducedMotion: false, saveData: true, effectiveType: "2g" });
    expect(browserVideoConditions(undefined)).toEqual({ reducedMotion: false, saveData: false, effectiveType: "4g" });
  });
});
