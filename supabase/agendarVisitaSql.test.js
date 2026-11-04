import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// supabase/agendar-visita.sql es una copia del último bloque de schema.sql, para pegarlo solo en el SQL
// Editor. Si alguien cambia el bloque en schema.sql y olvida la copia, el despliegue usaría SQL viejo.
const schema = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
const standalone = readFileSync(new URL("./agendar-visita.sql", import.meta.url), "utf8");

const START = "-- Agendar visita con horarios reales (2026-11-03)";
const block = () => {
  const at = schema.indexOf(START);
  return schema.slice(schema.lastIndexOf("-- ───", at));
};

describe("supabase/agendar-visita.sql", () => {
  it("termina con el bloque de schema.sql, idéntico (si falla: regenerar la copia)", () => {
    expect(standalone.endsWith(block())).toBe(true);
  });

  it("antes del bloque solo lleva comentarios (no hay SQL suelto ni secretos)", () => {
    const header = standalone.slice(0, standalone.length - block().length);
    for (const line of header.split("\n")) expect(line === "" || line.startsWith("--")).toBe(true);
    expect(standalone).not.toMatch(/re_[A-Za-z0-9]{20,}|service_role|eyJ[A-Za-z0-9_-]{20,}/);
  });

  it("contiene lo que hay que desplegar: funciones, triggers y el job de recordatorios", () => {
    for (const name of ["get_visit_slots", "book_visit", "get_booking", "reschedule_booking", "cancel_booking", "confirm_booking_attendance", "get_booking_slots", "visit_promote_prospect", "notify_visit_email"]) {
      expect(standalone).toContain(`create or replace function ${name}(`);
    }
    for (const trigger of ["trg_notify_visit_email", "trg_agenda_citas_reset_reminders", "trg_agenda_citas_sync_prospect"]) expect(standalone).toContain(`create trigger ${trigger}`);
    expect(standalone).toContain("'visita-recordatorios'");
  });
});
