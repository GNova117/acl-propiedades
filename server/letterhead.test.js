import { describe, expect, it, vi } from "vitest";
import { handleLetterheadRequest } from "./letterhead.js";

const PDF = Buffer.from("%PDF-1.7 prueba");

function deps(overrides = {}) {
  return {
    getUser: vi.fn(async () => ({ email: "asesor@aclpropiedades.com" })),
    hasSection: vi.fn(async (section) => section === "membrete"),
    readTemplate: vi.fn(async () => PDF),
    ...overrides,
  };
}

describe("handleLetterheadRequest", () => {
  it("entrega el PDF a un usuario cuyo rol tiene el apartado membrete, y no lo deja en caché compartida", async () => {
    const d = deps();
    const result = await handleLetterheadRequest({ authorization: "Bearer jwt" }, d);
    expect(result.status).toBe(200);
    expect(result.body).toBe(PDF);
    expect(result.headers["Content-Type"]).toBe("application/pdf");
    expect(result.headers["Content-Length"]).toBe(String(PDF.length));
    expect(result.headers["Cache-Control"]).toMatch(/^private/);
    expect(d.getUser).toHaveBeenCalledWith("jwt");
    expect(d.hasSection).toHaveBeenCalledWith("membrete");
  });

  it("rechaza sin token y no lee el archivo", async () => {
    const d = deps();
    expect((await handleLetterheadRequest({ authorization: "" }, d)).status).toBe(401);
    expect((await handleLetterheadRequest({}, d)).status).toBe(401);
    expect(d.readTemplate).not.toHaveBeenCalled();
  });

  it("rechaza la llave anon: es un JWT válido pero no pertenece a ningún usuario", async () => {
    const d = deps({ getUser: vi.fn(async () => null) });
    const result = await handleLetterheadRequest({ authorization: "Bearer anon-key" }, d);
    expect(result.status).toBe(401);
    expect(d.readTemplate).not.toHaveBeenCalled();
  });

  it("rechaza a un usuario con sesión cuyo rol no tiene el apartado", async () => {
    const d = deps({ hasSection: vi.fn(async () => false) });
    const result = await handleLetterheadRequest({ authorization: "Bearer jwt" }, d);
    expect(result).toEqual({ status: 403, json: { error: "forbidden" } });
    expect(d.readTemplate).not.toHaveBeenCalled();
  });
});
