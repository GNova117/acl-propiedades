import { describe, expect, it } from "vitest";
import { COMPLETE_FROM, propertyCompleteness } from "./propertyCompleteness";

const full = (extra = {}) => ({
  type: "casa",
  images: ["a", "b", "c", "d", "e", "f"],
  description: "x".repeat(150),
  lat: 25.5,
  lng: -103.4,
  address: "Calle Roble 123",
  price: 2000000,
  area_m2: 150,
  bedrooms: 3,
  bathrooms: 2,
  parking: 2,
  zone: "Torreón",
  advisor_ids: ["a1"],
  videos: ["v"],
  amenities: ["alberca"],
  floor_plan_url: "plano.png",
  ...extra,
});

describe("propertyCompleteness", () => {
  it("una casa con todo está al 100 % y no le falta nada", () => {
    const r = propertyCompleteness(full());
    expect(r.percent).toBe(100);
    expect(r.complete).toBe(true);
    expect(r.missing).toEqual([]);
  });

  it("una propiedad vacía está en 0 % y le falta todo", () => {
    const r = propertyCompleteness({ type: "casa" });
    expect(r.percent).toBe(0);
    expect(r.complete).toBe(false);
    expect(r.missing).toEqual(expect.arrayContaining(["photos", "description", "location", "specs", "advisor"]));
  });

  it("las fotos cuentan proporcional y lo que más pesa va primero en lo que falta", () => {
    const r = propertyCompleteness(full({ images: ["a", "b"] }));
    const photos = r.items.find((i) => i.key === "photos");
    expect(photos.progress).toBeCloseTo(0.4);
    expect(r.missing).toEqual(["photos"]);
    expect(r.percent).toBe(100 - Math.round(20 * 0.6));
  });

  it("la ubicación pide coordenadas Y dirección; (0, 0) no es una ubicación", () => {
    expect(propertyCompleteness(full({ address: "" })).missing).toContain("location");
    expect(propertyCompleteness(full({ lat: 0, lng: 0 })).missing).toContain("location");
    expect(propertyCompleteness(full({ lat: null, lng: null })).missing).toContain("location");
  });

  it("una descripción corta cuenta a medias y una de 120 caracteres o más, completa", () => {
    expect(propertyCompleteness(full({ description: "x".repeat(60) })).items.find((i) => i.key === "description").progress).toBeCloseTo(0.5);
    expect(propertyCompleteness(full({ description: "x".repeat(120) })).items.find((i) => i.key === "description").ok).toBe(true);
  });

  it("los datos propios cambian con el tipo: terreno, nave y vivienda", () => {
    expect(propertyCompleteness(full({ type: "terreno", bedrooms: null, bathrooms: null, parking: null, servicios: "agua y luz" })).missing).not.toContain("specs");
    expect(propertyCompleteness(full({ type: "terreno", bedrooms: 3, servicios: "", colindancias: "" })).missing).toContain("specs");
    expect(propertyCompleteness(full({ type: "nave_industrial", altura_libre: 9, andenes_carga: 4 })).missing).not.toContain("specs");
    expect(propertyCompleteness(full({ type: "nave_industrial", altura_libre: 9 })).missing).toContain("specs");
    expect(propertyCompleteness(full({ parking: null })).missing).toContain("specs");
  });

  it("amenidades y plano solo se piden en casas y departamentos", () => {
    const nave = propertyCompleteness(full({ type: "nave_industrial", altura_libre: 9, andenes_carga: 4, amenities: [], floor_plan_url: null }));
    expect(nave.items.map((i) => i.key)).not.toContain("amenities");
    expect(nave.items.map((i) => i.key)).not.toContain("plan");
    expect(propertyCompleteness(full({ amenities: [], floor_plan_url: null })).missing).toEqual(expect.arrayContaining(["amenities", "plan"]));
  });

  it("un recorrido 360° cuenta igual que un video, y el asesor se lee de advisor_ids o advisors", () => {
    expect(propertyCompleteness(full({ videos: [], tour_360_images: ["t"] })).missing).not.toContain("media");
    expect(propertyCompleteness(full({ videos: [] })).missing).toContain("media");
    expect(propertyCompleteness(full({ advisor_ids: [], advisors: [{ id: "a" }] })).missing).not.toContain("advisor");
    expect(propertyCompleteness(full({ advisor_ids: [] })).missing).toContain("advisor");
  });

  it("el corte de «completa» es el declarado", () => {
    const justUnder = propertyCompleteness(full({ images: [], advisor_ids: [], videos: [] })); // faltan 35 %
    expect(justUnder.percent).toBeLessThan(COMPLETE_FROM);
    expect(justUnder.complete).toBe(false);
  });
});
