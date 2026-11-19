import { describe, expect, it } from "vitest";
import {
  emptyIntakeForm,
  generateIntakeToken,
  INTAKE_TOKEN_PATTERN,
  INTAKE_VALID_DAYS,
  intakeExpiry,
  intakeFieldKeys,
  intakeGroups,
  intakeMessage,
  intakePayload,
  intakeState,
  intakeUrl,
  validateIntake,
} from "./clientIntake";

const NOW = new Date("2026-11-19T12:00:00Z");
const valid = { name: "Ana López", phone: "618 123 4567" };

describe("enlace y vigencia", () => {
  it("el token es de 32 hex y la dirección es /registro/<token>", () => {
    const token = generateIntakeToken();
    expect(token).toMatch(INTAKE_TOKEN_PATTERN);
    expect(generateIntakeToken()).not.toBe(token);
    expect(intakeUrl("https://acl.mx", token)).toBe(`https://acl.mx/registro/${token}`);
  });

  it("vence a los 7 días", () => {
    expect(INTAKE_VALID_DAYS).toBe(7);
    expect(intakeExpiry(NOW)).toBe("2026-11-26T12:00:00.000Z");
  });

  it("estado: pendiente, usado, vencido o desactivado (desactivado gana sobre lo demás)", () => {
    const base = { expires_at: "2026-11-25T00:00:00Z", submitted_at: null, revoked_at: null };
    expect(intakeState(base, NOW)).toBe("pending");
    expect(intakeState({ ...base, submitted_at: "2026-11-19T10:00:00Z" }, NOW)).toBe("used");
    expect(intakeState({ ...base, expires_at: "2026-11-18T00:00:00Z" }, NOW)).toBe("expired");
    expect(intakeState({ ...base, revoked_at: "2026-11-19T10:00:00Z", submitted_at: "2026-11-19T10:00:00Z" }, NOW)).toBe("revoked");
  });

  it("el mensaje de WhatsApp lleva el enlace y saluda por el primer nombre si lo hay", () => {
    expect(intakeMessage("https://acl.mx/registro/x", { name: "Ana López" })).toMatch(/^Hola Ana, soy de ACL Propiedades.*https:\/\/acl\.mx\/registro\/x$/);
    expect(intakeMessage("https://acl.mx/registro/x")).toMatch(/^Hola, soy de ACL Propiedades/);
  });
});

describe("qué se le pide según el tipo", () => {
  it("comprador: personales, crédito, empresa y referencias; sin número de crédito del vendedor", () => {
    expect(intakeGroups("comprador").map((g) => g.key)).toEqual(["personal", "credito", "empresa", "referencias"]);
    expect(intakeFieldKeys("comprador")).toContain("nss");
    expect(intakeFieldKeys("comprador")).not.toContain("numero_credito");
  });

  it("vendedor: personales y datos de la venta, sin nada de comprador", () => {
    expect(intakeGroups("vendedor").map((g) => g.key)).toEqual(["personal", "venta"]);
    expect(intakeFieldKeys("vendedor")).toContain("numero_credito");
    expect(intakeFieldKeys("vendedor")).not.toContain("nss");
  });

  it("ambos: todo", () => {
    expect(intakeGroups("ambos").map((g) => g.key)).toEqual(["personal", "credito", "empresa", "referencias", "venta"]);
  });

  it("nunca se pide la contraseña del portal de crédito ni la identificación del derechohabiente", () => {
    for (const type of ["comprador", "vendedor", "ambos"]) {
      const keys = intakeFieldKeys(type);
      expect(keys).not.toContain("contrasena_portal");
      expect(keys.some((k) => k.startsWith("dh_"))).toBe(false);
    }
  });

  it("el formulario vacío trae nombre, teléfono, correo y los campos del tipo", () => {
    const form = emptyIntakeForm("vendedor");
    expect(Object.keys(form)).toEqual(expect.arrayContaining(["name", "phone", "email", "domicilio", "numero_credito"]));
    expect(form).not.toHaveProperty("nss");
  });
});

describe("validateIntake", () => {
  it("acepta lo mínimo: nombre, teléfono de 10 dígitos y el aviso de privacidad", () => {
    expect(validateIntake(valid, { consent: true, now: NOW })).toBeNull();
  });

  it("pide el nombre (3 letras o más), el teléfono (10 dígitos) y el aviso", () => {
    expect(validateIntake({ ...valid, name: " A " }, { consent: true })).toEqual({ field: "name", code: "name_required" });
    expect(validateIntake({ ...valid, phone: "12345" }, { consent: true })).toEqual({ field: "phone", code: "phone_invalid" });
    expect(validateIntake(valid, { consent: false })).toEqual({ field: "consent", code: "consent_required" });
  });

  it("el correo es opcional pero si viene debe ser válido", () => {
    expect(validateIntake({ ...valid, email: "" }, { consent: true })).toBeNull();
    expect(validateIntake({ ...valid, email: "ana@correo" }, { consent: true })).toEqual({ field: "email", code: "email_invalid" });
    expect(validateIntake({ ...valid, email: "ana@correo.mx" }, { consent: true })).toBeNull();
  });

  it("RFC y CURP se aceptan en minúsculas y se rechazan si no tienen el formato", () => {
    expect(validateIntake({ ...valid, rfc: "lopa900520ab1", curp: "lopa900520mdgpnn01" }, { consent: true })).toBeNull();
    expect(validateIntake({ ...valid, rfc: "XYZ" }, { consent: true })).toEqual({ field: "rfc", code: "rfc_invalid" });
    expect(validateIntake({ ...valid, curp: "XYZ" }, { consent: true })).toEqual({ field: "curp", code: "curp_invalid" });
  });

  it("la fecha de nacimiento no puede ser futura ni anterior a 1900", () => {
    expect(validateIntake({ ...valid, fecha_nacimiento: "1990-05-20" }, { consent: true, now: NOW })).toBeNull();
    expect(validateIntake({ ...valid, fecha_nacimiento: "2999-01-01" }, { consent: true, now: NOW })).toEqual({ field: "fecha_nacimiento", code: "date_invalid" });
    expect(validateIntake({ ...valid, fecha_nacimiento: "1800-01-01" }, { consent: true, now: NOW })).toEqual({ field: "fecha_nacimiento", code: "date_invalid" });
  });
});

describe("intakePayload", () => {
  it("manda solo los campos del tipo, recortados y sin vacíos, con RFC y CURP en mayúsculas", () => {
    const payload = intakePayload(
      { name: "  Beto Ruiz ", phone: "6189999999", email: "", rfc: " ruab800101ab1 ", numero_credito: "C-77", nss: "999", type: "comprador", contrasena_portal: "x", active: false },
      "vendedor",
    );
    expect(payload).toEqual({ name: "Beto Ruiz", phone: "6189999999", rfc: "RUAB800101AB1", numero_credito: "C-77" });
  });
});
