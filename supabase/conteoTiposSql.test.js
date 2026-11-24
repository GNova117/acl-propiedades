import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Bloque «Conteo de propiedades por tipo» de schema.sql: función de solo lectura, pública, que respeta las políticas de la
// tabla (sin security definer) y cuenta solo propiedades activas.
const schema = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
const START = "-- Conteo de propiedades por tipo, sin bajar el catálogo (2026-11-18)";
const start = schema.lastIndexOf("-- ───", schema.indexOf(START));
const rest = schema.slice(start + 10);
const later = rest.search(/\n-- ─+\n-- (?!Conteo de propiedades)[^\n]*\(2026-1[12]-\d\d\)/);
const block = schema.slice(start, later === -1 ? schema.length : start + 10 + later);

describe("schema.sql: conteo por tipo", () => {
  it("existe una sola vez y es una función estable pública", () => {
    expect(schema.split(START)).toHaveLength(2);
    expect(block).toContain("create or replace function public_type_counts()");
    expect(block).toContain("stable");
    expect(block).toContain("grant execute on function public_type_counts() to anon, authenticated;");
  });

  it("cuenta solo las activas y no se salta las políticas de la tabla", () => {
    expect(block).toContain("from properties where active group by type");
    expect(block).not.toContain("security definer");
  });
});
