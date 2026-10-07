import { describe, expect, it } from "vitest";
import { validateSections } from "./perfilamientoShared";
import { GRAVAMENES, VENDEDOR_SECTIONS, vendedorExtraRules } from "./perfilamientoVendedor";

describe("vendedorExtraRules", () => {
  it("exige el detalle del gravamen solo cuando hay gravamen", () => {
    expect(vendedorExtraRules({ gravamenes: "Con gravamen", gravamenes_detalle: "" })).toEqual({ gravamenes_detalle: "Describe el gravamen" });
    expect(vendedorExtraRules({ gravamenes: "Con gravamen", gravamenes_detalle: "   " })).toEqual({ gravamenes_detalle: "Describe el gravamen" });
  });

  it("sin gravamen, o con el detalle ya capturado, no hay error", () => {
    expect(vendedorExtraRules({ gravamenes: "Libre de gravamen", gravamenes_detalle: "" })).toEqual({});
    expect(vendedorExtraRules({ gravamenes: "Con gravamen", gravamenes_detalle: "Hipoteca con Banco X" })).toEqual({});
  });
});

describe("VENDEDOR_SECTIONS integrado con el motor genérico de validación", () => {
  const baseForm = {
    nombre_completo: "Ana López",
    fecha_nacimiento: "1990-01-01",
    domicilio: "Calle 1 #23",
    ubicacion: "Calle 1 #23",
    gravamenes: "Libre de gravamen",
  };

  it("un formulario completo sin gravamen no tiene errores", () => {
    const errors = validateSections(VENDEDOR_SECTIONS, baseForm, vendedorExtraRules);
    expect(errors).toEqual({});
  });

  it("el campo 'detalle del gravamen' se oculta (y no se exige) hasta que se elige 'Con gravamen'", () => {
    const field = VENDEDOR_SECTIONS.flatMap((s) => s.fields).find((f) => f.key === "gravamenes_detalle");
    expect(field.dependsOn).toEqual({ field: "gravamenes", value: GRAVAMENES[1] });
    expect(validateSections(VENDEDOR_SECTIONS, baseForm, vendedorExtraRules).gravamenes_detalle).toBeUndefined();
  });

  it("al elegir 'Con gravamen' sin detalle, la regla cruzada del vendedor sí lo exige", () => {
    const errors = validateSections(VENDEDOR_SECTIONS, { ...baseForm, gravamenes: "Con gravamen" }, vendedorExtraRules);
    expect(errors.gravamenes_detalle).toBe("Describe el gravamen");
  });

  it("faltando un campo requerido (nombre), el motor genérico lo marca sin que el vendedor defina esa regla", () => {
    const errors = validateSections(VENDEDOR_SECTIONS, { ...baseForm, nombre_completo: "" }, vendedorExtraRules);
    expect(errors.nombre_completo).toBeTruthy();
  });
});
