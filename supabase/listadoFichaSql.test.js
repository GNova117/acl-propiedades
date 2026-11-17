import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Bloque «Listado y ficha: próximas visitas, reacciones en la selección e interés en línea» de schema.sql.
// Se probó contra un Postgres 16 real (varias corridas seguidas, token/propiedad/reacción inválidos, eventos
// repetidos, propiedades inactivas); estas pruebas solo vigilan que el bloque no pierda piezas ni cuele secretos.
const schema = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
const START = "-- Listado y ficha: próximas visitas, reacciones en la selección e interés en línea (2026-11-17)";
const NEXT = "-- Avisos por correo al cliente del portal (2026-11-17)"; // el bloque que se agregó después
const start = schema.lastIndexOf("-- ───", schema.indexOf(START));
const block = schema.slice(start, schema.lastIndexOf("-- ───", schema.indexOf(NEXT, start)));

describe("schema.sql: listado y ficha", () => {
  it("el bloque existe una sola vez, completo y antes del de avisos al cliente", () => {
    expect(schema.split(START)).toHaveLength(2);
    expect(block.length).toBeGreaterThan(2000);
    expect(block.trimEnd().endsWith("$$;")).toBe(true);
  });

  it("trae las funciones públicas con sus permisos", () => {
    for (const [name, args] of [
      ["next_visit_slots", "uuid[], int"],
      ["selection_react", "text, uuid, text, text"],
      ["selection_open", "text, boolean"],
      ["track_property_event", "uuid, uuid, text"],
    ]) {
      expect(block).toContain(`create or replace function ${name}(`);
      expect(block).toContain(`grant execute on function ${name}(${args}) to anon, authenticated;`);
      expect(block).toContain(`revoke all on function ${name}(${args}) from public;`);
    }
  });

  it("es re-ejecutable: tablas, columnas e índices con «if not exists»", () => {
    expect(block).toContain("add column if not exists reactions");
    expect(block).toContain("create table if not exists property_events");
    expect(block).toContain("create index if not exists idx_property_events_property");
  });

  it("property_events no se lee ni se escribe directo (RLS sin políticas)", () => {
    expect(block).toContain("alter table property_events enable row level security;");
    expect(block).not.toMatch(/create policy[^;]*property_events/);
  });

  it("el informe del vendedor suma `interest` sin quitar lo que ya traía", () => {
    expect(block).toContain("'interest', jsonb_build_object(");
    for (const key of ["'property'", "'sold_on'", "'visits'"]) expect(block).toContain(key);
  });

  it("no lleva secretos", () => {
    expect(block).not.toMatch(/re_[A-Za-z0-9]{20,}|service_role|eyJ[A-Za-z0-9_-]{20,}/);
  });
});
