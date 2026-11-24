import { describe, expect, it } from "vitest";
import { descriptionBlocks } from "./descriptionBlocks";

describe("descriptionBlocks", () => {
  it("una descripción de una sola línea es un solo párrafo (como siempre)", () => {
    expect(descriptionBlocks("Casa amplia con jardín.")).toEqual([{ type: "p", lines: ["Casa amplia con jardín."] }]);
  });

  it("una línea en blanco separa párrafos y un salto suelto se respeta dentro del párrafo", () => {
    expect(descriptionBlocks("Primero.\nSigue aquí.\n\nSegundo párrafo.")).toEqual([
      { type: "p", lines: ["Primero.", "Sigue aquí."] },
      { type: "p", lines: ["Segundo párrafo."] },
    ]);
  });

  it("las líneas con viñeta forman una lista y las numeradas otra", () => {
    const blocks = descriptionBlocks("Incluye:\n- Cocina integral\n• Cochera techada\n* Jardín\n\nPasos:\n1. Visitar\n2) Apartar");
    expect(blocks).toEqual([
      { type: "p", lines: ["Incluye:"] },
      { type: "ul", items: ["Cocina integral", "Cochera techada", "Jardín"] },
      { type: "p", lines: ["Pasos:"] },
      { type: "ol", items: ["Visitar", "Apartar"] },
    ]);
  });

  it("cambiar de tipo de lista corta la lista, y un párrafo después de una lista abre otro bloque", () => {
    expect(descriptionBlocks("- a\n1. b\ntexto")).toEqual([
      { type: "ul", items: ["a"] },
      { type: "ol", items: ["b"] },
      { type: "p", lines: ["texto"] },
    ]);
  });

  it("un guion sin espacio no es viñeta (p. ej. «-5 °C» o una palabra con guion)", () => {
    expect(descriptionBlocks("-5 grados\nco-propiedad")).toEqual([{ type: "p", lines: ["-5 grados", "co-propiedad"] }]);
  });

  it("vacío, espacios y saltos de Windows", () => {
    expect(descriptionBlocks("")).toEqual([]);
    expect(descriptionBlocks(null)).toEqual([]);
    expect(descriptionBlocks("  \n\n  ")).toEqual([]);
    expect(descriptionBlocks("uno\r\n\r\n- a\r\n- b")).toEqual([{ type: "p", lines: ["uno"] }, { type: "ul", items: ["a", "b"] }]);
  });

  it("lo escrito sale como texto, no como HTML, y hay tope de bloques", () => {
    expect(descriptionBlocks("<script>alert(1)</script>")).toEqual([{ type: "p", lines: ["<script>alert(1)</script>"] }]);
    const many = Array.from({ length: 200 }, (_, i) => `p${i}`).join("\n\n");
    expect(descriptionBlocks(many)).toHaveLength(60);
  });
});
