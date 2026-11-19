import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Migración «Enlace para que el cliente mismo capture sus datos». Se probó contra un Postgres 16 real (supabase/testdb/tests/
// 07_enlace_de_registro_del_cliente.sql): el tipo lo pone el enlace, un solo uso, vence, el consentimiento queda con IP y navegador,
// la contraseña del portal nunca se guarda y el freno por IP corta. Estas pruebas vigilan que el SQL no pierda piezas.
const dir = new URL("./migrations/", import.meta.url);
const file = readFileSync(new URL("0116_enlace_para_que_el_cliente_mismo_capture_sus_datos.sql", dir), "utf8");

describe("migración 0116: enlace de registro del cliente", () => {
  it("la tabla de enlaces solo la maneja el personal con el apartado clientes (el anónimo no la lee) y es re-ejecutable", () => {
    expect(file).toContain("create table if not exists client_intake_links");
    expect(file).toContain("alter table client_intake_links enable row level security;");
    expect(file).toContain("using (has_admin_section('clientes')) with check (has_admin_section('clientes'))");
    expect(file).not.toMatch(/create policy[^;]*to anon/);
    expect(file).toContain("check (token ~ '^[0-9a-f]{32}$')");
    expect(file).toContain("drop policy if exists");
  });

  it("el enlace vence a los 7 días y el tipo lo fija el asesor", () => {
    expect(file).toContain("default (now() + interval '7 days')");
    expect(file).toContain("type text not null check (type in ('comprador', 'vendedor', 'ambos'))");
    expect(file).toMatch(/insert into clients \([^)]*\) values \(\s*nm, l\.type,/s);
    expect(file).not.toMatch(/d ->> 'type'/);
  });

  it("frena los envíos anónimos y valida antes de crear el cliente", () => {
    expect(file).toContain("perform enforce_public_rate_limit('client_intake', 10, 100);");
    for (const code of ["consent_required", "name_required", "phone_invalid", "email_invalid", "rfc_invalid", "curp_invalid", "date_invalid", "civil_invalid"]) {
      expect(file).toContain(`'${code}'`);
    }
    expect(file).toContain("for update"); // dos envíos a la vez no crean dos clientes
  });

  it("de un solo uso: marca el enlace, liga el cliente y deja constancia del consentimiento", () => {
    expect(file).toContain("update client_intake_links set submitted_at = now(), client_id = new_id");
    expect(file).toContain("insert into privacy_consents (client_id, intake_link_id, consent_version, accepted_ip, accepted_agent)");
    expect(file).toContain("add column if not exists intake_link_id");
  });

  it("nunca guarda la contraseña del portal de crédito ni la identificación del derechohabiente", () => {
    expect(file).not.toContain("contrasena_portal");
    expect(file).not.toMatch(/dh_/);
  });

  it("los campos de comprador solo se guardan si es comprador o ambos, y el número de crédito si es vendedor o ambos", () => {
    expect(file).toContain("buyer := l.type <> 'vendedor';");
    expect(file).toContain("seller := l.type <> 'comprador';");
    expect(file).toContain("case when seller then nullif(left(btrim(coalesce(d ->> 'numero_credito'");
  });

  it("las dos funciones públicas las puede llamar el anónimo y nada más se expone", () => {
    expect(file).toContain("revoke all on function client_intake_status(text) from public;");
    expect(file).toContain("grant execute on function client_intake_status(text) to anon, authenticated;");
    expect(file).toContain("revoke all on function client_intake_submit(text, jsonb, text) from public;");
    expect(file).toContain("grant execute on function client_intake_submit(text, jsonb, text) to anon, authenticated;");
    expect(file).toMatch(/security definer\s+set search_path = public/);
  });
});
