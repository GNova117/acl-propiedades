-- ─────────────────────────────────────────────
-- Construcción · materiales por tipo de zona (2026-10)
-- `usos`: usos de zona a los que aplica un material (p. ej. {oficina,sala_juntas}); vacío o null = todas.
-- Re-ejecutable. Si no se corre, el catálogo funciona igual (sin el filtro "Aplica a" guardado).
-- ─────────────────────────────────────────────
alter table construccion_catalogo_materiales add column if not exists usos text[] not null default '{}';

