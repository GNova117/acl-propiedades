import { describe, expect, it } from "vitest";
import {
  clientExpedientePayload,
  commissionFields,
  laborFields,
  materialFields,
  propertyFields,
  propertyStatusAfterHoldAdded,
  propertyStatusAfterHoldChange,
  siteUpdateFields,
  testimonialFields,
  zoneFields,
  zonePriceFields,
} from "./backendRules";

const form = { title: "Casa", type: "casa", description: "d", price: "1500000", area_m2: "120", bedrooms: "", bathrooms: "2", parking: "", zone: "Centro", address: "Calle 1", lat: "25.5", lng: "-103.4", mainImageIndex: 1 };
const media = { images: ["a.jpg", "b.jpg"], videos: [], tour_360_images: [] };

describe("propertyFields", () => {
  it("convierte números, deja en null lo vacío y elige la foto principal", () => {
    const p = propertyFields(form, media);
    expect(p).toMatchObject({ price: 1500000, area_m2: 120, bedrooms: null, bathrooms: 2, parking: null, lat: 25.5, lng: -103.4, main_image: "b.jpg", amenities: [], colindancias: null, altura_libre: null });
  });

  it("al crear: estatus «disponible» y activa por omisión; al editar se respeta lo del formulario", () => {
    expect(propertyFields(form, media, { isNew: true })).toMatchObject({ status: "disponible", active: true });
    expect(propertyFields({ ...form, active: false }, media, { isNew: true }).active).toBe(false);
    expect(propertyFields({ ...form, status: "vendida", active: false }, media)).toMatchObject({ status: "vendida", active: false });
  });

  it("la ubicación aproximada se guarda también al editar (el modo demo la olvidaba)", () => {
    expect(propertyFields({ ...form, location_approximate: true }, media).location_approximate).toBe(true);
    expect(propertyFields(form, media).location_approximate).toBe(false);
  });

  it("sin fotos la principal queda vacía", () => {
    expect(propertyFields(form, { images: [], videos: [], tour_360_images: [] }).main_image).toBe("");
  });
});

describe("apartados", () => {
  it("apartar solo mueve una propiedad disponible", () => {
    expect(propertyStatusAfterHoldAdded("disponible")).toBe("apartada");
    expect(propertyStatusAfterHoldAdded("vendida")).toBeNull();
  });
  it("cancelar un apartado libera la propiedad solo si seguía apartada", () => {
    expect(propertyStatusAfterHoldChange("cancelado", "apartada")).toBe("disponible");
    expect(propertyStatusAfterHoldChange("cancelado", "vendida")).toBeNull();
    expect(propertyStatusAfterHoldChange("concretado", "apartada")).toBeNull();
  });
});

describe("commissionFields", () => {
  it("redondea el monto y valida concepto, asesor y monto", () => {
    expect(commissionFields({ advisor_id: "a1", concept: "venta", amount: "1234.6" })).toEqual({ advisor_id: "a1", concept: "venta", amount: 1235 });
    expect(() => commissionFields({ advisor_id: "", concept: "venta", amount: 5 })).toThrow("commission:invalid");
    expect(() => commissionFields({ advisor_id: "a1", concept: "otra-cosa", amount: 5 })).toThrow("commission:invalid");
    expect(() => commissionFields({ advisor_id: "a1", concept: "venta", amount: -1 })).toThrow("commission:invalid");
    expect(() => commissionFields()).toThrow("commission:invalid");
  });
});

describe("contenido, zonas y catálogos", () => {
  it("testimonio: recorta, rol vacío es null y calificación por omisión 5", () => {
    expect(testimonialFields({ name: " Ana ", role: "  ", quote: " Excelente ", rating: "" })).toEqual({ name: "Ana", role: null, quote: "Excelente", rating: 5 });
    expect(testimonialFields({ name: "B", role: " Dueña ", quote: "q", rating: "4" }).rating).toBe(4);
  });
  it("novedad del sitio", () => {
    expect(siteUpdateFields({ title: " T ", body: " B " })).toEqual({ title: "T", body: "B" });
  });
  it("zona y precios", () => {
    expect(zoneFields({ name: " Centro ", price_per_m2: "1200", land_price_per_m2: "" })).toEqual({ name: "Centro", price_per_m2: 1200, land_price_per_m2: 0 });
    expect(zonePriceFields("900")).toEqual({ price_per_m2: 900 });
    expect(zonePriceFields("900", "300")).toEqual({ price_per_m2: 900, land_price_per_m2: 300 });
    expect(zonePriceFields("900", "x")).toEqual({ price_per_m2: 900, land_price_per_m2: 0 });
  });
  it("material: vacío es null, activo por omisión", () => {
    expect(materialFields({ name: "Cemento", unit_price_internal: "", unit_price_external: "50", consumption_rate: "", category: "" })).toMatchObject({ name: "Cemento", category: null, unit_price_internal: null, unit_price_external: 50, consumption_rate: null, active: true });
    expect(materialFields({ name: "x", active: false }).active).toBe(false);
  });
  it("mano de obra", () => {
    expect(laborFields({ concepto: " Pintura ", unidad: " ", precio_unitario: "" })).toEqual({ concepto: "Pintura", unidad: null, precio_unitario: null });
  });
  it("expediente del cliente: solo los campos del expediente, vacíos en null", () => {
    const payload = clientExpedientePayload({ nss: "123", intruso: "x" });
    expect(payload.nss).toBe("123");
    expect(payload).not.toHaveProperty("intruso");
  });
});
