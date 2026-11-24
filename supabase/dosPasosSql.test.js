import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Bloque «Verificación en dos pasos y dispositivos del panel» de schema.sql. Se probó contra un Postgres 16 real (con
// auth.jwt / auth.mfa_factors / storage.objects simulados): sin 2FA activado se ve todo; con 2FA activado y solo contraseña
// (aal1) no se ven clients, client_documents, perfilamientos_comprador ni el bucket client-documents (sí las demás fotos);
// con código (aal2) se ve todo; otra persona sin 2FA no se afecta; los dispositivos se registran, se limitan y se olvidan.
const schema = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
const START = "-- Verificación en dos pasos y dispositivos del panel (2026-11-18)";
const start = schema.lastIndexOf("-- ───", schema.indexOf(START));
const rest = schema.slice(start + 10);
const later = rest.search(/\n-- ─+\n-- (?!Verificación en dos pasos)[^\n]*\(2026-1[12]-\d\d\)/);
const block = schema.slice(start, later === -1 ? schema.length : start + 10 + later);

describe("schema.sql: dos pasos y dispositivos", () => {
  it("el bloque existe una sola vez", () => {
    expect(schema.split(START)).toHaveLength(2);
    expect(block.length).toBeGreaterThan(2000);
  });

  it("mfa_ok deja pasar a quien no activó 2FA y a quien ya confirmó su código", () => {
    expect(block).toContain("coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'");
    expect(block).toContain("not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified')");
  });

  it("protege los datos sensibles con políticas restrictivas y re-ejecutables", () => {
    for (const table of ["clients", "client_documents"]) {
      expect(block).toContain(`drop policy if exists "Dos pasos para datos sensibles" on ${table};`);
      expect(block).toContain(`create policy "Dos pasos para datos sensibles" on ${table} as restrictive for all to authenticated`);
    }
    expect(block).toContain("perfilamientos_comprador");
    expect(block).toContain("bucket_id <> 'client-documents' or mfa_ok()");
  });

  it("los dispositivos: RLS solo lectura propia y escritura únicamente por funciones", () => {
    expect(block).toContain("alter table admin_devices enable row level security;");
    expect(block).toContain("for select to authenticated");
    expect(block).not.toMatch(/create policy[^;]*admin_devices[^;]*for (insert|update|delete|all)/);
    for (const fn of ["touch_admin_device(text, text)", "forget_other_admin_devices(text)"]) {
      expect(block).toContain(`revoke all on function ${fn} from public, anon;`);
      expect(block).toContain(`grant execute on function ${fn} to authenticated;`);
    }
  });
});
