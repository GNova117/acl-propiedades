import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Bloque «Monitoreo de errores del navegador» de schema.sql. Se probó contra un Postgres 16 real: los envíos mal formados se
// ignoran, el mismo error se agrupa y cuenta, un error resuelto que vuelve reaparece como nuevo y pendiente de aviso, solo
// un administrador lee/actualiza y el envío público se frena (54429).
const schema = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
const START = "-- Monitoreo de errores del navegador (2026-11-18)";
const start = schema.lastIndexOf("-- ───", schema.indexOf(START));
const rest = schema.slice(start + 10);
const later = rest.search(/\n-- ─+\n-- (?!Monitoreo de errores)[^\n]*\(2026-1[12]-\d\d\)/);
const block = schema.slice(start, later === -1 ? schema.length : start + 10 + later);

describe("schema.sql: monitoreo de errores", () => {
  it("el bloque existe una sola vez", () => {
    expect(schema.split(START)).toHaveLength(2);
    expect(block.length).toBeGreaterThan(2000);
  });

  it("la tabla es re-ejecutable, agrupa por huella y solo la lee el apartado roles", () => {
    expect(block).toContain("create table if not exists client_errors");
    expect(block).toContain("fingerprint text not null unique");
    expect(block).toContain("alter table client_errors enable row level security;");
    expect(block).toContain("using (has_admin_section('roles'))");
    expect(block).not.toMatch(/create policy[^;]*client_errors[^;]*for insert/);
  });

  it("report_client_error es público, valida la huella, usa el freno y reabre lo resuelto", () => {
    expect(block).toContain("grant execute on function report_client_error(text, text, text, text, text, text, text) to anon, authenticated;");
    expect(block).toContain("p_fingerprint !~ '^[0-9a-f]{8}$'");
    expect(block).toContain("enforce_public_rate_limit('client_errors', 60, 600)");
    expect(block).toContain("on conflict (fingerprint) do update");
    expect(block).toContain("case when client_errors.status = 'resuelto' then 'nuevo'");
    expect(block).toContain("notified_at = case when client_errors.status = 'resuelto' then null");
  });

  it("agenda el aviso cada 30 minutos con las credenciales del Vault", () => {
    expect(block).toContain("'errores-aviso'");
    expect(block).toContain("'*/30 * * * *'");
    expect(block).toContain("/functions/v1/errores-aviso");
    expect(block).toContain("x-cron-secret");
  });

  it("el freno de envíos públicos está definido ANTES que este bloque (lo usa)", () => {
    expect(schema.indexOf("create or replace function enforce_public_rate_limit")).toBeLessThan(schema.indexOf(START));
  });
});
