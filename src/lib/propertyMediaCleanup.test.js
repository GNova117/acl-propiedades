import { describe, expect, it } from "vitest";
import { propertyMediaPaths, storagePathFromUrl } from "./propertyMediaCleanup";

const base = "https://abc.supabase.co/storage/v1/object/public";

describe("storagePathFromUrl", () => {
  it("saca la ruta dentro del bucket, sin parámetros", () => {
    expect(storagePathFromUrl(`${base}/property-images/1700-ab12-casa.jpg?v=2`, "property-images")).toBe("1700-ab12-casa.jpg");
  });
  it("decodifica los caracteres escapados", () => {
    expect(storagePathFromUrl(`${base}/property-images/a%20b.jpg`, "property-images")).toBe("a b.jpg");
  });
  it("otro bucket, dirección externa o vacía → null", () => {
    expect(storagePathFromUrl(`${base}/property-videos/x.mp4`, "property-images")).toBeNull();
    expect(storagePathFromUrl("https://images.unsplash.com/photo-1.jpg", "property-images")).toBeNull();
    expect(storagePathFromUrl("", "property-images")).toBeNull();
    expect(storagePathFromUrl(null, "property-images")).toBeNull();
  });
});

describe("propertyMediaPaths", () => {
  it("junta fotos (con sus copias), videos, 360° y plano por bucket", () => {
    const paths = propertyMediaPaths({
      images: [`${base}/property-images/1-casa_rs.jpg`, `${base}/property-images/2-vieja.jpg`, "https://images.unsplash.com/demo.jpg"],
      videos: [`${base}/property-videos/1-tour.mp4`],
      tour_360_images: [`${base}/property-360/1-sala.jpg`],
      floor_plan_url: `${base}/property-images/plano-7-1700.png`,
    });
    expect(paths["property-images"]).toEqual(["1-casa_rs.jpg", "1-casa_rs.w480.webp", "1-casa_rs.w960.webp", "2-vieja.jpg", "plano-7-1700.png"]);
    expect(paths["property-videos"]).toEqual(["1-tour.mp4"]);
    expect(paths["property-360"]).toEqual(["1-sala.jpg"]);
  });
  it("una propiedad sin archivos propios (demo o fotos externas) no genera nada", () => {
    expect(propertyMediaPaths({ images: ["https://images.unsplash.com/x.jpg"] })).toEqual({});
    expect(propertyMediaPaths(null)).toEqual({});
  });
});
