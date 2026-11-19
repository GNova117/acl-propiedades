import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Bloque «Encuesta tras la visita y vendidas recientes con sus días» de schema.sql. Se probó contra un Postgres 16 real
// (con pg_net y vault simulados): la encuesta solo sale al pasar a «realizada» una visita del sitio, se reclama una sola
// vez, y las respuestas validan token, estado, calificación y comentario y no se repiten. Estas pruebas vigilan que el
// bloque no pierda piezas, ni cuele secretos, ni se abra a anon.
const schema = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
const START = "-- Encuesta tras la visita y vendidas recientes con sus días (2026-11-17)";
const NEXT = "-- Ofertas y apartados por propiedad, y calendario suscribible de la Agenda (2026-11-17)"; // el bloque que se agregó después
const start = schema.lastIndexOf("-- ───", schema.indexOf(START));
const block = schema.slice(start, schema.lastIndexOf("-- ───", schema.indexOf(NEXT, start)));

describe("schema.sql: encuesta tras la visita", () => {
  it("el bloque existe una sola vez y termina con el trigger de correo, antes del de ofertas", () => {
    expect(schema.split(START)).toHaveLength(2);
    expect(block.trimEnd().endsWith("return new;\nend;\n$$;")).toBe(true);
  });

  it("trae las funciones públicas con sus permisos", () => {
    for (const [name, args] of [
      ["get_visit_survey", "text"],
      ["submit_visit_feedback", "text, integer, text"],
      ["public_sales_stats", ""],
    ]) {
      expect(block).toContain(`create or replace function ${name}(`);
      expect(block).toContain(`grant execute on function ${name}(${args}) to anon, authenticated;`);
    }
  });

  it("el reclamo del correo solo lo ejecuta service_role", () => {
    expect(block).toContain("revoke all on function visit_claim_survey(uuid) from public, anon, authenticated;");
    expect(block).toContain("grant execute on function visit_claim_survey(uuid) to service_role;");
  });

  it("las respuestas no se leen ni se escriben directo: solo lectura para el personal, escritura por la función", () => {
    expect(block).toContain("alter table visit_feedback enable row level security;");
    expect(block).not.toMatch(/create policy[^;]*visit_feedback[^;]*for (insert|update|delete|all)/);
    expect(block).toContain("for select");
    expect(block).toContain("cita_id uuid not null unique");
  });

  it("el trigger de correo manda la encuesta al pasar a «realizada» y conserva lo demás", () => {
    expect(block).toContain("kind := 'encuesta'");
    for (const kind of ["'solicitud'", "'confirmacion'", "'cancelacion'", "'reprogramada'"]) expect(block).toContain(kind);
    expect(block).toContain("raise warning 'notify_visit_email");
  });

  it("las vendidas recientes traen los días y nunca «0 días»", () => {
    expect(block).toContain("'recent_sold'");
    expect(block).toContain("case when r.days > 0 then r.days end");
    expect(block).toContain("'recent_property_ids'");
  });

  it("no lleva secretos", () => {
    expect(block).not.toMatch(/re_[A-Za-z0-9]{20,}|service_role_key|eyJ[A-Za-z0-9_-]{20,}/);
  });
});
