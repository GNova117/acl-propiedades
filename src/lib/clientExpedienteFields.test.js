import { describe, expect, it } from "vitest";
import { CLIENT_ESTADOS_CIVILES, clientExpedienteGroups, clientSheetData, clientSheetSections, missingRequiredClient, requiredClientKeys } from "./clientExpedienteFields";

const keys = (groups) => groups.map((g) => g.key);

describe("clientExpedienteGroups", () => {
  it("cualquier tipo ve datos personales, referencias y datos del crédito Infonavit", () => {
    for (const type of ["comprador", "vendedor", "ambos"]) {
      expect(keys(clientExpedienteGroups(type))).toEqual(expect.arrayContaining(["personal", "referencias", "credito"]));
    }
  });

  it("un comprador ve además la empresa y la identificación del derechohabiente", () => {
    expect(keys(clientExpedienteGroups("comprador"))).toEqual(["personal", "empresa", "referencias", "derechohabiente", "credito"]);
    expect(keys(clientExpedienteGroups("ambos"))).toEqual(["personal", "empresa", "referencias", "derechohabiente", "credito"]);
  });

  it("un vendedor no ve la empresa ni la identificación del derechohabiente", () => {
    expect(keys(clientExpedienteGroups("vendedor"))).toEqual(["personal", "referencias", "credito"]);
  });

  it("solo la identificación del derechohabiente y el crédito se piden únicamente con INFONAVIT", () => {
    const soloInfonavit = clientExpedienteGroups("comprador").filter((g) => g.onlyInfonavit);
    expect(keys(soloInfonavit)).toEqual(["derechohabiente", "credito"]);
  });

  it("el crédito trae número de crédito, NSS y contraseña de Mi Cuenta Infonavit para cualquier tipo", () => {
    for (const type of ["comprador", "vendedor"]) {
      const credito = clientExpedienteGroups(type).find((g) => g.key === "credito");
      expect(credito.fields.map((f) => f.key)).toEqual(["numero_credito", "nss", "contrasena_portal"]);
      expect(credito.fields[2].label).toBe("Contraseña de Mi Cuenta Infonavit");
    }
  });

  it("el estado civil solo ofrece casado o soltero", () => {
    expect(CLIENT_ESTADOS_CIVILES).toEqual(["Soltero", "Casado"]);
    const personal = clientExpedienteGroups("comprador").find((g) => g.key === "personal");
    expect(personal.fields.find((f) => f.key === "estado_civil").options).toEqual(["Soltero", "Casado"]);
  });
});

describe("clientSheetSections", () => {
  it("un vendedor tiene la hoja de datos y las referencias (sin empresa ni derechohabiente)", () => {
    expect(keys(clientSheetSections({ type: "vendedor" }))).toEqual(["cliente", "referencias"]);
  });

  it("un comprador incluye derechohabiente, empresa y referencias como secciones opcionales", () => {
    const sections = clientSheetSections({ type: "comprador" });
    expect(keys(sections)).toEqual(["cliente", "derechohabiente", "empresa", "referencias"]);
    for (const key of ["derechohabiente", "empresa", "referencias"]) expect(sections.find((s) => s.key === key).optional).toBe(true);
  });

  it("la hoja de datos incluye los campos del crédito Infonavit con cualquier tipo", () => {
    for (const type of ["comprador", "vendedor", "ambos"]) {
      const fields = clientSheetSections({ type })[0].fields.map((f) => f.key);
      expect(fields).toEqual(expect.arrayContaining(["numero_credito", "nss", "contrasena_portal"]));
    }
  });
});

describe("clientSheetData", () => {
  it("deriva el rol legible a partir del tipo de cliente", () => {
    expect(clientSheetData({ type: "comprador" }).rol).toBe("Comprador");
    expect(clientSheetData({ type: "ambos" }).rol).toBe("Comprador y vendedor");
  });

  it("conserva el resto de los datos del cliente intactos", () => {
    expect(clientSheetData({ type: "vendedor", name: "Ana" }).name).toBe("Ana");
  });
});

const REFERENCIAS = ["referencia1_nombre", "referencia1_telefono", "referencia2_nombre", "referencia2_telefono"];

describe("requiredClientKeys", () => {
  it("comprador: nombre, teléfono, fecha de nacimiento, estado civil, domicilio, RFC, CURP, teléfono de su empresa y 2 referencias", () => {
    expect(requiredClientKeys({ type: "comprador" })).toEqual(["name", "phone", "fecha_nacimiento", "estado_civil", "domicilio", "rfc", "curp", "tel_empresa", ...REFERENCIAS]);
  });

  it("«ambos» pide lo mismo que el comprador", () => {
    expect(requiredClientKeys({ type: "ambos" })).toEqual(requiredClientKeys({ type: "comprador" }));
  });

  it("vendedor: nombre, fecha de nacimiento, domicilio, estado civil y 2 referencias", () => {
    expect(requiredClientKeys({ type: "vendedor" })).toEqual(["name", "fecha_nacimiento", "estado_civil", "domicilio", ...REFERENCIAS]);
  });

  it("no se exige el correo ni la identificación oficial", () => {
    for (const type of ["comprador", "vendedor"]) {
      const required = requiredClientKeys({ type, financiamiento: "infonavit" });
      expect(required).not.toContain("email");
      expect(required).not.toContain("identificacion_oficial");
    }
  });

  it("con INFONAVIT, comprador y vendedor suman número de crédito, NSS y contraseña de Mi Cuenta Infonavit", () => {
    for (const type of ["comprador", "vendedor", "ambos"]) {
      expect(requiredClientKeys({ type, financiamiento: "infonavit" }).slice(-3)).toEqual(["numero_credito", "nss", "contrasena_portal"]);
      expect(requiredClientKeys({ type, financiamiento: "contado" })).not.toContain("nss");
      expect(requiredClientKeys({ type, financiamiento: "" })).not.toContain("numero_credito");
    }
  });
});

describe("missingRequiredClient", () => {
  const referencias = { referencia1_nombre: "Ana", referencia1_telefono: "8711111111", referencia2_nombre: "Luis", referencia2_telefono: "8712222222" };
  const vendedor = { type: "vendedor", name: "Rosa Pérez", fecha_nacimiento: "1980-02-03", estado_civil: "Casado", domicilio: "Calle 1", ...referencias };
  const comprador = { ...vendedor, type: "comprador", phone: "8713333333", rfc: "XAXX010101000", curp: "XEXX010101HNEXXXA4", tel_empresa: "8714444444" };

  it("un cliente vacío debe todo, empezando por el nombre", () => {
    expect(missingRequiredClient({ type: "comprador" })).toEqual(requiredClientKeys({ type: "comprador" }));
  });

  it("completo → nada falta", () => {
    expect(missingRequiredClient(vendedor)).toEqual([]);
    expect(missingRequiredClient(comprador)).toEqual([]);
  });

  it("un vendedor no necesita teléfono, RFC ni CURP; un comprador sí", () => {
    expect(missingRequiredClient({ ...vendedor, phone: "", rfc: "", curp: "" })).toEqual([]);
    expect(missingRequiredClient({ ...comprador, phone: "", rfc: "", curp: "", tel_empresa: "" })).toEqual(["phone", "rfc", "curp", "tel_empresa"]);
  });

  it("lista lo que falta y no cuenta los espacios como dato", () => {
    expect(missingRequiredClient({ ...comprador, domicilio: "   ", referencia2_telefono: "" })).toEqual(["domicilio", "referencia2_telefono"]);
  });

  it("con INFONAVIT también pide lo de crédito", () => {
    const client = { ...comprador, financiamiento: "infonavit", nss: "12345678901", contrasena_portal: "  " };
    expect(missingRequiredClient(client)).toEqual(["numero_credito", "contrasena_portal"]);
    expect(missingRequiredClient({ ...vendedor, financiamiento: "infonavit" })).toEqual(["numero_credito", "nss", "contrasena_portal"]);
  });
});
