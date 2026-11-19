-- ─────────────────────────────────────────────
-- contact_messages.details (2026-09-25): datos estructurados de los formularios
-- públicos nuevos (simulador de crédito y "¿cuánto vale tu casa?"). El insert
-- público sigue igual (with check (true)). Nuevos valores de channel:
-- 'simulador' y 'estimacion'.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────
alter table contact_messages add column if not exists details jsonb;

