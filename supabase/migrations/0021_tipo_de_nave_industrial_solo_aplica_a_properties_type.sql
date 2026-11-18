-- ─────────────────────────────────────────────
-- Tipo de nave industrial (A / B) — solo aplica a properties.type =
-- 'nave_industrial', pero se deja como columna libre (sin check
-- constraint contra el tipo) para no tener que tocar SQL otra vez si el
-- negocio agrega una clasificación C/D más adelante; la UI ya solo
-- ofrece A/B por ahora.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

alter table properties add column if not exists tipo_nave text;

