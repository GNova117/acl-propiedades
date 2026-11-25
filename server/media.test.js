import { describe, expect, it, vi } from "vitest";
import handler from "../api/media.js";

vi.mock("./vercelOg.js", () => ({ default: vi.fn(async (req, res) => res.status(200).send("og")) }));
vi.mock("./vercelAgendaIcs.js", () => ({ default: vi.fn(async (req, res) => res.status(200).send("ics")) }));

const res = () => {
  const r = { status: vi.fn(() => r), send: vi.fn(() => r), setHeader: vi.fn() };
  return r;
};

describe("api/media (una sola función para og e ics)", () => {
  it("reparte por `kind` y lo demás es 404", async () => {
    const a = res();
    await handler({ query: { kind: "og" } }, a);
    expect(a.send).toHaveBeenCalledWith("og");
    const b = res();
    await handler({ query: { kind: "ics" } }, b);
    expect(b.send).toHaveBeenCalledWith("ics");
    for (const query of [{}, { kind: "otro" }, undefined]) {
      const c = res();
      await handler({ query }, c);
      expect(c.status).toHaveBeenCalledWith(404);
    }
  });
});

describe("vercel.json", () => {
  it("reescribe las direcciones públicas a la función única y cuenta menos de 12 funciones", async () => {
    const { readFileSync, readdirSync } = await import("node:fs");
    const config = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
    const rewrites = Object.fromEntries(config.rewrites.map((r) => [r.source, r.destination]));
    expect(rewrites["/api/og"]).toBe("/api/media?kind=og");
    expect(rewrites["/api/agenda-ics"]).toBe("/api/media?kind=ics");
    expect(rewrites["/api/plantilla"]).toBe("/api/media?kind=plantilla");
    // las reescrituras específicas van ANTES de la general (/(.*) → index.html)
    expect(config.rewrites.findIndex((r) => r.source === "/api/og")).toBeLessThan(config.rewrites.findIndex((r) => r.source === "/(.*)"));
    // la función única lleva las fuentes de la imagen para compartir y la hoja membretada (solo para roles con acceso)
    expect(config.functions["api/media.js"].includeFiles).toBe("server/{fonts,assets}/**");
    expect(readdirSync(new URL("../server/assets/", import.meta.url))).toContain("plantilla_acl.pdf");
    const functions = readdirSync(new URL("../api/", import.meta.url)).filter((f) => f.endsWith(".js") && !f.startsWith("_"));
    // +1 por el middleware de vista previa; el plan Hobby permite 12 por despliegue
    expect(functions.length + 1).toBeLessThanOrEqual(12);
  });
});
