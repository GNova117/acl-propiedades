import { describe, expect, it } from "vitest";
import { buildCaption, postFileName, propertyUrl } from "./socialPost";

describe("propertyUrl", () => {
  it("arma la URL pública de la propiedad sobre el dominio dado", () => {
    expect(propertyUrl({ id: "p1" }, "https://aclpropiedades.com")).toBe("https://aclpropiedades.com/propiedades/p1");
  });
});

describe("buildCaption", () => {
  it("con una propiedad mínima, omite las líneas que no aplican en vez de dejarlas vacías", () => {
    const caption = buildCaption({ id: "p1", title: "Casa X", price: 1000000, type: "casa", operation_type: "venta" }, { origin: "https://acl.test" });
    expect(caption).toBe(
      "🏡 Casa X\n💰 $1,000,000\n\n📲 Más fotos y datos: https://acl.test/propiedades/p1\n💬 WhatsApp: 871 324 3271\n\n#BienesRaíces #LaComarcaLagunera #CasaEnVenta #ACLPropiedades"
    );
  });

  it("una renta agrega 'al mes' al precio y usa el hashtag EnRenta", () => {
    const caption = buildCaption({ id: "p1", title: "Depa", price: 10000, type: "departamento", operation_type: "renta" }, { origin: "https://acl.test" });
    expect(caption).toContain("💰 $10,000 al mes");
    expect(caption).toContain("#DepartamentoEnRenta");
  });

  it("incluye el código entre paréntesis y la zona como hashtag sin acentos", () => {
    const caption = buildCaption({ id: "p1", title: "Casa X", code: "C-100", zone: "Lomas del Sol", price: 1000000, type: "casa", operation_type: "venta" }, { origin: "https://acl.test" });
    expect(caption).toContain("🏡 Casa X (C-100)");
    expect(caption).toContain("📍 Lomas del Sol");
    expect(caption).toContain("#LomasdelSol");
  });

  it("la línea de datos usa singular/plural correctamente y solo incluye lo que la propiedad tiene", () => {
    const caption = buildCaption({ id: "p1", title: "Casa X", price: 1000000, type: "casa", operation_type: "venta", bedrooms: 1, bathrooms: 2, area_m2: 150 }, { origin: "https://acl.test" });
    expect(caption).toContain("🛏 1 recámara");
    expect(caption).toContain("🛁 2 baños");
    expect(caption).toContain("📐 150 m²");
    expect(caption).not.toContain("🚗"); // sin cajones, no aparece la línea de cochera
  });

  it("recorta la descripción larga a 200 caracteres con puntos suspensivos", () => {
    const longDescription = "A".repeat(250);
    const caption = buildCaption({ id: "p1", title: "Casa X", price: 1000000, type: "casa", operation_type: "venta", description: longDescription }, { origin: "https://acl.test" });
    expect(caption).toContain("A".repeat(197) + "…");
    expect(caption).not.toContain("A".repeat(198));
  });
});

describe("postFileName", () => {
  it("usa el código de la propiedad si lo tiene, antes que el título (el guión también se normaliza a guión bajo)", () => {
    expect(postFileName({ code: "C-100", title: "Casa X" })).toBe("C_100");
  });

  it("quita acentos y caracteres especiales, usando guión bajo como separador", () => {
    expect(postFileName({ title: "Casa en Lomás del Sol" })).toBe("Casa_en_Lomas_del_Sol");
  });

  it("agrega el sufijo pedido y usa 'propiedad' si no hay ni código ni título", () => {
    expect(postFileName({}, "_1080x1350.jpg")).toBe("propiedad_1080x1350.jpg");
  });

  it("recorta el nombre a 40 caracteres antes de agregar el sufijo", () => {
    const name = postFileName({ title: "Casa ".repeat(20) }, ".jpg");
    expect(name.replace(".jpg", "").length).toBeLessThanOrEqual(40);
  });
});
