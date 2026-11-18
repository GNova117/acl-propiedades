import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseMigrationFileName } from "../scripts/schemaMigrations.js";

// supabase/migrations/ es la fuente; supabase/schema.sql se genera uniéndolas (npm run schema:build). Estas pruebas vigilan que
// no se desincronicen y que la numeración sea continua.
const dir = new URL("./migrations/", import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

describe("supabase/migrations", () => {
  it("todos los archivos son migraciones numeradas, sin repetidos ni huecos", () => {
    const parsed = files.map((f) => parseMigrationFileName(f));
    expect(parsed.every(Boolean), "un archivo no cumple NNNN_nombre.sql").toBe(true);
    const versions = parsed.map((p) => Number(p.version));
    expect(versions).toEqual(versions.map((_, i) => i + 1));
  });

  it("schema.sql es exactamente la unión de las migraciones", () => {
    const joined = files.map((f) => readFileSync(new URL(f, dir), "utf8")).join("");
    expect(joined === readFileSync(new URL("./schema.sql", import.meta.url), "utf8"), "corre `npm run schema:build` y sube el resultado").toBe(true);
  });

  it("ninguna migración está vacía", () => {
    for (const f of files) expect(readFileSync(new URL(f, dir), "utf8").trim().length, f).toBeGreaterThan(10);
  });
});
