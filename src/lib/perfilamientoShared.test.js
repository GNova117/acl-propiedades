import { describe, expect, it } from "vitest";
import { allFields, displayValue, emptyForm, formatFecha, isFieldVisible, toFormValues, toPayload, validateSections } from "./perfilamientoShared";

describe("formatFecha", () => {
  it("convierte aaaa-mm-dd a dd/mm/aaaa", () => {
    expect(formatFecha("2026-03-05")).toBe("05/03/2026");
  });

  it("devuelve cadena vacía sin valor", () => {
    expect(formatFecha("")).toBe("");
    expect(formatFecha(null)).toBe("");
  });
});

describe("isFieldVisible", () => {
  const field = { key: "detalle_gravamen", dependsOn: { field: "tiene_gravamen", value: "si" } };

  it("un campo sin dependsOn siempre es visible", () => {
    expect(isFieldVisible({ key: "nombre" }, {})).toBe(true);
  });

  it("un campo con dependsOn solo es visible si el campo del que depende tiene el valor esperado", () => {
    expect(isFieldVisible(field, { tiene_gravamen: "si" })).toBe(true);
    expect(isFieldVisible(field, { tiene_gravamen: "no" })).toBe(false);
  });
});

describe("allFields / emptyForm", () => {
  const sections = [
    { fields: [{ key: "a" }, { key: "b" }] },
    { fields: [{ key: "c" }] },
  ];

  it("allFields junta los campos de todas las secciones", () => {
    expect(allFields(sections).map((f) => f.key)).toEqual(["a", "b", "c"]);
  });

  it("emptyForm da un formulario con todas las llaves en blanco", () => {
    expect(emptyForm(sections)).toEqual({ a: "", b: "", c: "" });
  });
});

describe("displayValue", () => {
  it("formatea una fecha para mostrarla", () => {
    expect(displayValue({ key: "nacimiento", type: "date" }, { nacimiento: "2026-03-05" })).toBe("05/03/2026");
  });

  it("agrega la unidad cuando el campo la tiene", () => {
    expect(displayValue({ key: "superficie", unit: "m²" }, { superficie: "120" })).toBe("120 m²");
  });

  it("devuelve cadena vacía si el valor está vacío o no existe", () => {
    expect(displayValue({ key: "x" }, { x: "" })).toBe("");
    expect(displayValue({ key: "x" }, {})).toBe("");
  });
});

describe("validateSections", () => {
  const sections = [
    {
      fields: [
        { key: "nombre", required: true },
        { key: "correo", format: "email" },
        { key: "telefono", format: "telefono" },
        { key: "rfc", format: "rfc" },
        { key: "curp", format: "curp" },
        { key: "nss", format: "nss" },
        { key: "edad", type: "number" },
        { key: "detalle_gravamen", dependsOn: { field: "tiene_gravamen", value: "si" }, required: true },
      ],
    },
  ];

  it("marca requeridos vacíos, pero ignora un campo oculto por dependsOn aunque sea requerido", () => {
    const errors = validateSections(sections, { tiene_gravamen: "no" });
    expect(errors.nombre).toBeTruthy();
    expect(errors.detalle_gravamen).toBeUndefined();
  });

  it("valida los formatos conocidos (email, teléfono, RFC, CURP, NSS)", () => {
    const form = { nombre: "Ana", correo: "no-es-correo", telefono: "123", rfc: "XXX", curp: "XXX", nss: "123" };
    const errors = validateSections(sections, form);
    expect(errors.correo).toBeTruthy();
    expect(errors.telefono).toBeTruthy();
    expect(errors.rfc).toBeTruthy();
    expect(errors.curp).toBeTruthy();
    expect(errors.nss).toBeTruthy();
  });

  it("acepta un RFC/CURP válido sin importar mayúsculas", () => {
    const form = { nombre: "Ana", rfc: "xaxx010101000", curp: "xaxx010101hdfrrl01" };
    const errors = validateSections(sections, form);
    expect(errors.rfc).toBeUndefined();
    expect(errors.curp).toBeUndefined();
  });

  it("un número negativo o no numérico es inválido", () => {
    expect(validateSections(sections, { nombre: "Ana", edad: "-1" }).edad).toBeTruthy();
    expect(validateSections(sections, { nombre: "Ana", edad: "abc" }).edad).toBeTruthy();
    expect(validateSections(sections, { nombre: "Ana", edad: "30" }).edad).toBeUndefined();
  });

  it("extraRules puede agregar reglas cruzadas entre campos", () => {
    const extraRules = (form) => (form.tiene_gravamen === "si" && !form.detalle_gravamen ? { detalle_gravamen: "requerido" } : {});
    const errors = validateSections(sections, { nombre: "Ana", tiene_gravamen: "si" }, extraRules);
    expect(errors.detalle_gravamen).toBe("requerido");
  });
});

describe("toPayload", () => {
  const sections = [
    {
      fields: [
        { key: "nombre", uppercase: true },
        { key: "edad", type: "number" },
        { key: "cuartos", type: "integer" },
        { key: "detalle_gravamen", dependsOn: { field: "tiene_gravamen", value: "si" } },
      ],
    },
  ];

  it("recorta espacios y pasa a mayúsculas los campos marcados", () => {
    expect(toPayload(sections, { nombre: "  ana garcía  " }).nombre).toBe("ANA GARCÍA");
  });

  it("convierte number/integer y manda null lo vacío", () => {
    const payload = toPayload(sections, { nombre: "", edad: "30.5", cuartos: "3" });
    expect(payload.nombre).toBeNull();
    expect(payload.edad).toBe(30.5);
    expect(payload.cuartos).toBe(3);
  });

  it("vacía un campo oculto por dependsOn aunque el formulario traiga algo escrito", () => {
    const payload = toPayload(sections, { nombre: "Ana", tiene_gravamen: "no", detalle_gravamen: "hipoteca vieja" });
    expect(payload.detalle_gravamen).toBeNull();
  });
});

describe("toFormValues", () => {
  it("convierte null a cadena vacía para que el input sea controlado", () => {
    expect(toFormValues({ nombre: null })).toEqual({ nombre: "" });
  });

  it("recorta una fecha con hora a solo aaaa-mm-dd", () => {
    expect(toFormValues({ nacimiento: "2026-03-05T00:00:00.000Z" })).toEqual({ nacimiento: "2026-03-05" });
  });

  it("deja un texto normal tal cual", () => {
    expect(toFormValues({ nombre: "Ana", edad: 30 })).toEqual({ nombre: "Ana", edad: "30" });
  });
});
