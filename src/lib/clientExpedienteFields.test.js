import { describe, expect, it } from "vitest";
import { clientExpedienteGroups, clientSheetData, clientSheetSections } from "./clientExpedienteFields";

describe("clientExpedienteGroups", () => {
  it("un comprador ve identificación del derechohabiente, crédito, empresa y referencias, pero no los datos de venta", () => {
    const groups = clientExpedienteGroups("comprador").map((g) => g.key);
    expect(groups).toEqual(["derechohabiente", "credito", "empresa", "referencias"]);
  });

  it("un vendedor solo ve los datos de venta", () => {
    const groups = clientExpedienteGroups("vendedor").map((g) => g.key);
    expect(groups).toEqual(["venta"]);
  });

  it("un cliente 'ambos' ve todos los bloques", () => {
    const groups = clientExpedienteGroups("ambos").map((g) => g.key);
    expect(groups).toEqual(["derechohabiente", "credito", "empresa", "referencias", "venta"]);
  });
});

describe("clientSheetSections", () => {
  it("un vendedor solo tiene la sección de datos del cliente (sin empresa ni referencias)", () => {
    const sections = clientSheetSections({ type: "vendedor" });
    expect(sections).toHaveLength(1);
    expect(sections[0].key).toBe("cliente");
  });

  it("un comprador incluye identificación del derechohabiente, empresa y referencias como secciones opcionales", () => {
    const sections = clientSheetSections({ type: "comprador" });
    expect(sections.map((s) => s.key)).toEqual(["cliente", "derechohabiente", "empresa", "referencias"]);
    expect(sections.find((s) => s.key === "empresa").optional).toBe(true);
    expect(sections.find((s) => s.key === "derechohabiente").optional).toBe(true);
  });

  it("la sección de datos del cliente incluye los campos de crédito solo si no es vendedor", () => {
    const compradorFields = clientSheetSections({ type: "comprador" })[0].fields.map((f) => f.key);
    expect(compradorFields).toContain("nss");
    const vendedorFields = clientSheetSections({ type: "vendedor" })[0].fields.map((f) => f.key);
    expect(vendedorFields).not.toContain("nss");
    expect(vendedorFields).toContain("numero_credito");
  });
});

describe("clientSheetData", () => {
  it("deriva el rol legible a partir del tipo de cliente", () => {
    expect(clientSheetData({ type: "comprador" }).rol).toBe("Comprador");
    expect(clientSheetData({ type: "ambos" }).rol).toBe("Comprador y vendedor");
  });

  it("conserva el resto de los datos del cliente intactos", () => {
    const data = clientSheetData({ type: "vendedor", name: "Ana" });
    expect(data.name).toBe("Ana");
  });
});
