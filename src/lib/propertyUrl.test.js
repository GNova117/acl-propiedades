import { describe, expect, it } from "vitest";
import { isCanonicalSlug, listPathForMissingProperty, parsePropertyRef, normalizePropertyCode, propertyPath, propertySlug } from "./propertyUrl";

const casa = { id: "8d1f6b1e-3c9a-4d57-8a6e-0c2f7d9b1a44", code: "ACL-1001", title: "Casa en Residencial Senderos, con alberca y jardín" };

describe("propertySlug / propertyPath", () => {
  it("título legible (sin acentos ni signos) y el código al final", () => {
    expect(propertySlug(casa)).toBe("casa-en-residencial-senderos-con-alberca-y-jardin-ACL-1001");
    expect(propertyPath(casa)).toBe("/propiedades/casa-en-residencial-senderos-con-alberca-y-jardin-ACL-1001");
  });
  it("un título larguísimo se recorta sin cortar el código", () => {
    const slug = propertySlug({ ...casa, title: "x".repeat(400) });
    expect(slug.endsWith("-ACL-1001")).toBe(true);
    expect(slug.length).toBeLessThan(90);
  });
  it("sin código usa el identificador; con título vacío, solo el código", () => {
    expect(propertySlug({ id: "prop-1", title: "Algo" })).toBe("prop-1");
    expect(propertySlug({ id: "x", code: "acl-7", title: "" })).toBe("ACL-7");
    expect(propertySlug({ id: "x", code: "raro", title: "Algo" })).toBe("x");
  });
});

describe("parsePropertyRef", () => {
  it("un identificador (uuid) o uno de demostración se busca por id", () => {
    expect(parsePropertyRef(casa.id)).toEqual({ kind: "id", id: casa.id });
    expect(parsePropertyRef("prop-1")).toEqual({ kind: "id", id: "prop-1" });
  });
  it("una dirección con título y código se busca por código (sin importar mayúsculas)", () => {
    expect(parsePropertyRef("casa-en-senderos-ACL-1001")).toEqual({ kind: "code", code: "ACL-1001" });
    expect(parsePropertyRef("casa-en-senderos-acl-1001")).toEqual({ kind: "code", code: "ACL-1001" });
    expect(parsePropertyRef("ACL-1001")).toEqual({ kind: "code", code: "ACL-1001" });
  });
  it("lo vacío no busca nada", () => {
    expect(parsePropertyRef("")).toBeNull();
    expect(parsePropertyRef(undefined)).toBeNull();
  });
  it("ida y vuelta: la dirección de una propiedad vuelve a ella", () => {
    expect(parsePropertyRef(propertySlug(casa))).toEqual({ kind: "code", code: casa.code });
  });
});

describe("isCanonicalSlug", () => {
  it("la dirección vieja (con el identificador) no es la canónica", () => {
    expect(isCanonicalSlug(propertySlug(casa), casa)).toBe(true);
    expect(isCanonicalSlug(casa.id, casa)).toBe(false);
    expect(isCanonicalSlug("titulo-viejo-ACL-1001", casa)).toBe(false);
  });
});

describe("normalizePropertyCode", () => {
  it("acepta el código completo, con espacio, pegado o solo el número", () => {
    for (const input of ["ACL-1001", "acl-1001", " acl 1001 ", "ACL1001", "1001"]) expect(normalizePropertyCode(input)).toBe("ACL-1001");
  });
  it("lo que no es un código se deja tal cual (en mayúsculas)", () => {
    expect(normalizePropertyCode("casa bonita")).toBe("CASA BONITA");
    expect(normalizePropertyCode("")).toBe("");
  });
});

describe("listPathForMissingProperty", () => {
  it("adivina el listado por el título de la dirección", () => {
    expect(listPathForMissingProperty("terreno-en-torreon-ACL-1004")).toBe("/terrenos");
    expect(listPathForMissingProperty("nave-industrial-en-lerdo-ACL-1005")).toBe("/naves-industriales");
    expect(listPathForMissingProperty("casa-en-venta-ACL-1001")).toBe("/propiedades");
    expect(listPathForMissingProperty("5f0c")).toBe("/propiedades");
    expect(listPathForMissingProperty(undefined)).toBe("/propiedades");
  });
});
