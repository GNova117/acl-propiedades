import { describe, expect, it } from "vitest";
import { errorId, fieldErrorProps, focusFirstError } from "./formErrors";

describe("formErrors", () => {
  it("el mensaje de cada campo tiene un id predecible", () => {
    expect(errorId("contact-name")).toBe("contact-name-error");
  });
  it("con error marca el campo y lo liga a su mensaje; sin error no agrega nada", () => {
    expect(fieldErrorProps("contact-name", "Obligatorio")).toEqual({ "aria-invalid": true, "aria-describedby": "contact-name-error" });
    expect(fieldErrorProps("contact-name", "")).toEqual({});
    expect(fieldErrorProps("contact-name", undefined)).toEqual({});
  });
  it("enfoca el primer campo con error según el orden pedido", () => {
    const focused = [];
    const doc = { getElementById: (id) => ({ focus: () => focused.push(id) }) };
    const ids = { name: "n", email: "e", message: "m" };
    expect(focusFirstError({ message: "x", email: "y" }, ["name", "email", "message"], ids, doc)).toBe(true);
    expect(focused).toEqual(["e"]);
  });
  it("sin errores o sin el elemento no hace nada", () => {
    const doc = { getElementById: () => null };
    expect(focusFirstError({}, ["name"], { name: "n" }, doc)).toBe(false);
    expect(focusFirstError({ name: "x" }, ["name"], { name: "n" }, doc)).toBe(false);
    expect(focusFirstError({ name: "x" }, ["name"], { name: "n" }, null)).toBe(false);
  });
});
