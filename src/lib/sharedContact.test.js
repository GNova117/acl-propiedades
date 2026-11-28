// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { currentSharedContact, fillBlanks, resetSharedContact, shareContact } from "./sharedContact";

afterEach(() => {
  resetSharedContact();
  localStorage.clear();
});

describe("fillBlanks", () => {
  it("llena solo los campos vacíos y respeta lo que ya escribió la persona", () => {
    const form = { name: "", phone: "871 111 2222", email: "", empresa: "" };
    const next = fillBlanks(form, { name: "Ana", phone: "999", email: "a@x.mx" });
    expect(next).toEqual({ name: "Ana", phone: "871 111 2222", email: "a@x.mx", empresa: "" });
    expect(form.name).toBe(""); // no modifica el original
  });

  it("solo toca los campos que el formulario tiene", () => {
    const next = fillBlanks({ name: "", phone: "" }, { name: "Ana", phone: "1", email: "a@x.mx" });
    expect(next).toEqual({ name: "Ana", phone: "1" });
    expect("email" in next).toBe(false);
  });

  it("si no hay nada que completar devuelve el mismo objeto", () => {
    const form = { name: "Ana", phone: "1" };
    expect(fillBlanks(form, { name: "Luis" })).toBe(form);
    const vacio = { name: "", phone: "" };
    expect(fillBlanks(vacio, {})).toBe(vacio);
  });
});

describe("shareContact", () => {
  it("comparte lo escrito, avisa a los demás y no lo guarda en el navegador", () => {
    const aviso = vi.fn();
    window.addEventListener("acl:shared-contact", aviso);
    shareContact({ name: " Ana ", phone: "", email: "a@x.mx" });
    expect(aviso).toHaveBeenCalledTimes(1);
    expect(currentSharedContact()).toEqual({ name: "Ana", email: "a@x.mx" });
    expect(localStorage.getItem("acl_remembered_contact")).toBeNull();
    window.removeEventListener("acl:shared-contact", aviso);
  });

  it("no avisa si no cambió nada", () => {
    shareContact({ name: "Ana" });
    const aviso = vi.fn();
    window.addEventListener("acl:shared-contact", aviso);
    shareContact({ name: "Ana" });
    shareContact({ name: "" });
    expect(aviso).not.toHaveBeenCalled();
    window.removeEventListener("acl:shared-contact", aviso);
  });

  it("lo recordado de un envío anterior sigue valiendo y lo de esta página tiene prioridad", () => {
    localStorage.setItem("acl_remembered_contact", JSON.stringify({ name: "Antes", phone: "123" }));
    shareContact({ name: "Ahora" });
    expect(currentSharedContact()).toEqual({ name: "Ahora", phone: "123" });
  });
});
