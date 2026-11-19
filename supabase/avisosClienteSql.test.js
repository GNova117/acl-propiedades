import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Bloque «Avisos por correo al cliente del portal» de schema.sql. Se probó contra un Postgres 16 real (con pg_net,
// pg_cron y vault simulados): el trigger solo avisa con notify_client, los reclamos no duplican, el máximo y la espera
// de los recordatorios se respetan, solo service_role ejecuta los reclamos y un fallo de pg_net no impide guardar la
// etapa. Estas pruebas vigilan que el bloque no pierda piezas, ni cuele secretos, ni se abra a anon.
const schema = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
const START = "-- Avisos por correo al cliente del portal (2026-11-17)";
const NEXT = "-- Encuesta tras la visita y vendidas recientes con sus días (2026-11-17)"; // el bloque que se agregó después
const start = schema.lastIndexOf("-- ───", schema.indexOf(START));
const block = schema.slice(start, schema.lastIndexOf("-- ───", schema.indexOf(NEXT, start)));

describe("schema.sql: avisos por correo al cliente del portal", () => {
  it("el bloque existe una sola vez y está completo, antes del de la encuesta", () => {
    expect(schema.split(START)).toHaveLength(2);
    expect(block.length).toBeGreaterThan(2000);
    expect(block.trimEnd().endsWith("'recordatorios')\n  );\n  $$\n);")).toBe(true);
  });

  it("es opt-in: notify_client apagado por omisión y los triggers lo respetan", () => {
    expect(block).toContain("add column if not exists notify_client boolean not null default false");
    expect(block).toContain("if not new.notify_client or new.stage is not distinct from old.stage then");
  });

  it("trae los triggers, los reclamos y el job diario", () => {
    for (const trigger of ["trg_client_tramite_reset_reminders", "trg_client_tramite_notify"]) expect(block).toContain(`create trigger ${trigger}`);
    for (const fn of ["portal_claim_stage_notice", "portal_claim_reminder", "portal_release_reminder", "notify_client_stage", "client_tramite_reset_reminders"]) {
      expect(block).toContain(`create or replace function ${fn}(`);
    }
    expect(block).toContain("'portal-recordatorios'");
    expect(block).toContain("'30 16 * * *'");
  });

  it("los reclamos solo los ejecuta service_role (nunca anon ni authenticated)", () => {
    for (const sig of ["portal_claim_stage_notice(uuid, text)", "portal_claim_reminder(uuid, integer, integer)", "portal_release_reminder(uuid, timestamptz, integer)"]) {
      expect(block).toContain(`revoke all on function ${sig} from public, anon, authenticated;`);
      expect(block).toContain(`grant execute on function ${sig} to service_role;`);
      expect(block).not.toContain(`grant execute on function ${sig} to anon`);
    }
  });

  it("un fallo de pg_net no impide guardar el cambio de etapa", () => {
    expect(block).toContain("exception when others then");
    expect(block).toContain("raise warning 'notify_client_stage");
  });

  it("no lleva secretos (los de Vault se leen en tiempo de ejecución)", () => {
    expect(block).not.toMatch(/re_[A-Za-z0-9]{20,}|service_role_key|eyJ[A-Za-z0-9_-]{20,}/);
    expect(block).toContain("vault.decrypted_secrets");
  });
});
