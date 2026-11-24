import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Bloque «Tiempo real del panel» de schema.sql. Se probó contra un Postgres 16: sin la publicación no hace nada; con ella
// agrega contact_messages y prospectos y una segunda corrida no repite ni falla.
const schema = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
const START = "-- Tiempo real del panel (2026-11-18)";
const start = schema.lastIndexOf("-- ───", schema.indexOf(START));
const rest = schema.slice(start + 10);
const later = rest.search(/\n-- ─+\n-- (?!Tiempo real del panel)[^\n]*\(2026-1[12]-\d\d\)/);
const block = schema.slice(start, later === -1 ? schema.length : start + 10 + later);

describe("schema.sql: tiempo real", () => {
  it("el bloque existe una sola vez", () => {
    expect(schema.split(START)).toHaveLength(2);
    expect(block.length).toBeGreaterThan(500);
  });

  it("agrega mensajes y prospectos a la publicación de Supabase sin repetirlos", () => {
    expect(block).toContain("array['contact_messages', 'prospectos']");
    expect(block).toContain("alter publication supabase_realtime add table public.%I");
    expect(block).toContain("not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime'");
  });

  it("fuera de Supabase (sin publicación) no hace nada", () => {
    expect(block).toContain("if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then\n    return;");
  });
});
