import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Cabeceras de seguridad de vercel.json. No se pueden probar contra Vercel desde aquí; esto vigila que la política no se
// afloje por accidente y que siga permitiendo los servicios de terceros que el sitio de verdad usa.
const config = JSON.parse(readFileSync(new URL("../../vercel.json", import.meta.url), "utf8"));
const all = config.headers.find((h) => h.source === "/(.*)");
const header = (key) => all.headers.find((h) => h.key === key)?.value;
const csp = Object.fromEntries(
  header("Content-Security-Policy")
    .split(";")
    .map((d) => d.trim().split(/\s+/))
    .map(([name, ...values]) => [name, values]),
);

describe("vercel.json: cabeceras de seguridad", () => {
  it("manda las cinco cabeceras básicas a todo el sitio", () => {
    expect(header("Strict-Transport-Security")).toMatch(/max-age=\d{7,}/);
    expect(header("X-Content-Type-Options")).toBe("nosniff");
    expect(header("X-Frame-Options")).toBe("DENY");
    expect(header("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(header("Permissions-Policy")).toContain("camera=(self)");
  });

  it("la política no permite scripts en línea ni eval, ni plugins, ni que otro sitio lo enmarque", () => {
    expect(csp["script-src"]).not.toContain("'unsafe-inline'");
    expect(csp["script-src"]).not.toContain("'unsafe-eval'");
    expect(csp["object-src"]).toEqual(["'none'"]);
    expect(csp["frame-ancestors"]).toEqual(["'none'"]);
    expect(csp["base-uri"]).toEqual(["'self'"]);
    expect(csp["default-src"]).toEqual(["'self'"]);
  });

  it("sigue permitiendo lo que el sitio usa: Supabase, Analytics, geocodificación, rutas, mapa embebido y fotos", () => {
    expect(csp["script-src"]).toContain("https://www.googletagmanager.com");
    for (const origin of ["https://*.supabase.co", "wss://*.supabase.co", "https://nominatim.openstreetmap.org", "https://router.project-osrm.org", "https://*.google-analytics.com"]) {
      expect(csp["connect-src"]).toContain(origin);
    }
    expect(csp["frame-src"]).toContain("https://www.google.com");
    expect(csp["img-src"]).toEqual(expect.arrayContaining(["'self'", "data:", "blob:", "https:"]));
    expect(csp["worker-src"]).toContain("'self'");
  });

  it("ya no depende de Google Fonts (las fuentes son propias)", () => {
    expect(JSON.stringify(csp)).not.toContain("fonts.googleapis.com");
    expect(JSON.stringify(csp)).not.toContain("fonts.gstatic.com");
    expect(readFileSync(new URL("../../index.html", import.meta.url), "utf8")).not.toContain("fonts.googleapis.com");
  });

  it("conserva las reglas de /sw.js y del manifiesto", () => {
    expect(config.headers.find((h) => h.source === "/sw.js")?.headers.some((h) => h.key === "Cache-Control")).toBe(true);
    expect(config.headers.some((h) => h.source === "/manifest.webmanifest")).toBe(true);
  });
});
