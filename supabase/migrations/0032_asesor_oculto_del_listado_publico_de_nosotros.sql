-- ─────────────────────────────────────────────
-- Asesor "oculto" del listado público de /nosotros (2026-09-14)
-- Algunos registros de `advisors` (ej. "ACL Propiedades") existen solo
-- como contacto de respaldo para propiedades sin un agente asignado, no
-- como un integrante real del equipo — antes aparecían igual en la
-- tarjeta de /nosotros. `show_in_team` deja seguir usándolos como asesor
-- de una propiedad sin tocar nada más; solo controla si salen listados
-- en la página pública. Default true para no ocultar a nadie que ya
-- estaba visible.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

alter table advisors add column if not exists show_in_team boolean not null default true;

