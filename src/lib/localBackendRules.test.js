import { beforeEach, describe, expect, it } from "vitest";

// 500: el modo demo usa las mismas reglas compartidas (backendRules) que Supabase. Aquí se comprueba con el backend de demo real.
const store = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  },
};

const { localBackend: db } = await import("./localBackend");
const { PROPERTIES } = await import("./seedData");

const base = PROPERTIES.find((p) => p.active && p.status === "disponible");
const form = (extra = {}) => ({
  title: base.title, type: base.type, description: base.description, price: base.price, area_m2: base.area_m2, bedrooms: "", bathrooms: "", parking: "",
  zone: base.zone, address: base.address, lat: base.lat, lng: base.lng, status: "disponible", active: true, existingImages: base.images, ...extra,
});

beforeEach(() => store.clear());

describe("modo demo: reglas compartidas", () => {
  it("al editar una propiedad se guarda también la ubicación aproximada", async () => {
    await db.updateProperty(base.id, form({ location_approximate: true }));
    expect((await db.getPropertyById(base.id)).location_approximate).toBe(true);
    await db.updateProperty(base.id, form({ location_approximate: false }));
    expect((await db.getPropertyById(base.id)).location_approximate).toBe(false);
  });

  it("testimonio: se recorta y la calificación vacía vale 5", async () => {
    const t = await db.addTestimonial({ name: " Ana ", role: " ", quote: " Muy bien ", rating: "" });
    expect(t).toMatchObject({ name: "Ana", role: null, quote: "Muy bien", rating: 5, active: true });
  });

  it("comisión inválida se rechaza con el mismo código que en Supabase", async () => {
    await expect(db.saveCommission(base.id, { advisor_id: "", concept: "venta", amount: 10 })).rejects.toThrow("commission:invalid");
  });
});
