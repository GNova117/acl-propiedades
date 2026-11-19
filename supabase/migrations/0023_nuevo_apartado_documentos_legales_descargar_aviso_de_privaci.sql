-- ─────────────────────────────────────────────
-- Nuevo apartado "documentos_legales" (descargar Aviso de Privacidad y
-- Carta de Derechos en PDF membretado). No hay tabla nueva ni cambio de
-- RLS que hacer — el contenido sale de i18n, no de la base de datos — así
-- que aquí solo se le da el apartado al rol 'admin' por default; el
-- negocio puede dárselo a otro rol desde /admin/roles si hace falta.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

update admin_roles
set sections = array_append(sections, 'documentos_legales')
where slug = 'admin' and not ('documentos_legales' = any(sections));

