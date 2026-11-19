import { describe, expect, it } from "vitest";
import { MIN_PASSWORD_LENGTH, validateNewPassword } from "./passwordRules";

describe("validateNewPassword", () => {
  it("pide un mínimo de caracteres", () => {
    expect(validateNewPassword("a".repeat(MIN_PASSWORD_LENGTH - 1), "a".repeat(MIN_PASSWORD_LENGTH - 1))).toBe("passwordReset.errors.short");
    expect(validateNewPassword("", "")).toBe("passwordReset.errors.short");
    expect(validateNewPassword(undefined, undefined)).toBe("passwordReset.errors.short");
  });
  it("no acepta espacios al principio o al final (un descuido al pegarla)", () => {
    expect(validateNewPassword(" abcdefgh", " abcdefgh")).toBe("passwordReset.errors.spaces");
  });
  it("las dos deben coincidir", () => {
    expect(validateNewPassword("abcdefgh", "abcdefgx")).toBe("passwordReset.errors.mismatch");
  });
  it("una buena pasa", () => {
    expect(validateNewPassword("Contraseña segura 1", "Contraseña segura 1")).toBeNull();
  });
});
