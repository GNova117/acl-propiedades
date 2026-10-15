import { describe, expect, it } from "vitest";
import { buildPlaceholderContext, buildTemplateContent, renderPlaceholders } from "./documentTemplates";

describe("renderPlaceholders", () => {
  it("rellena marcadores conocidos con su valor", () => {
    const context = { "cliente.nombre": "Ana López", fecha: "1 de enero de 2026" };
    expect(renderPlaceholders("Hola {{cliente.nombre}}, hoy es {{fecha}}.", context)).toBe("Hola Ana López, hoy es 1 de enero de 2026.");
  });

  it("deja intacto un marcador desconocido (no lo borra)", () => {
    expect(renderPlaceholders("Valor: {{algo.raro}}", {})).toBe("Valor: {{algo.raro}}");
  });

  it("tolera espacios dentro de las llaves", () => {
    expect(renderPlaceholders("{{ cliente.nombre }}", { "cliente.nombre": "Ana" })).toBe("Ana");
  });
});

describe("buildPlaceholderContext", () => {
  it("usa cadenas vacías cuando no hay cliente/propiedad/asesor", () => {
    const context = buildPlaceholderContext({});
    expect(context["cliente.nombre"]).toBe("");
    expect(context["propiedad.titulo"]).toBe("");
    expect(context["asesor.nombre"]).toBe("");
    expect(context.lugar).toBe("Torreón, Coahuila");
  });

  it("antepone 'campo.' a los valores personalizados", () => {
    const context = buildPlaceholderContext({ customValues: { motivo: "Renovación" } });
    expect(context["campo.motivo"]).toBe("Renovación");
  });

  it("formatea el precio de la propiedad en MXN", () => {
    const context = buildPlaceholderContext({ property: { price: 1500000 } });
    expect(context["propiedad.precio"]).toContain("1,500,000");
  });
});

describe("buildTemplateContent", () => {
  const template = { name: "Carta de bienvenida", body: "Estimado {{cliente.nombre}}:\n\nBienvenido a {{propiedad.titulo}}.", requires_signatures: true };
  const client = { name: "Juan Pérez" };
  const property = { title: "Casa Los Pinos" };

  it("separa el cuerpo en párrafos por línea en blanco", () => {
    const content = buildTemplateContent(template, { client, property });
    expect(content.paragraphs).toEqual(["Estimado Juan Pérez:", "Bienvenido a Casa Los Pinos."]);
  });

  it("usa el nombre de la plantilla como título", () => {
    const content = buildTemplateContent(template, { client, property });
    expect(content.title).toBe("Carta de bienvenida");
  });

  it("incluye firmas de cliente y oficina cuando requires_signatures es true", () => {
    const content = buildTemplateContent(template, { client, property, advisor: { name: "María" } });
    expect(content.signatures).toEqual([
      { label: "Cliente", name: "Juan Pérez" },
      { label: "ACL Propiedades", name: "Asesor: María" },
    ]);
  });

  it("no incluye firmas cuando requires_signatures es false", () => {
    const content = buildTemplateContent({ ...template, requires_signatures: false }, { client, property });
    expect(content.signatures).toEqual([]);
  });
});
