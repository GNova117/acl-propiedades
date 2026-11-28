import { describe, expect, it } from "vitest";
import { keySlug, slugWith, urlSlug } from "./slug";

describe("slugs", () => {
  it("quita acentos, pasa a minúsculas y separa con el separador pedido", () => {
    expect(urlSlug("Gómez Palacio")).toBe("gomez-palacio");
    expect(keySlug("Nave Industrial")).toBe("nave_industrial");
    expect(slugWith("-", "  Torre   Aurora!! ")).toBe("torre-aurora");
  });
  it("sin bordes sobrantes y con la ñ y la ü bien", () => {
    expect(urlSlug("--Colonia Peñón--")).toBe("colonia-penon");
    expect(keySlug("¡Pingüino!")).toBe("pinguino");
  });
  it("vacío o nulo → cadena vacía", () => {
    expect(urlSlug(null)).toBe("");
    expect(keySlug(undefined)).toBe("");
    expect(urlSlug("***")).toBe("");
  });
});
