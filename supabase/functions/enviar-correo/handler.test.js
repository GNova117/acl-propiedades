import { describe, expect, it, vi } from "vitest";
import { bearerToken, handleStaffEmail, LIMITS, validateEmailPayload } from "./handler";

const payload = { to: "dueno@correo.com", subject: "Informe de visitas", html: "<p>Hola</p>" };

function deps(overrides = {}) {
  return {
    getUser: vi.fn(async () => ({ email: "asesor@aclpropiedades.com" })),
    hasSection: vi.fn(async (section) => section === "visitas"),
    countRecent: vi.fn(async () => 0),
    logSend: vi.fn(async () => {}),
    sendEmail: vi.fn(async () => ({ id: "re_1" })),
    ...overrides,
  };
}

describe("handleStaffEmail", () => {
  it("manda el correo de un usuario del staff con el apartado visitas y lo registra", async () => {
    const d = deps();
    const result = await handleStaffEmail({ authorization: "Bearer jwt", payload }, d);
    expect(result).toEqual({ status: 200, body: { ok: true, id: "re_1" } });
    expect(d.getUser).toHaveBeenCalledWith("jwt");
    expect(d.sendEmail).toHaveBeenCalledWith({ to: "dueno@correo.com", subject: "Informe de visitas", html: "<p>Hola</p>", attachments: [] });
    expect(d.logSend).toHaveBeenCalledWith("asesor@aclpropiedades.com", "dueno@correo.com");
  });

  it("acepta el apartado gastos aunque no tenga visitas", async () => {
    const d = deps({ hasSection: vi.fn(async (s) => s === "gastos") });
    expect((await handleStaffEmail({ authorization: "Bearer jwt", payload }, d)).status).toBe(200);
  });

  it("rechaza sin token", async () => {
    const d = deps();
    expect((await handleStaffEmail({ authorization: null, payload }, d)).status).toBe(401);
    expect(d.sendEmail).not.toHaveBeenCalled();
  });

  it("rechaza la llave anon: es un JWT válido para el gateway pero no pertenece a ningún usuario", async () => {
    const d = deps({ getUser: vi.fn(async () => null) });
    const result = await handleStaffEmail({ authorization: "Bearer anon-key", payload }, d);
    expect(result.status).toBe(401);
    expect(d.sendEmail).not.toHaveBeenCalled();
  });

  it("rechaza a un usuario sin apartado visitas ni gastos", async () => {
    const d = deps({ hasSection: vi.fn(async () => false) });
    const result = await handleStaffEmail({ authorization: "Bearer jwt", payload }, d);
    expect(result).toEqual({ status: 403, body: { error: "forbidden" } });
    expect(d.sendEmail).not.toHaveBeenCalled();
  });

  it("limita los envíos por hora por usuario", async () => {
    const d = deps({ countRecent: vi.fn(async () => LIMITS.perUserPerHour) });
    const result = await handleStaffEmail({ authorization: "Bearer jwt", payload }, d);
    expect(result.status).toBe(429);
    expect(d.sendEmail).not.toHaveBeenCalled();
  });

  it("responde 400 con un destinatario inválido y no manda nada", async () => {
    const d = deps();
    const result = await handleStaffEmail({ authorization: "Bearer jwt", payload: { ...payload, to: "a@b.com, c@d.com" } }, d);
    expect(result.status).toBe(400);
    expect(d.sendEmail).not.toHaveBeenCalled();
  });

  it("no registra el envío si Resend falla (la excepción llega al servidor)", async () => {
    const d = deps({ sendEmail: vi.fn(async () => { throw new Error("Resend: boom"); }) });
    await expect(handleStaffEmail({ authorization: "Bearer jwt", payload }, d)).rejects.toThrow("boom");
    expect(d.logSend).not.toHaveBeenCalled();
  });
});

describe("validateEmailPayload", () => {
  it("exige to, subject y html", () => {
    expect(validateEmailPayload({ to: "a@b.com", subject: "x" }).error).toMatch(/Faltan/);
    expect(validateEmailPayload(null).error).toBeTruthy();
  });

  it("rechaza varios destinatarios, saltos de línea en el asunto y contenido enorme", () => {
    expect(validateEmailPayload({ ...payload, to: "a@b.com;c@d.com" }).error).toMatch(/Destinatario/);
    expect(validateEmailPayload({ ...payload, to: "Nombre <a@b.com>" }).error).toMatch(/Destinatario/);
    expect(validateEmailPayload({ ...payload, subject: "Hola\r\nBcc: x@y.com" }).error).toMatch(/Asunto/);
    expect(validateEmailPayload({ ...payload, html: "x".repeat(LIMITS.maxHtmlLength + 1) }).error).toMatch(/grande/);
  });

  it("solo permite adjuntar un PDF en base64 de tamaño razonable", () => {
    const ok = validateEmailPayload({ ...payload, attachment: { filename: "Informe visitas.pdf", contentBase64: "JVBERi0xLjQ=" } });
    expect(ok.value.attachments).toEqual([{ filename: "Informe visitas.pdf", content: "JVBERi0xLjQ=" }]);
    expect(validateEmailPayload({ ...payload, attachment: { filename: "virus.exe", contentBase64: "AAAA" } }).error).toMatch(/PDF/);
    expect(validateEmailPayload({ ...payload, attachment: { filename: "../../x.pdf", contentBase64: "AAAA" } }).error).toMatch(/PDF/);
    expect(validateEmailPayload({ ...payload, attachment: { filename: "a.pdf", contentBase64: "no es base64!" } }).error).toMatch(/Adjunto/);
    expect(validateEmailPayload({ ...payload, attachment: { filename: "a.pdf", contentBase64: "A".repeat(LIMITS.maxAttachmentBase64Length + 1) } }).error).toMatch(/Adjunto/);
  });
});

describe("bearerToken", () => {
  it("extrae el token del encabezado Authorization", () => {
    expect(bearerToken("Bearer abc.def")).toBe("abc.def");
    expect(bearerToken("bearer   xyz ")).toBe("xyz");
    expect(bearerToken("Basic abc")).toBeNull();
    expect(bearerToken(undefined)).toBeNull();
  });
});
