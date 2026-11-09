import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// supabase/portal-cliente.sql lleva copias de dos bloques de schema.sql para
// correrlos solos en el SQL Editor. Si alguien cambia un bloque en schema.sql
// y olvida la copia, el despliegue usaría SQL viejo.
const schema = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
const standalone = readFileSync(new URL("./portal-cliente.sql", import.meta.url), "utf8");

const DIVIDER = "-- ─────────────────────────────────────────────";

// Desde el título del bloque hasta justo antes del siguiente bloque.
function block(title) {
  const at = schema.indexOf(title);
  expect(at, `no se encontró «${title}» en schema.sql`).toBeGreaterThan(-1);
  const start = schema.lastIndexOf(DIVIDER, at);
  const nextTitle = schema.indexOf(`${DIVIDER}\n-- `, at + title.length);
  return schema.slice(start, nextTitle).trimEnd();
}

describe("supabase/portal-cliente.sql", () => {
  it("trae el bloque del portal de documentos idéntico al de schema.sql", () => {
    expect(standalone).toContain(block("-- Portal de documentos para clientes (autoservicio) (2026-10)"));
  });

  it("trae el bloque de pendientes y estatus del trámite idéntico al de schema.sql", () => {
    expect(standalone).toContain(block("-- Portal del cliente: más documentos, lista de pendientes y estatus del"));
  });

  it("corre el portal base antes que el bloque nuevo (que usa client_portal_tokens)", () => {
    expect(standalone.indexOf("create table if not exists client_portal_tokens")).toBeLessThan(standalone.indexOf("create table if not exists client_tramites"));
  });

  it("no lleva secretos", () => {
    expect(standalone).not.toMatch(/re_[A-Za-z0-9]{20,}|eyJ[A-Za-z0-9_-]{20,}/);
  });
});
