-- ─────────────────────────────────────────────
-- Editar un registro del historial de gastos (2026-09-30)
-- Antes solo se podía guardar o borrar; ahora también se puede corregir un
-- monto o el precio/crédito final de una casa ya guardada.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

alter table expense_reports add column if not exists updated_at timestamptz not null default now();

