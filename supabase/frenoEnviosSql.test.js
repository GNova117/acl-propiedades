import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Bloque «Freno de envíos públicos en el servidor» de schema.sql. Se probó contra un Postgres 16 real: el envío 11 de la
// misma IP se rechaza (54429), otra IP pasa, el personal y el SQL Editor no se frenan, anon no lee la tabla de conteo ni
// llama la función directo y el tope global corta. Estas pruebas vigilan que el bloque no pierda piezas.
const schema = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
const START = "-- Freno de envíos públicos en el servidor (2026-11-18)";
const start = schema.lastIndexOf("-- ───", schema.indexOf(START));
const blockEnd = (() => {
  // El bloque llega hasta el siguiente encabezado fechado que se agregue después (si lo hay).
  const rest = schema.slice(start + 10);
  const later = rest.search(/\n-- ─+\n-- (?!Freno de envíos)[^\n]*\(2026-1[12]-\d\d\)/);
  return later === -1 ? schema.length : start + 10 + later;
})();
const block = schema.slice(start, blockEnd);

describe("schema.sql: freno de envíos públicos", () => {
  it("el bloque existe una sola vez", () => {
    expect(schema.split(START)).toHaveLength(2);
    expect(block.length).toBeGreaterThan(2000);
  });

  it("la tabla de conteo no se lee ni se escribe directo (RLS sin políticas) y es re-ejecutable", () => {
    expect(block).toContain("create table if not exists public_rate_hits");
    expect(block).toContain("alter table public_rate_hits enable row level security;");
    expect(block).not.toMatch(/create policy[^;]*public_rate_hits/);
    expect(block).toContain("create index if not exists idx_public_rate_hits_bucket_ip");
  });

  it("solo frena al rol anónimo y rechaza con el código 54429", () => {
    expect(block).toContain("coalesce(auth.role(), '') <> 'anon'");
    expect(block).toContain("errcode = '54429'");
  });

  it("la función que cuenta no es llamable por anon ni authenticated", () => {
    expect(block).toContain("revoke all on function enforce_public_rate_limit(text, int, int, interval) from public, anon, authenticated;");
  });

  it("frena contact_messages y property_alerts con disparadores security definer", () => {
    for (const table of ["contact_messages", "property_alerts"]) {
      expect(block).toContain(`create trigger trg_limit_${table}\nbefore insert on ${table}`);
      expect(block).toContain(`drop trigger if exists trg_limit_${table} on ${table};`);
    }
    expect(block.match(/security definer/g)?.length).toBeGreaterThanOrEqual(3);
  });
});
