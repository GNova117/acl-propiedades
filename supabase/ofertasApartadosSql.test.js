import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Bloque «Ofertas y apartados por propiedad, y calendario suscribible de la Agenda» de schema.sql. Se probó contra un
// Postgres 16 real (roles y funciones de permisos simulados): se aplica dos veces sin error; solo quien tiene el apartado
// Propiedades o Naves ve y maneja ofertas y apartados; los montos, el tipo y el nombre se validan en la base; hay un solo
// apartado vigente por propiedad; el token del calendario se crea/regenera solo con el apartado Agenda, cada quien ve
// solo el suyo y get_agenda_feed devuelve citas confirmadas sin teléfonos. Estas pruebas vigilan que el bloque no pierda
// piezas, ni cuele secretos, ni se abra a anon.
const schema = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
const START = "-- Ofertas y apartados por propiedad, y calendario suscribible de la Agenda (2026-11-17)";
const start = schema.lastIndexOf("-- ───", schema.indexOf(START));
const block = schema.slice(start);

describe("schema.sql: ofertas, apartados y calendario suscribible", () => {
  it("el bloque existe una sola vez y va al final", () => {
    expect(schema.split(START)).toHaveLength(2);
    expect(schema.trimEnd().endsWith(block.trimEnd())).toBe(true);
  });

  it("ofertas y apartados: RLS con el permiso de Propiedades o Naves y validaciones en la base", () => {
    for (const table of ["property_offers", "property_holds"]) {
      expect(block).toContain(`alter table ${table} enable row level security;`);
      expect(block).toContain(`on ${table} for all`);
    }
    expect(block).toContain("has_admin_section('propiedades') or has_admin_section('naves_industriales')");
    expect(block).toContain("check (amount > 0)");
    expect(block).toContain("check (party in ('cliente', 'propietario'))");
    expect(block).toContain("check (status in ('vigente', 'concretado', 'cancelado'))");
    expect(block).toContain("create unique index if not exists uniq_property_holds_vigente on property_holds(property_id) where status = 'vigente';");
  });

  it("el token del calendario: solo lo ve su dueño y no se escribe directo", () => {
    expect(block).toContain("alter table agenda_feed_tokens enable row level security;");
    expect(block).toContain("for select\n  using (email = auth.email());");
    expect(block).not.toMatch(/create policy[^;]*agenda_feed_tokens[^;]*for (insert|update|delete|all)/);
    expect(block).toContain("token text not null unique check (token ~ '^[0-9a-f]{64}$')");
  });

  it("crear el token exige sesión y el apartado Agenda; anon no lo ejecuta", () => {
    expect(block).toContain("not has_admin_section('agenda')");
    expect(block).toContain("revoke all on function create_agenda_feed_token() from public, anon;");
    expect(block).toContain("grant execute on function create_agenda_feed_token() to authenticated;");
  });

  it("el feed es público por token, sin datos de contacto del cliente", () => {
    expect(block).toContain("grant execute on function get_agenda_feed(text) to anon, authenticated;");
    expect(block).toContain("p_token !~ '^[0-9a-f]{64}$'");
    expect(block).not.toMatch(/contact_phone|contact_email|contact_name/);
    expect(block).toContain("status = 'confirmada'");
  });

  it("no lleva secretos", () => {
    expect(block).not.toMatch(/re_[A-Za-z0-9]{20,}|service_role_key|eyJ[A-Za-z0-9_-]{20,}/);
  });
});
