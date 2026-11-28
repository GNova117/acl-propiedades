import { describe, expect, it } from "vitest";
import { composeMessage, contactPathWithMessage, MAX_PREFILL, prefillMessage, topicFromSearch } from "./contactPrefill";

describe("prefillMessage", () => {
  it("lee ?mensaje= y recorta espacios", () => {
    expect(prefillMessage("?mensaje=%20Hola%20mundo%20")).toBe("Hola mundo");
  });
  it("sin parámetro es vacío", () => {
    expect(prefillMessage("")).toBe("");
    expect(prefillMessage(undefined)).toBe("");
  });
  it("limita la longitud", () => {
    expect(prefillMessage(`?mensaje=${"a".repeat(2000)}`)).toHaveLength(MAX_PREFILL);
  });
});

describe("contactPathWithMessage", () => {
  it("ida y vuelta con acentos y saltos de línea", () => {
    const msg = "Error en ACL-1001:\nel precio no coincide";
    const path = contactPathWithMessage(msg);
    expect(path.startsWith("/contacto?mensaje=")).toBe(true);
    expect(prefillMessage(path.slice(path.indexOf("?")))).toBe(msg);
  });
  it("sin texto lleva a /contacto", () => {
    expect(contactPathWithMessage("  ")).toBe("/contacto");
  });
});

describe("motivo de contacto", () => {
  it("lee ?motivo= solo si es uno conocido", () => {
    expect(topicFromSearch("?motivo=rentar_mia")).toBe("rentar_mia");
    expect(topicFromSearch("?motivo=otra-cosa")).toBe("");
    expect(topicFromSearch("")).toBe("");
  });
  it("el motivo va como prefijo del mensaje", () => {
    expect(composeMessage("Quiero comprar", " Busco casa ")).toBe("[Quiero comprar] Busco casa");
    expect(composeMessage("", "Hola")).toBe("Hola");
  });
});
