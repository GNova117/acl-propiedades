import { describe, expect, it } from "vitest";
import { buildFavoritesShareUrl, mergeFavorites, parseSharedIds, SHARED_MAX } from "./favoritesShare";

describe("favoritesShare", () => {
  it("arma y lee el enlace de una lista", () => {
    const url = buildFavoritesShareUrl("https://acl.test", ["a1", "b2", "a1"]);
    expect(url).toBe("https://acl.test/favoritos?lista=a1,b2");
    expect(parseSharedIds(new URL(url).search)).toEqual(["a1", "b2"]);
  });
  it("sin favoritos el enlace es solo la página", () => {
    expect(buildFavoritesShareUrl("https://acl.test", [])).toBe("https://acl.test/favoritos");
    expect(parseSharedIds("")).toEqual([]);
  });
  it("lee ids de Supabase (uuid) y del modo demo", () => {
    const uuid = "123e4567-e89b-12d3-a456-426614174000";
    expect(parseSharedIds(`?lista=${uuid},prop-2`)).toEqual([uuid, "prop-2"]);
  });
  it("descarta lo que no parece un id y limita la cantidad", () => {
    expect(parseSharedIds("?lista=ok,<script>,a b,,x%2Fy,fine")).toEqual(["ok", "fine"]);
    const many = Array.from({ length: SHARED_MAX + 10 }, (_, i) => `id${i}`).join(",");
    expect(parseSharedIds(`?lista=${many}`)).toHaveLength(SHARED_MAX);
    expect(buildFavoritesShareUrl("https://x", many.split(",")).split(",")).toHaveLength(SHARED_MAX);
  });
  it("mezcla sin repetir", () => {
    expect(mergeFavorites(["a", "b"], ["b", "c"])).toEqual(["a", "b", "c"]);
    expect(mergeFavorites(null, ["x"])).toEqual(["x"]);
  });
});
