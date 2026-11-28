import { describe, expect, it } from "vitest";
import { buildPendingSql } from "./pendingSqlLib";

const files = [
  { name: "0117_viejo.sql", sql: "select 1;\n" },
  { name: "0118_uno.sql", sql: "create table a();\n\n" },
  { name: "0119_dos.sql", sql: "create table b();\n" },
];

describe("buildPendingSql", () => {
  it("junta solo desde la versión pedida, en orden, y anota las migraciones", () => {
    const sql = buildPendingSql(files, 118);
    expect(sql).toContain("migraciones 0118 a 0119 (2 archivos)");
    expect(sql).not.toContain("select 1;");
    expect(sql.indexOf("create table a();")).toBeLessThan(sql.indexOf("create table b();"));
    expect(sql).toContain("('0118', 'uno'),");
    expect(sql).toContain("('0119', 'dos')\non conflict (version) do nothing;");
    expect(sql).toContain("devuelve 0119".replace("devuelve", "debe devolver"));
  });

  it("sin migraciones nuevas no genera nada", () => {
    expect(buildPendingSql(files, 200)).toBe("");
  });
});
