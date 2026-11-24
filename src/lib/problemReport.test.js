import { describe, expect, it } from "vitest";
import { PROBLEM_MAX_LENGTH, buildProblemPayload, validateProblem } from "./problemReport";

describe("validateProblem", () => {
  it("pide algo de texto: ni vacío ni de pocas letras", () => {
    expect(validateProblem("")).toBe("empty");
    expect(validateProblem("   ")).toBe("empty");
    expect(validateProblem(undefined)).toBe("empty");
    expect(validateProblem("no carga")).toBe("short");
    expect(validateProblem("   no carga   ")).toBe("short");
    expect(validateProblem("La agenda no carga")).toBeNull();
  });
});

describe("buildProblemPayload", () => {
  it("manda el texto recortado, la pantalla sin parámetros ni tokens, el navegador y la versión", () => {
    const payload = buildProblemPayload({ message: "  No me deja guardar  ", pathname: "/admin/clientes/documentos/TOKENSECRETO?x=1", userAgent: "UA", release: "abc1234" });
    expect(payload).toEqual({ message: "No me deja guardar", url: "/admin/clientes/documentos/:token", userAgent: "UA", release: "abc1234" });
  });
  it("oculta enlaces secretos conocidos y corta lo larguísimo", () => {
    expect(buildProblemPayload({ message: "x".repeat(2000), pathname: "/visita/abc123" }).url).toBe("/visita/:token");
    expect(buildProblemPayload({ message: "x".repeat(2000), pathname: "/" }).message).toHaveLength(PROBLEM_MAX_LENGTH);
  });
  it("sin el correo: la persona no lo escribe ni se manda desde aquí (lo pone la base)", () => {
    expect(Object.keys(buildProblemPayload({ message: "Algo no sale bien", pathname: "/" })).sort()).toEqual(["message", "release", "url", "userAgent"]);
  });
});
