import { describe, expect, it, vi } from "vitest";
import { buildErrorPayload, createReporter, fingerprintOf, sanitizeUrl, shouldIgnore } from "./errorReporter";

describe("sanitizeUrl", () => {
  it("deja solo la ruta y oculta los enlaces secretos", () => {
    expect(sanitizeUrl("https://aclpropiedades.com/visita/abc123DEF?x=1#y")).toBe("/visita/:token");
    expect(sanitizeUrl("/firmar/SECRETO/otra")).toBe("/firmar/:token/otra");
    expect(sanitizeUrl("/opinion/xyz")).toBe("/opinion/:token");
    expect(sanitizeUrl("https://x.mx/propiedades/casa-ACL-1?utm_source=qr")).toBe("/propiedades/casa-ACL-1");
    expect(sanitizeUrl("/admin/clientes")).toBe("/admin/clientes");
  });
  it("tolera valores raros", () => {
    expect(sanitizeUrl("")).toBe("/");
    expect(sanitizeUrl(null)).toBe("/");
  });
});

describe("shouldIgnore", () => {
  it("ignora ruido del navegador y de extensiones, no errores de la app", () => {
    expect(shouldIgnore("ResizeObserver loop completed with undelivered notifications.")).toBe(true);
    expect(shouldIgnore("Script error.")).toBe(true);
    expect(shouldIgnore("x", "at chrome-extension://abc/content.js:1:1")).toBe(true);
    expect(shouldIgnore("error loading dynamically imported module: /assets/Foo.js")).toBe(true);
    expect(shouldIgnore("Cannot read properties of undefined (reading 'map')")).toBe(false);
  });
});

describe("fingerprintOf", () => {
  const stack = "TypeError: x\n    at render (https://sitio/assets/index-AbC123xyz.js:10:20)";
  it("es estable y no cambia por números, columnas ni identificadores", () => {
    const a = fingerprintOf({ message: "No se encontró la propiedad 123", stack });
    const b = fingerprintOf({ message: "No se encontró la propiedad 456", stack: stack.replace("10:20", "99:77") });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{8}$/);
  });
  it("distingue errores distintos y orígenes distintos", () => {
    const a = fingerprintOf({ message: "uno", stack });
    expect(fingerprintOf({ message: "dos", stack })).not.toBe(a);
    expect(fingerprintOf({ message: "uno", stack, source: "react" })).not.toBe(a);
  });
});

describe("buildErrorPayload", () => {
  it("arma el envío limitado y sin datos de la persona", () => {
    const error = new Error("falló");
    const payload = buildErrorPayload(error, { source: "react", url: "https://x.mx/visita/secreto?nombre=Ana", userAgent: "UA", release: "abc1234" });
    expect(payload).toMatchObject({ message: "falló", source: "react", url: "/visita/:token", user_agent: "UA", release: "abc1234" });
    expect(JSON.stringify(payload)).not.toContain("Ana");
    expect(buildErrorPayload("texto suelto").message).toBe("texto suelto");
    expect(buildErrorPayload(null).message).toBe("Error desconocido");
    expect(buildErrorPayload({ message: "x".repeat(900), stack: "y".repeat(9000) }).message).toHaveLength(500);
  });
});

describe("createReporter", () => {
  const payload = (n) => ({ fingerprint: `f${n}`, message: `m${n}`, stack: "" });
  it("manda cada error una sola vez y no truena si el envío falla", async () => {
    const send = vi.fn().mockRejectedValue(new Error("red"));
    const report = createReporter({ send });
    expect(report(payload(1))).toBe(true);
    expect(report(payload(1))).toBe(false);
    expect(send).toHaveBeenCalledTimes(1);
    await Promise.resolve();
  });
  it("como mucho 5 por minuto y vuelve a permitir después", () => {
    let t = 0;
    const send = vi.fn();
    const report = createReporter({ send, now: () => t, maxPerMinute: 5 });
    for (let i = 1; i <= 5; i += 1) expect(report(payload(i))).toBe(true);
    expect(report(payload(6))).toBe(false);
    t = 61_000;
    expect(report(payload(7))).toBe(true);
  });
  it("ignora el ruido conocido", () => {
    const send = vi.fn();
    const report = createReporter({ send });
    expect(report({ fingerprint: "r", message: "ResizeObserver loop limit exceeded", stack: "" })).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });
});
