import { describe, expect, it } from "vitest";
import { adminRecipients, buildErrorDigest, MAX_ERRORS_IN_EMAIL } from "./digest.js";

const error = (n, extra = {}) => ({ id: `e${n}`, message: `Falla ${n}`, url: "/propiedades", count: n, release: "abc1234", ...extra });

describe("buildErrorDigest", () => {
  it("sin errores no hay correo", () => {
    expect(buildErrorDigest([], { siteUrl: "https://x.mx" })).toBeNull();
    expect(buildErrorDigest(null, { siteUrl: "https://x.mx" })).toBeNull();
  });

  it("un error: asunto singular, su ruta y el enlace al panel", () => {
    const { subject, html, text } = buildErrorDigest([error(1)], { siteUrl: "https://x.mx" });
    expect(subject).toBe("Error nuevo en el sitio de ACL Propiedades");
    expect(html).toContain("Falla 1");
    expect(html).toContain("https://x.mx/admin/errores");
    expect(html).toContain("border-bottom:3px solid #1565c0"); // la plantilla de marca
    expect(text).toContain("https://x.mx/admin/errores");
  });

  it("varios: cuenta en el asunto y recorta el correo", () => {
    const many = Array.from({ length: MAX_ERRORS_IN_EMAIL + 5 }, (_, i) => error(i + 1));
    const { subject, html } = buildErrorDigest(many, { siteUrl: "https://x.mx" });
    expect(subject).toBe(`${many.length} errores nuevos en el sitio de ACL Propiedades`);
    expect(html).toContain("…y 5 más en el panel.");
    expect(html).not.toContain(`Falla ${MAX_ERRORS_IN_EMAIL + 1}<`);
  });

  it("los reportes del equipo llevan quién los mandó y su propio asunto", () => {
    const report = (n, who) => error(n, { source: "usuario", reported_by: who, message: `No carga la agenda ${n}`, count: 1 });
    const only = buildErrorDigest([report(1, "ana@correo.mx")], { siteUrl: "https://x.mx" });
    expect(only.subject).toBe("Una persona del equipo reportó un problema en ACL Propiedades");
    expect(only.html).toContain("Reporte de ana@correo.mx");
    expect(only.html).not.toContain("vez/veces");
    expect(only.text).toContain("Reporte de ana@correo.mx: No carga la agenda 1");
    expect(buildErrorDigest([report(1, "a@x.mx"), report(2, "b@x.mx")], { siteUrl: "https://x.mx" }).subject).toBe("2 reportes de problemas del equipo en ACL Propiedades");
    const mixed = buildErrorDigest([error(1), report(2, "ana@correo.mx")], { siteUrl: "https://x.mx" });
    expect(mixed.subject).toBe("2 avisos nuevos en ACL Propiedades (1 errores y 1 reportes del equipo)");
  });

  it("escapa también el correo y el texto de un reporte", () => {
    const { html } = buildErrorDigest([error(1, { source: "usuario", reported_by: '<b>x</b>@a.mx', message: "<script>alert(1)</script>" })], { siteUrl: "https://x.mx" });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>x</b>");
  });

  it("escapa lo que viene del navegador (mensaje y ruta)", () => {
    const { html } = buildErrorDigest([error(1, { message: '<img src=x onerror="alert(1)">', url: "/<script>" })], { siteUrl: "https://x.mx" });
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;img");
  });
});

describe("adminRecipients", () => {
  const rows = [
    { email: "Admin@X.mx", admin_roles: { sections: ["roles", "clientes"] } },
    { email: "asesor@x.mx", admin_roles: { sections: ["prospectos"] } },
    { email: "otro@x.mx", admin_roles: [{ sections: ["roles"] }] },
    { email: "admin@x.mx", admin_roles: { sections: ["roles"] } },
    { email: "mal", admin_roles: { sections: ["roles"] } },
  ];
  it("solo quien tiene el apartado «roles», sin repetir y en minúsculas", () => {
    expect(adminRecipients(rows)).toEqual(["admin@x.mx", "otro@x.mx"]);
  });
  it("la lista fija manda sobre los roles", () => {
    expect(adminRecipients(rows, "a@x.mx, B@x.mx ,no")).toEqual(["a@x.mx", "b@x.mx"]);
  });
  it("tolera datos vacíos", () => {
    expect(adminRecipients(null)).toEqual([]);
  });
});
