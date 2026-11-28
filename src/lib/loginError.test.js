import { describe, expect, it } from "vitest";
import { isLoginNetworkError } from "./loginError";

describe("isLoginNetworkError", () => {
  it("una contraseña incorrecta no es un error de red", () => {
    expect(isLoginNetworkError(Object.assign(new Error("Invalid login credentials"), { status: 400, name: "AuthApiError" }), true)).toBe(false);
    expect(isLoginNetworkError(new Error("Credenciales inválidas"), true)).toBe(false);
  });
  it("sin conexión, fetch caído o servidor caído sí", () => {
    expect(isLoginNetworkError(new Error("x"), false)).toBe(true);
    expect(isLoginNetworkError(new TypeError("Failed to fetch"), true)).toBe(true);
    expect(isLoginNetworkError(Object.assign(new Error("x"), { name: "AuthRetryableFetchError", status: 0 }), true)).toBe(true);
    expect(isLoginNetworkError(Object.assign(new Error("x"), { status: 503 }), true)).toBe(true);
  });
});
