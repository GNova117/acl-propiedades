import { describe, expect, it } from "vitest";
import { redactAnalyticsPath } from "./analytics";

describe("redactAnalyticsPath", () => {
  it("quita el token del enlace de baja de alertas", () => {
    expect(redactAnalyticsPath("/alertas/baja/0123456789abcdef0123456789abcdef")).toBe("/alertas/baja/:token");
    expect(redactAnalyticsPath("/alertas/baja/abc/")).toBe("/alertas/baja/:token/");
  });

  it("deja igual cualquier otra ruta", () => {
    expect(redactAnalyticsPath("/propiedades/abc-123")).toBe("/propiedades/abc-123");
    expect(redactAnalyticsPath("/")).toBe("/");
    expect(redactAnalyticsPath("/alertas")).toBe("/alertas");
  });
});
