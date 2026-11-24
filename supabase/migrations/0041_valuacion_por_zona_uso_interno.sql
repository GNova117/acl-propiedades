-- ─────────────────────────────────────────────
-- Valuación por zona (2026-09-21) — uso interno (/admin/valuacion)
-- Cada zona pasa a tener dos precios por m²: `price_per_m2` (que ya existía y
-- se usa como precio de CONSTRUCCIÓN) y `land_price_per_m2` (TERRENO, nuevo).
-- Arranca en 0: la pantalla avisa "esta zona no tiene precio de terreno" en
-- lugar de inventar un valor; se captura desde /admin/zonas.
-- OJO: `zones` tiene lectura pública (el sitio la consulta con la anon key), así
-- que este precio queda legible igual que `price_per_m2`, aunque ninguna página
-- pública lo muestre. Si algún día debe ser privado, va en una tabla aparte con
-- RLS has_admin_section('valuacion').
-- El apartado no tiene tabla propia (no guarda valuaciones, solo calcula): lo
-- único que requiere es darle el permiso al rol Administrador.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

alter table zones add column if not exists land_price_per_m2 numeric not null default 0;

update admin_roles
set sections = array_append(sections, 'valuacion')
where slug = 'admin' and not ('valuacion' = any(sections));

