import { describe, expect, it } from "vitest";
import {
  accentVariants,
  boundsFromParam,
  boundsToParam,
  matchesBounds,
  matchesSearch,
  searchTokens,
  stripAccents,
  supabaseSearchFilters,
} from "./propertySearch";

describe("searchTokens", () => {
  it("separa por espacios, ignora palabras de una letra y limita a 4", () => {
    expect(searchTokens("  casa  con a alberca   senderos torreón extra ")).toEqual(["casa", "con", "alberca", "senderos"]);
  });
  it("quita lo que rompería un filtro de PostgREST o actuaría de comodín", () => {
    expect(searchTokens('casa,(%*_:") "x" jardín')).toEqual(["casa", "jardín"]);
  });
  it("devuelve vacío sin texto", () => {
    expect(searchTokens("")).toEqual([]);
    expect(searchTokens(null)).toEqual([]);
  });
});

describe("accentVariants", () => {
  it("incluye la palabra, sin acentos y con una vocal acentuada cada vez", () => {
    const variants = accentVariants("torreon");
    expect(variants).toContain("torreon");
    expect(variants).toContain("torreón");
    expect(variants).toContain("torréon");
  });
  it("encuentra la forma sin acento a partir de la acentuada", () => {
    expect(accentVariants("Torreón")).toContain("torreon");
  });
  it("no pasa de 10 variantes", () => {
    expect(accentVariants("administrativamente").length).toBeLessThanOrEqual(10);
  });
  it("cubre la ñ", () => {
    expect(accentVariants("cabana")).toContain("cabaña");
  });
});

describe("supabaseSearchFilters", () => {
  it("arma un filtro or por palabra con todas las columnas y variantes", () => {
    const filters = supabaseSearchFilters("casa jardin");
    expect(filters).toHaveLength(2);
    expect(filters[0]).toContain("title.ilike.%casa%");
    expect(filters[0]).toContain("code.ilike.%casa%");
    expect(filters[1]).toContain("zone.ilike.%jardín%");
    expect(filters[1]).not.toMatch(/[()"]/);
  });
  it("sin texto no hay filtros", () => {
    expect(supabaseSearchFilters("   ")).toEqual([]);
  });
});

describe("matchesSearch", () => {
  const property = { title: "Casa con alberca", description: "Cerca de plazas", zone: "Senderos", address: "Av. Jardín 12, Torreón", code: "ACL-12" };
  it("ignora mayúsculas y acentos, en cualquier columna", () => {
    expect(matchesSearch(property, "TORREON")).toBe(true);
    expect(matchesSearch(property, "jardin")).toBe(true);
    expect(matchesSearch(property, "acl-12")).toBe(true);
  });
  it("exige todas las palabras", () => {
    expect(matchesSearch(property, "alberca senderos")).toBe(true);
    expect(matchesSearch(property, "alberca lerdo")).toBe(false);
  });
  it("sin texto coincide con todo", () => {
    expect(matchesSearch(property, "")).toBe(true);
  });
  it("stripAccents normaliza", () => {
    expect(stripAccents("Gómez Palacio")).toBe("gomez palacio");
  });
});

describe("zona del mapa", () => {
  const bounds = { south: 25, west: -104, north: 26, east: -103 };
  it("filtra por latitud y longitud, y descarta lo que no tiene coordenadas", () => {
    expect(matchesBounds({ lat: 25.5, lng: -103.5 }, bounds)).toBe(true);
    expect(matchesBounds({ lat: 27, lng: -103.5 }, bounds)).toBe(false);
    expect(matchesBounds({ lat: null, lng: null }, bounds)).toBe(false);
  });
  it("sin zona válida no filtra nada", () => {
    expect(matchesBounds({ lat: 1, lng: 1 }, null)).toBe(true);
    expect(matchesBounds({ lat: 1, lng: 1 }, { south: 2, north: 1, west: 0, east: 1 })).toBe(true);
  });
  it("va y viene de la dirección del navegador", () => {
    const param = boundsToParam({ south: 25.123456789, west: -104, north: 26, east: -103 });
    expect(param).toBe("25.12346,-104,26,-103");
    expect(boundsFromParam(param)).toEqual({ south: 25.12346, west: -104, north: 26, east: -103 });
  });
  it("rechaza parámetros malos", () => {
    expect(boundsFromParam("a,b,c,d")).toBeNull();
    expect(boundsFromParam("1,2,3")).toBeNull();
    expect(boundsFromParam("26,-104,25,-103")).toBeNull();
    expect(boundsFromParam("")).toBeNull();
  });
});
