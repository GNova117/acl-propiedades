import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Migración «Reportes de problemas del equipo desde el panel». Se probó contra un Postgres 16 real (supabase/testdb/tests/
// 06_reporte_de_problemas.sql): queda con el correo de la sesión, no se agrupa, mínimo 10 caracteres, tope de 10 por hora por
// persona y un anónimo no puede. Estas pruebas vigilan que el SQL no pierda piezas.
const dir = new URL("./migrations/", import.meta.url);
const file = readFileSync(new URL("0115_reportes_de_problemas_del_equipo_desde_el_panel.sql", dir), "utf8");

describe("migración 0115: reportes de problemas", () => {
  it("agrega la etiqueta de quién lo mandó y es re-ejecutable", () => {
    expect(file).toContain("add column if not exists reported_by text");
    expect(file).toContain("create or replace function report_user_problem(");
  });

  it("el correo sale de la sesión (no de lo que escribe la persona) y se exige sesión", () => {
    expect(file).toContain("who text := auth.email()");
    expect(file).toContain("if who is null then");
    expect(file).toMatch(/insert into client_errors \([^)]*reported_by\)/);
    expect(file).not.toMatch(/p_(reported|email|who)/);
  });

  it("valida el texto, frena el exceso y marca el origen «usuario»", () => {
    expect(file).toContain("length(msg) < 10");
    expect(file).toContain("recent >= 10");
    expect(file).toContain("errcode = '54429'");
    expect(file).toContain("'usuario'");
  });

  it("solo el personal con sesión puede llamarla", () => {
    expect(file).toContain("revoke all on function report_user_problem(text, text, text, text) from public, anon;");
    expect(file).toContain("grant execute on function report_user_problem(text, text, text, text) to authenticated;");
  });
});
