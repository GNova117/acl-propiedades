import { describe, expect, it, vi } from "vitest";
import { handleInvite } from "./handler";

const deps = (over = {}) => ({
  authorize: vi.fn(async () => true),
  hasAccess: vi.fn(async () => true),
  invite: vi.fn(async () => ({})),
  siteUrl: "https://sitio.test/",
  ...over,
});

describe("handleInvite", () => {
  it("invita a un correo con acceso y manda a elegir contraseña en /admin/restablecer", async () => {
    const d = deps();
    const out = await handleInvite({ email: "  Nueva@Correo.com " }, d);
    expect(out).toEqual({ status: 200, body: { ok: true, alreadyHasAccount: false } });
    expect(d.hasAccess).toHaveBeenCalledWith("nueva@correo.com");
    expect(d.invite).toHaveBeenCalledWith("nueva@correo.com", "https://sitio.test/admin/restablecer");
  });

  it("sin el apartado Roles no hace nada (ni mira el correo)", async () => {
    const d = deps({ authorize: vi.fn(async () => false) });
    expect((await handleInvite({ email: "a@b.com" }, d)).status).toBe(403);
    expect(d.hasAccess).not.toHaveBeenCalled();
    expect(d.invite).not.toHaveBeenCalled();
  });

  it("rechaza un correo inválido y uno que no tiene acceso dado en Roles", async () => {
    const d = deps();
    for (const email of [undefined, "", "sin-arroba", "a@b", `${"x".repeat(250)}@b.com`]) expect((await handleInvite({ email }, d)).status).toBe(400);
    expect(d.invite).not.toHaveBeenCalled();
    const sinAcceso = deps({ hasAccess: vi.fn(async () => false) });
    expect((await handleInvite({ email: "a@b.com" }, sinAcceso)).status).toBe(404);
    expect(sinAcceso.invite).not.toHaveBeenCalled();
  });

  it("si ya tiene cuenta no es un fallo", async () => {
    for (const error of [{ code: "email_exists", message: "x" }, { status: 422, message: "x" }, { message: "User already registered" }]) {
      const out = await handleInvite({ email: "a@b.com" }, deps({ invite: vi.fn(async () => ({ error })) }));
      expect(out).toEqual({ status: 200, body: { ok: true, alreadyHasAccount: true } });
    }
  });

  it("otro fallo del servicio es 502 y no filtra el detalle", async () => {
    const out = await handleInvite({ email: "a@b.com" }, deps({ invite: vi.fn(async () => ({ error: { message: "secreto interno", status: 500 } })) }));
    expect(out).toEqual({ status: 502, body: { error: "invite_failed" } });
  });
});
