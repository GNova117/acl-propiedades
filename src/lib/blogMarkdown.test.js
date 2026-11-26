import { describe, expect, it } from "vitest";
import { parseBlogBody, parseInline } from "./blogMarkdown";

describe("parseBlogBody", () => {
  it("un artículo de solo párrafos queda igual", () => {
    const blocks = parseBlogBody("Primero.\n\nSegundo.");
    expect(blocks.map((b) => b.type)).toEqual(["paragraph", "paragraph"]);
    expect(blocks[1].inline).toEqual([{ type: "text", text: "Segundo." }]);
  });

  it("subtítulos, listas, listas numeradas e imágenes", () => {
    const blocks = parseBlogBody("## Requisitos\n\n- INE\n- CURP\n\n1. Reúne papeles\n2. Agenda\n\n![Fachada](https://x.mx/a.jpg)\n\n### Detalle");
    expect(blocks.map((b) => b.type)).toEqual(["heading", "list", "list", "image", "heading"]);
    expect(blocks[0]).toMatchObject({ level: 2 });
    expect(blocks[1]).toMatchObject({ ordered: false });
    expect(blocks[1].items).toHaveLength(2);
    expect(blocks[2]).toMatchObject({ ordered: true });
    expect(blocks[3]).toMatchObject({ alt: "Fachada", src: "https://x.mx/a.jpg" });
    expect(blocks[4]).toMatchObject({ level: 3 });
  });

  it("no admite imágenes que no sean https", () => {
    const blocks = parseBlogBody("![x](http://x.mx/a.jpg)");
    expect(blocks[0].type).toBe("paragraph");
  });

  it("vacío no da bloques", () => {
    expect(parseBlogBody("")).toEqual([]);
    expect(parseBlogBody(null)).toEqual([]);
  });
});

describe("parseInline", () => {
  it("enlaces internos y externos, y negritas", () => {
    expect(parseInline("Mira [la guía](/guia-del-comprador) y [INFONAVIT](https://infonavit.org.mx) **ahora**")).toEqual([
      { type: "text", text: "Mira " },
      { type: "link", text: "la guía", href: "/guia-del-comprador", external: false },
      { type: "text", text: " y " },
      { type: "link", text: "INFONAVIT", href: "https://infonavit.org.mx", external: true },
      { type: "text", text: " " },
      { type: "bold", text: "ahora" },
    ]);
  });

  it("un enlace peligroso queda como texto", () => {
    expect(parseInline("[clic](javascript:alert(1))").some((part) => part.type === "link")).toBe(false);
    expect(parseInline("[clic](javascript:alert)")).toEqual([{ type: "text", text: "clic" }]);
    expect(parseInline("[x](//evil.com)")).toEqual([{ type: "text", text: "x" }]);
  });
});
