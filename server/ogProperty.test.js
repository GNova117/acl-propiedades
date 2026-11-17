import { describe, expect, it, vi } from "vitest";
import { GlobalFonts, Path2D, createCanvas, loadImage } from "@napi-rs/canvas";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { brandImagePng, propertyFacts, registerFonts, wrapText, OG_HEIGHT, OG_WIDTH } from "./ogImage.js";
import { MAX_PHOTO_BYTES, isAllowedPhotoUrl, propertyOgResponse } from "./ogProperty.js";

registerFonts(GlobalFonts, join(dirname(fileURLToPath(import.meta.url)), "fonts"));
const canvasApi = { createCanvas, Path2D };
const ID = "123e4567-e89b-12d3-a456-426614174000";
const env = { VITE_SUPABASE_URL: "https://proj.supabase.co", VITE_SUPABASE_ANON_KEY: "anon" };
const property = { title: "Casa en Residencial Senderos con jardín y alberca", price: 2450000, type: "casa", operation_type: "compra", bedrooms: 3, bathrooms: 2.5, parking: 2, area_m2: 180, zone: "Torreón", main_image: "https://proj.supabase.co/storage/v1/object/public/property-images/a.jpg" };

// Una «foto» de prueba: un PNG de colores dibujado con el propio canvas.
const fakePhoto = () => {
  const c = createCanvas(800, 500);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#c97b3a";
  ctx.fillRect(0, 0, 800, 500);
  ctx.fillStyle = "#3a7bc9";
  ctx.fillRect(0, 0, 800, 200);
  return c.toBuffer("image/png");
};
const ok = (body, type = "application/json") => ({ ok: true, headers: { get: (h) => (h.toLowerCase() === "content-type" ? type : null) }, json: async () => body, arrayBuffer: async () => body });

const pngSize = async (buffer) => {
  const img = await loadImage(buffer);
  return [img.width, img.height];
};

describe("imagen de la marca", () => {
  it("es un PNG de 1200 × 630", async () => {
    const png = brandImagePng(canvasApi);
    expect(png.subarray(0, 4).toString("hex")).toBe("89504e47");
    expect(await pngSize(png)).toEqual([OG_WIDTH, OG_HEIGHT]);
  });
});

describe("textos", () => {
  it("los datos de la propiedad van en un renglón y los terrenos no llevan recámaras", () => {
    expect(propertyFacts(property)).toBe("3 rec · 2.5 baños · 2 autos · 180 m² · Torreón");
    expect(propertyFacts({ type: "terreno", bedrooms: 3, area_m2: 400, zone: "Lerdo" })).toBe("400 m² · Lerdo");
  });
  it("wrapText corta con «…» lo que no cabe", () => {
    const ctx = createCanvas(10, 10).getContext("2d");
    ctx.font = '700 38px "ACL Inter"';
    const lines = wrapText(ctx, "palabra ".repeat(60), 500, 2);
    expect(lines).toHaveLength(2);
    expect(lines[1].endsWith("…")).toBe(true);
    expect(wrapText(ctx, "corto", 500, 2)).toEqual(["corto"]);
  });
});

describe("isAllowedPhotoUrl", () => {
  it("solo https del Storage del proyecto o la foto de ejemplo; nada interno ni de otro lado", () => {
    expect(isAllowedPhotoUrl("https://proj.supabase.co/storage/v1/a.jpg", env.VITE_SUPABASE_URL)).toBe(true);
    expect(isAllowedPhotoUrl("https://images.unsplash.com/photo-1", env.VITE_SUPABASE_URL)).toBe(true);
    for (const bad of ["http://proj.supabase.co/a.jpg", "https://evil.com/a.jpg", "https://169.254.169.254/latest", "https://localhost/a.jpg", "javascript:alert(1)", "no es url"]) {
      expect(isAllowedPhotoUrl(bad, env.VITE_SUPABASE_URL)).toBe(false);
    }
    expect(isAllowedPhotoUrl("https://proj.supabase.co/a.jpg", undefined)).toBe(false);
  });
});

describe("propertyOgResponse", () => {
  it("arma el PNG con la foto y el precio de ESA propiedad", async () => {
    const photoBytes = fakePhoto();
    const fetchImpl = vi.fn(async (url) => (String(url).includes("/rest/v1/") ? ok([property]) : { ...ok(photoBytes, "image/png"), arrayBuffer: async () => photoBytes }));
    const out = await propertyOgResponse({ id: ID, env, fetchImpl, canvasApi, loadImage });
    expect(out.status).toBe(200);
    expect(out.headers["Content-Type"]).toBe("image/png");
    expect(await pngSize(out.body)).toEqual([OG_WIDTH, OG_HEIGHT]);
    expect(String(fetchImpl.mock.calls[0][0])).toContain(`id=eq.${ID}`);
    expect(String(fetchImpl.mock.calls[0][0])).toContain("active=eq.true"); // una propiedad inactiva no se muestra
    expect(fetchImpl.mock.calls[1][0]).toBe(property.main_image);
  });

  it("un id mal formado es 400 y no consulta nada", async () => {
    const fetchImpl = vi.fn();
    expect((await propertyOgResponse({ id: "x'; drop table", env, fetchImpl, canvasApi, loadImage })).status).toBe(400);
    expect((await propertyOgResponse({ id: undefined, env, fetchImpl, canvasApi, loadImage })).status).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("si algo falla responde con la imagen de la marca en vez de un error", async () => {
    const cases = [
      { env: {}, fetchImpl: vi.fn() },
      { env, fetchImpl: vi.fn(async () => ({ ok: false })) },
      { env, fetchImpl: vi.fn(async () => ok([])) },
      { env, fetchImpl: vi.fn(async () => { throw new Error("red"); }) },
    ];
    for (const c of cases) {
      const out = await propertyOgResponse({ id: ID, canvasApi, loadImage, ...c });
      expect(out.status).toBe(302);
      expect(out.headers.Location).toBe("/og-default.png");
    }
  });

  it("no baja una foto de otro dominio ni demasiado pesada: dibuja igual con el fondo de la marca", async () => {
    const evil = vi.fn(async (url) => (String(url).includes("/rest/v1/") ? ok([{ ...property, main_image: "https://evil.com/a.jpg" }]) : ok(Buffer.alloc(10), "image/png")));
    const out1 = await propertyOgResponse({ id: ID, env, fetchImpl: evil, canvasApi, loadImage });
    expect(out1.status).toBe(200);
    expect(evil).toHaveBeenCalledTimes(1); // solo la consulta a la base

    const heavy = vi.fn(async (url) => (String(url).includes("/rest/v1/") ? ok([property]) : { ok: true, headers: { get: (h) => (h === "content-type" ? "image/png" : String(MAX_PHOTO_BYTES + 1)) }, arrayBuffer: async () => Buffer.alloc(10) }));
    const out2 = await propertyOgResponse({ id: ID, env, fetchImpl: heavy, canvasApi, loadImage });
    expect(out2.status).toBe(200);
  });
});
