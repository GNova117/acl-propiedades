import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Bloque «Contratos de intermediación, comisiones por asesor y fusión de prospectos» de schema.sql. Se probó contra un
// Postgres 16 real (roles y permisos simulados): se aplica dos veces sin error; solo quien tiene Propiedades o Naves ve y
// maneja contratos; las comisiones las manejan solo los socios y cada asesor lee solo las suyas (pagada exige fecha);
// merge_prospects mueve etapas, contactos, citas, selecciones y notas internas, respeta lo que el prospecto conservado ya
// tiene, no deja a un asesor fusionar prospectos ajenos y no la ejecuta anon. Estas pruebas vigilan que el bloque no
// pierda piezas ni cuele secretos.
const schema = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
const START = "-- Contratos de intermediación, comisiones por asesor y fusión de prospectos (2026-11-17)";
const start = schema.lastIndexOf("-- ───", schema.indexOf(START));
const block = schema.slice(start);

describe("schema.sql: contratos, comisiones y fusión de prospectos", () => {
  it("el bloque existe una sola vez y va al final", () => {
    expect(schema.split(START)).toHaveLength(2);
    expect(schema.trimEnd().endsWith(block.trimEnd())).toBe(true);
  });

  it("el contrato vive en una tabla aparte de properties (que se lee en público) y con RLS por apartado", () => {
    expect(block).toContain("create table if not exists property_contracts (");
    expect(block).not.toMatch(/alter table properties/);
    expect(block).toContain("alter table property_contracts enable row level security;");
    expect(block).toContain("has_admin_section('propiedades') or has_admin_section('naves_industriales')");
    expect(block).toContain("check (kind in ('exclusiva', 'abierta'))");
    expect(block).toContain("expires_on date not null");
  });

  it("las comisiones: solo socios escriben, cada asesor lee las suyas, pagada lleva fecha y una por concepto", () => {
    expect(block).toContain("alter table commissions enable row level security;");
    expect(block).toContain("auth.email() in ('inmobiliaria@aclpropiedades.com', 'mh@aclpropiedades.com')");
    expect(block).toContain("on commissions for select\n  using (advisor_id = my_advisor_id());");
    expect(block).toContain("(status = 'pagada') = (paid_on is not null)");
    expect(block).toContain("unique (property_id, concept)");
    expect(block).not.toMatch(/create policy "Cada asesor[^;]*for (insert|update|delete|all)/);
  });

  it("merge_prospects exige sesión y apartado, limita a los propios y no se abre a anon", () => {
    expect(block).toContain("not has_admin_section('prospectos')");
    expect(block).toContain("k.advisor_id is distinct from me or r.advisor_id is distinct from me");
    expect(block).toContain("revoke all on function merge_prospects(uuid, uuid) from public, anon;");
    expect(block).toContain("grant execute on function merge_prospects(uuid, uuid) to authenticated;");
  });

  it("merge_prospects pasa toda la historia al conservado antes de borrar el otro", () => {
    for (const table of ["prospecto_etapas", "prospecto_contactos", "agenda_citas", "property_selections"]) {
      expect(block).toContain(`update ${table} set prospecto_id = k.id where prospecto_id = r.id;`);
    }
    expect(block).toContain("update internal_notes set entity_id = k.id where entity_type = 'prospect' and entity_id = r.id;");
    expect(block.indexOf("update internal_notes")).toBeLessThan(block.indexOf("delete from prospectos where id = r.id;"));
    expect(block).toContain("update prospectos set visit_id = null where id = r.id;"); // visit_id es único
  });

  it("la tabla de posiciones: solo conteos, solo asesores activos, sin revelar las metas y no para anon", () => {
    expect(block).toContain("create or replace function team_leaderboard()");
    expect(block).toContain("has_admin_section('prospectos') or has_admin_section('agenda')");
    expect(block).toContain("where a.active");
    expect(block).toContain("as goals_set");
    expect(block).toContain("as goals_met");
    expect(block).not.toMatch(/g\.contacts as|g\.visits as|g\.sales as|g\.new_prospects as/); // los números de la meta no salen
    expect(block).not.toMatch(/pr\.name|pr\.phone|pr\.email|ve\.property_id/); // ni datos de clientes ni de la venta
    expect(block).toContain("revoke all on function team_leaderboard() from public, anon;");
    expect(block).toContain("grant execute on function team_leaderboard() to authenticated;");
  });

  it("no lleva secretos", () => {
    expect(block).not.toMatch(/re_[A-Za-z0-9]{20,}|service_role_key|eyJ[A-Za-z0-9_-]{20,}/);
  });
});
