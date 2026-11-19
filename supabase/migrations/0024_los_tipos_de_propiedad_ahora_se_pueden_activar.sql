-- ─────────────────────────────────────────────
-- Los tipos de propiedad (property_types) ahora se pueden activar/
-- desactivar desde /admin/zonas — un tipo inactivo se oculta del menú
-- (si tiene apartado propio, como Naves Industriales/Terrenos), se
-- muestra como "Próximamente" en el inicio, y su página dedicada
-- muestra el mismo aviso en vez del listado vacío. También se le puede
-- poner una imagen propia (se usa en las tarjetas de categoría del
-- inicio y, para Naves Industriales, en el panel del selector de arriba
-- del todo) — se sube al bucket property-images que ya existe, no hace
-- falta un bucket nuevo.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

alter table property_types add column if not exists active boolean not null default true;
alter table property_types add column if not exists image_url text;

