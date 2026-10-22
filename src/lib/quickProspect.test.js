import { describe, expect, it } from "vitest";
import { extractPhone, quickProspectFields, validateQuickProspect } from "./quickProspect";

describe("extractPhone", () => {
  it.each([
    ["Hola, soy Ana, mi cel es 871 123 4567 gracias", "8711234567"],
    ["+52 871 123 4567", "8711234567"],
    ["+52 1 871 123 4567", "8711234567"],
    ["(871) 123-4567", "8711234567"],
    ["52 8711234567", "8711234567"],
  ])("saca el número de %j", (text, expected) => {
    expect(extractPhone(text)).toBe(expected);
  });

  it("devuelve null si no hay un teléfono de 10 dígitos", () => {
    expect(extractPhone("busco casa de 3 recámaras hasta 1500000")).toBeNull();
    expect(extractPhone("")).toBeNull();
    expect(extractPhone(undefined)).toBeNull();
  });
});

describe("validateQuickProspect", () => {
  it("pide nombre y algún teléfono", () => {
    expect(validateQuickProspect({ name: "", phone: "", pasted: "" })).toEqual({ name: "quickCapture.errors.name", phone: "quickCapture.errors.phone" });
  });
  it("acepta el teléfono que viene en el mensaje pegado", () => {
    expect(validateQuickProspect({ name: "Ana", phone: "", pasted: "mi cel 871 123 4567" })).toEqual({});
  });
});

describe("quickProspectFields", () => {
  it("arma un prospecto nuevo del asesor, con el mensaje pegado en las notas", () => {
    const fields = quickProspectFields({ name: " Ana ", phone: "", lookingFor: "casa en Lerdo", pasted: "mi cel 871 123 4567" }, { advisorId: "a1" });
    expect(fields).toMatchObject({ name: "Ana", phone: "8711234567", looking_for: "casa en Lerdo", notes: "mi cel 871 123 4567", advisor_id: "a1", stage: "nuevo", source: "manual", last_contact_at: null });
  });
  it("el teléfono escrito manda sobre el del mensaje y sin asesor queda sin responsable", () => {
    const fields = quickProspectFields({ name: "Ana", phone: "8711111111", lookingFor: "", pasted: "" });
    expect(fields.phone).toBe("8711111111");
    expect(fields.advisor_id).toBeNull();
    expect(fields.looking_for).toBeNull();
  });
});
