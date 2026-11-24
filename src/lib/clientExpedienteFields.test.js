import { describe, expect, it } from "vitest";
import { clientExpedienteGroups, clientSheetData, clientSheetSections, missingRequiredClient, requiredClientKeys, requiredExpedienteKeys, CLIENT_BASIC_REQUIRED_KEYS } from "./clientExpedienteFields";

describe("clientExpedienteGroups", () => {
  it("cualquier tipo ve los datos personales", () => {
    expect(clientExpedienteGroups("comprador").map((g) => g.key)).toContain("personal");
    expect(clientExpedienteGroups("vendedor").map((g) => g.key)).toContain("personal");
  });

  it("un comprador ve datos personales, identificación del derechohabiente, crédito, empresa y referencias, pero no los datos de venta", () => {
    const groups = clientExpedienteGroups("comprador").map((g) => g.key);
    expect(groups).toEqual(["personal", "derechohabiente", "credito", "empresa", "referencias"]);
  });

  it("un vendedor solo ve, además de los personales, los datos de venta", () => {
    const groups = clientExpedienteGroups("vendedor").map((g) => g.key);
    expect(groups).toEqual(["personal", "venta"]);
  });

  it("un cliente 'ambos' ve todos los bloques", () => {
    const groups = clientExpedienteGroups("ambos").map((g) => g.key);
    expect(groups).toEqual(["personal", "derechohabiente", "credito", "empresa", "referencias", "venta"]);
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

describe("requiredExpedienteKeys", () => {
  it("sin INFONAVIT no se exige nada del expediente de crédito", () => {
    expect(requiredExpedienteKeys({ type: "comprador", financiamiento: "" })).toEqual([]);
    expect(requiredExpedienteKeys({ type: "ambos", financiamiento: "contado" })).toEqual([]);
  });

  it("con INFONAVIT el comprador debe dar NSS y contraseña del portal", () => {
    expect(requiredExpedienteKeys({ type: "comprador", financiamiento: "infonavit" })).toEqual(["nss", "contrasena_portal"]);
  });

  it("con INFONAVIT el vendedor debe dar el número de crédito", () => {
    expect(requiredExpedienteKeys({ type: "vendedor", financiamiento: "infonavit" })).toEqual(["numero_credito"]);
  });

  it("un cliente «ambos» con INFONAVIT debe dar los tres", () => {
    expect(requiredExpedienteKeys({ type: "ambos", financiamiento: "infonavit" })).toEqual(["nss", "contrasena_portal", "numero_credito"]);
  });
});

describe("datos básicos obligatorios", () => {
  it("nombre, teléfono, correo y todos los datos personales, con cualquier tipo de cliente", () => {
    expect(CLIENT_BASIC_REQUIRED_KEYS).toEqual(["name", "phone", "email", "fecha_nacimiento", "estado_civil", "domicilio", "rfc", "curp", "identificacion_oficial"]);
    for (const type of ["comprador", "vendedor", "ambos"]) {
      expect(requiredClientKeys({ type, financiamiento: "contado" })).toEqual(CLIENT_BASIC_REQUIRED_KEYS);
    }
  });

  it("con INFONAVIT se suman los datos de crédito, después de los básicos", () => {
    expect(requiredClientKeys({ type: "comprador", financiamiento: "infonavit" })).toEqual([...CLIENT_BASIC_REQUIRED_KEYS, "nss", "contrasena_portal"]);
  });
});

describe("missingRequiredClient", () => {
  const basicos = { name: "Ana", phone: "8711234567", email: "a@b.mx", fecha_nacimiento: "1990-01-01", estado_civil: "Soltero", domicilio: "Calle 1", rfc: "XAXX010101000", curp: "XEXX010101HNEXXXA4", identificacion_oficial: "123" };

  it("un cliente vacío debe todo, empezando por el nombre", () => {
    expect(missingRequiredClient({ type: "comprador" })).toEqual(CLIENT_BASIC_REQUIRED_KEYS);
  });

  it("lista lo que falta y no cuenta los espacios como dato", () => {
    expect(missingRequiredClient({ type: "comprador", ...basicos, email: "  ", curp: "" })).toEqual(["email", "curp"]);
  });

  it("con INFONAVIT también pide lo de crédito", () => {
    const client = { type: "ambos", financiamiento: "infonavit", ...basicos, nss: "12345678901", contrasena_portal: "   ", numero_credito: "" };
    expect(missingRequiredClient(client)).toEqual(["contrasena_portal", "numero_credito"]);
  });

  it("completo → nada falta", () => {
    expect(missingRequiredClient({ type: "comprador", financiamiento: "infonavit", ...basicos, nss: "1", contrasena_portal: "x" })).toEqual([]);
    expect(missingRequiredClient({ type: "vendedor", ...basicos })).toEqual([]);
  });
});
