import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extractPdfText, loadPdf } from "../../server/documentValidation/pdfText.js";
import { buildFichaTecnicaPdf } from "./propertyFichaPdf";

// La ficha en PDF que descarga el CLIENTE desde el sitio no debe llevar los datos de contacto de los asesores
// (la ficha pública a propósito no los publica: el interesado deja sus datos y el asesor le marca); la del panel sí.
const template = readFileSync(new URL("../../public/plantilla_acl.pdf", import.meta.url));
const property = {
  id: "prop-1",
  title: "Casa en Residencial Senderos",
  type: "casa",
  status: "disponible",
  zone: "Torreón",
  address: "Calle Roble 123",
  price: 2450000,
  area_m2: 180,
  bedrooms: 3,
  bathrooms: 2,
  parking: 2,
  description: "Casa amplia con jardín.",
  images: [],
  advisors: [{ name: "Asesora Prueba", phone: "871 555 1234", email: "asesora@acl.test" }],
};
const options = { typeLabel: "Casa", statusLabel: "Disponible", template };
const textOf = async (bytes) => extractPdfText(await loadPdf(bytes), { maxPages: 5 });

describe("ficha técnica en PDF", () => {
  it("la del panel lleva a los asesores con su teléfono y correo", async () => {
    const text = await textOf(await buildFichaTecnicaPdf(property, options));
    expect(text).toContain("Asesora Prueba");
    expect(text).toContain("871 555 1234");
    expect(text).toContain("asesora@acl.test");
  });

  it("la pública no lleva a los asesores ni sus datos, y sí el contacto de la oficina y el enlace", async () => {
    const text = await textOf(
      await buildFichaTecnicaPdf(property, {
        ...options,
        publicVersion: true,
        office: { phone: "871 324 3271", email: "inmobiliaria@aclpropiedades.com", url: "https://acl.test/propiedades/prop-1" },
      })
    );
    expect(text).not.toContain("Asesora Prueba");
    expect(text).not.toContain("871 555 1234");
    expect(text).not.toContain("asesora@acl.test");
    expect(text).not.toContain("ASESOR(ES) ASIGNADO(S)");
    expect(text).toContain("CONTACTO");
    expect(text).toContain("871 324 3271");
    expect(text).toContain("inmobiliaria@aclpropiedades.com");
    expect(text).toContain("https://acl.test/propiedades/prop-1");
    // Lo de siempre sigue ahí.
    expect(text).toContain("FICHA TECNICA DE LA PROPIEDAD");
    expect(text).toContain("CASA EN RESIDENCIAL SENDEROS");
    expect(text).toContain("Calle Roble 123");
  });

  it("la pública sin datos de oficina no agrega el bloque de contacto", async () => {
    const text = await textOf(await buildFichaTecnicaPdf(property, { ...options, publicVersion: true }));
    expect(text).not.toContain("CONTACTO");
    expect(text).not.toContain("Asesora Prueba");
  });
});
