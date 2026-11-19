import { readFileSync } from "node:fs";
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

describe("los reportes del equipo no van por correo", () => {
  // index.ts corre en Deno y no se puede importar aquí: se vigila el texto de la consulta.
  const index = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
  it("la consulta excluye el origen «usuario» (botón «Reportar un problema»)", () => {
    expect(index).toContain('.neq("source", "usuario")');
  });
});
