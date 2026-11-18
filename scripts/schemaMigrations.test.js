import { describe, expect, it } from "vitest";
import { claimsReexecutable, migrationFileName, parseMigrationFileName, planMigrations, slugify, splitSchema } from "./schemaMigrations";

const RULE = "-- ─────────────────────────────────────────────";
const sample = ["-- Esquema", "create table a (id int);", "", RULE, "-- Segundo bloque (2026-11-18)", "-- (bloque re-ejecutable)", RULE, "create table b (id int);", "", RULE, "-- Tercero", RULE, "create table c (id int);", ""].join("\n");

describe("splitSchema", () => {
  it("parte en bloques por encabezado y al unirlos devuelve el texto exacto", () => {
    const parts = splitSchema(sample);
    expect(parts.map((p) => p.title)).toEqual(["Esquema base", "Segundo bloque (2026-11-18)", "Tercero"]);
    expect(parts.map((p) => p.sql).join("")).toBe(sample);
    expect(parts[1].sql).toContain("create table b");
    expect(parts[1].sql).not.toContain("create table c");
  });
  it("una línea suelta de ─── que no abre un encabezado no parte nada", () => {
    const text = ["create table a (id int);", RULE, "select 1;", ""].join("\n");
    expect(splitSchema(text)).toHaveLength(1);
  });
  it("sin encabezados es un solo bloque", () => {
    expect(splitSchema("select 1;\n")).toHaveLength(1);
  });
});

describe("nombres", () => {
  it("slugify quita acentos, fechas y signos", () => {
    expect(slugify("Verificación en dos pasos y dispositivos del panel (2026-11-18)")).toBe("verificacion_en_dos_pasos_y_dispositivos_del_panel");
    expect(slugify("")).toBe("");
    expect(slugify("x".repeat(100)).length).toBeLessThanOrEqual(60);
  });
  it("numera con cuatro dígitos y se puede leer de vuelta", () => {
    expect(migrationFileName(6, "Catálogo de materiales")).toBe("0007_catalogo_de_materiales.sql");
    expect(parseMigrationFileName("0007_catalogo_de_materiales.sql")).toEqual({ version: "0007", name: "catalogo_de_materiales" });
    expect(parseMigrationFileName("README.md")).toBeNull();
    expect(parseMigrationFileName("7_x.sql")).toBeNull();
  });
  it("reconoce los bloques que se declaran re-ejecutables", () => {
    expect(claimsReexecutable("-- (bloque re-ejecutable: puede copiarse...)")).toBe(true);
    expect(claimsReexecutable("create table x ();")).toBe(false);
  });
});

describe("planMigrations", () => {
  const files = ["0001_a.sql", "0002_b.sql", "0003_c.sql", "0004_d.sql", "LEEME.md"];
  it("devuelve lo pendiente en orden, o hasta un tope", () => {
    expect(planMigrations(files, []).map((m) => m.version)).toEqual(["0001", "0002", "0003", "0004"]);
    expect(planMigrations(files, ["0001", "0002"]).map((m) => m.version)).toEqual(["0003", "0004"]);
    expect(planMigrations(files, ["0001"], { to: "0003" }).map((m) => m.version)).toEqual(["0002", "0003"]);
    expect(planMigrations(files, ["0001", "0002", "0003", "0004"])).toEqual([]);
  });
  it("se niega a aplicar si hay un hueco o la base trae algo desconocido", () => {
    expect(() => planMigrations(files, ["0001", "0003"])).toThrow(/después de una pendiente/);
    expect(() => planMigrations(files, ["0001", "0099"])).toThrow(/no existen en el repositorio/);
  });
});
