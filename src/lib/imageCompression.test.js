import { describe, expect, it } from "vitest";
import { HeicNotSupportedError, compressImageFile, isHeic } from "./imageCompression";

describe("isHeic", () => {
  it("reconoce HEIC por tipo o por extensión", () => {
    expect(isHeic({ type: "image/heic", name: "a" })).toBe(true);
    expect(isHeic({ type: "image/heif", name: "a" })).toBe(true);
    expect(isHeic({ type: "", name: "IMG_0001.HEIC" })).toBe(true);
    expect(isHeic({ type: "image/jpeg", name: "a.jpg" })).toBe(false);
  });
});

describe("compressImageFile con HEIC que el navegador no abre", () => {
  it("avisa en vez de subir un archivo que no se vería", async () => {
    // En el entorno de pruebas no hay createImageBitmap: equivale a un navegador que no decodifica HEIC.
    const file = new File([new Uint8Array([1, 2, 3])], "IMG_0001.HEIC", { type: "image/heic" });
    await expect(compressImageFile(file)).rejects.toBeInstanceOf(HeicNotSupportedError);
  });
  it("un archivo que no es imagen pasa tal cual", async () => {
    const pdf = new File([new Uint8Array([1])], "a.pdf", { type: "application/pdf" });
    expect(await compressImageFile(pdf)).toBe(pdf);
  });
});
