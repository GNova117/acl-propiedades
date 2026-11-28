import { describe, expect, it } from "vitest";
import { forgetContact, loadContact, saveContact, withRemembered } from "./rememberedContact";

const memory = () => {
  const data = new Map();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)), removeItem: (k) => data.delete(k) };
};

describe("rememberedContact", () => {
  it("guarda y recupera nombre, correo y teléfono", () => {
    const s = memory();
    saveContact({ name: " Ana ", phone: "8711234567", email: "a@b.com", message: "no se guarda" }, s);
    expect(loadContact(s)).toEqual({ name: "Ana", email: "a@b.com", phone: "8711234567" });
  });
  it("un campo vacío no borra lo ya recordado", () => {
    const s = memory();
    saveContact({ name: "Ana", phone: "1" }, s);
    saveContact({ name: "", phone: "2" }, s);
    expect(loadContact(s)).toEqual({ name: "Ana", phone: "2" });
  });
  it("olvidar lo borra", () => {
    const s = memory();
    saveContact({ name: "Ana" }, s);
    forgetContact(s);
    expect(loadContact(s)).toEqual({});
  });
  it("datos corruptos o sin almacenamiento no truenan", () => {
    expect(loadContact({ getItem: () => "no es json" })).toEqual({});
    expect(loadContact(null)).toEqual({});
    expect(() => saveContact({ name: "x" }, null)).not.toThrow();
  });
  it("withRemembered llena solo los campos que el formulario tiene", () => {
    expect(withRemembered({ name: "", phone: "", note: "" }, { name: "Ana", email: "a@b.com", phone: "1" })).toEqual({ name: "Ana", phone: "1", note: "" });
  });
});
