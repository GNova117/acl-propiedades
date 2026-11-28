
-- ─────────────────────────────────────────────
-- Plantilla membretada solo para roles con acceso (2026-11-25)
-- La hoja membretada (logotipo, marca de agua y pie) con la que se arman los PDF deja de ser un archivo público: ahora la entrega
-- /api/plantilla únicamente a quien tenga sesión y el apartado `membrete` en su rol. No hay tabla nueva: solo se agrega el apartado.
-- Se le da al rol Administrador; para los asesores se activa desde Roles y accesos (casilla «Plantilla membretada»). Quien no la
-- tenga sigue generando sus PDF, pero sobre una hoja en blanco.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

update admin_roles
set sections = array_append(sections, 'membrete')
where slug = 'admin' and not ('membrete' = any(sections));
