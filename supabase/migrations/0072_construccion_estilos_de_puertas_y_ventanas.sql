-- ─────────────────────────────────────────────
-- Construcción · estilos de puertas y ventanas (2026-10)
-- `estilo`: variante de la abertura (doble, corrediza, cochera, fija, ventanal…). Null = estilo básico.
-- Re-ejecutable. Si no se corre, las aberturas se guardan igual pero sin su estilo.
-- ─────────────────────────────────────────────
alter table construccion_aberturas add column if not exists estilo text;

