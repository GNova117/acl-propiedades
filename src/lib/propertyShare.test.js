import { describe, expect, it } from "vitest";
import { propertiesShareMessage, propertyShareMessage } from "./propertyShare";

const origin = "https://acl.mx";
const casa = { id: "7", code: "C-7", title: "Casa en Lerdo", zone: "Lerdo", price: 1500000, bedrooms: 3, bathrooms: 2, area_m2: 120, operation_type: "venta" };
const depa = { id: "8", title: "Depa Centro", zone: "Torreón", price: 8000, operation_type: "renta" };

describe("propertyShareMessage", () => {
  it("incluye título, código, zona, precio, datos y el enlace público", () => {
    const text = propertyShareMessage(casa, { origin, recipientName: "Ana López" });
    expect(text.startsWith("Hola Ana,")).toBe(true);
    expect(text).toContain("Casa en Lerdo (C-7)");
    expect(text).toContain("📍 Lerdo");
    expect(text).toContain("🛏 3 recámaras");
    expect(text).toContain("https://acl.mx/propiedades/7");
  });

  it("en renta aclara que el precio es al mes", () => {
    expect(propertyShareMessage(depa, { origin })).toMatch(/al mes/);
    expect(propertyShareMessage(casa, { origin })).not.toMatch(/al mes/);
  });

  it("sin nombre saluda con 'Hola,' y sin dejar 'undefined'", () => {
    const text = propertyShareMessage(depa, { origin });
    expect(text.startsWith("Hola,")).toBe(true);
    expect(text).not.toMatch(/undefined|null/);
  });

  it("firma con el asesor solo si se conoce", () => {
    expect(propertyShareMessage(casa, { origin, advisorName: "Luis" })).toContain("— Luis, ACL Propiedades");
    expect(propertyShareMessage(casa, { origin })).not.toContain("—");
  });
});

describe("propertiesShareMessage", () => {
  it("lista las propiedades numeradas, con un enlace cada una", () => {
    const text = propertiesShareMessage([casa, depa], { origin, recipientName: "Ana" });
    expect(text).toContain("1. 🏡 Casa en Lerdo");
    expect(text).toContain("2. 🏡 Depa Centro");
    expect(text).toContain("https://acl.mx/propiedades/8");
  });

  it("respeta el límite", () => {
    const many = Array.from({ length: 6 }, (_, i) => ({ ...casa, id: String(i), title: `Casa ${i}` }));
    const text = propertiesShareMessage(many, { origin, limit: 3 });
    expect(text).toContain("Casa 2");
    expect(text).not.toContain("Casa 3");
  });

  it("con una sola propiedad usa el mensaje de una propiedad; sin ninguna, texto vacío", () => {
    expect(propertiesShareMessage([casa], { origin })).toBe(propertyShareMessage(casa, { origin }));
    expect(propertiesShareMessage([], { origin })).toBe("");
  });
});
