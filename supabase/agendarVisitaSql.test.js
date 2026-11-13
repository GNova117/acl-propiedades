import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// supabase/agendar-visita.sql es una copia del último bloque de schema.sql, para pegarlo solo en el SQL
// Editor. Si alguien cambia el bloque en schema.sql y olvida la copia, el despliegue usaría SQL viejo.
const schema = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
const standalone = readFileSync(new URL("./agendar-visita.sql", import.meta.url), "utf8");

const START = "-- Agendar visita con horarios reales (2026-11-03)";
// Bloques que se agregaron DESPUÉS en schema.sql (cada uno con su cabecera): el bloque de visitas termina donde empieza el
// primero. Si se agrega otro bloque al final de schema.sql, anótalo aquí.
const LATER_BLOCKS = ["-- Selección de propiedades en un solo enlace (2026-11-13)"];
const block = () => {
  const at = schema.indexOf(START);
  const ends = LATER_BLOCKS.map((title) => schema.indexOf(title, at))
    .filter((index) => index > at)
    .map((index) => schema.lastIndexOf("-- ───", index));
  return schema.slice(schema.lastIndexOf("-- ───", at), ends.length ? Math.min(...ends) : undefined);
};

describe("supabase/agendar-visita.sql", () => {
  it("termina con el bloque de schema.sql, idéntico (si falla: regenerar la copia)", () => {
    expect(standalone.trimEnd().endsWith(block().trimEnd())).toBe(true);
  });

  it("antes del bloque solo lleva comentarios (no hay SQL suelto ni secretos)", () => {
    const header = standalone.slice(0, standalone.trimEnd().length - block().trimEnd().length);
    for (const line of header.split("\n")) expect(line === "" || line.startsWith("--")).toBe(true);
    expect(standalone).not.toMatch(/re_[A-Za-z0-9]{20,}|service_role|eyJ[A-Za-z0-9_-]{20,}/);
  });

  it("contiene lo que hay que desplegar: funciones, triggers y el job de recordatorios", () => {
    for (const name of ["get_visit_slots", "book_visit", "get_booking", "reschedule_booking", "cancel_booking", "confirm_booking_attendance", "get_booking_slots", "visit_promote_prospect", "notify_visit_email", "request_visit", "claim_visit_request"]) {
      expect(standalone).toContain(`create or replace function ${name}(`);
    }
    for (const trigger of ["trg_notify_visit_email", "trg_agenda_citas_reset_reminders", "trg_agenda_citas_sync_prospect"]) expect(standalone).toContain(`create trigger ${trigger}`);
    expect(standalone).toContain("'visita-recordatorios'");
  });
});
