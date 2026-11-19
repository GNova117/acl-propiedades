-- ─────────────────────────────────────────────
-- Prospectos: "qué busca" estructurado (2026-10-16)
-- `search_criteria` guarda lo que busca el prospecto (tipo, operación, zona,
-- precio mínimo/máximo, recámaras mínimas) con el MISMO formato de criterios que
-- property_alerts.criteria, para cruzarlo con las propiedades disponibles con la
-- misma coincidencia (src/lib/alertMatch.js → matchesCriteria): en Prospectos se
-- ve "qué propiedades le encajan" y en Propiedades "a qué prospectos avisarles".
-- La RLS de prospectos ya cubre la columna nueva (cada asesor ve los suyos; la
-- oficina ve todos). Hay que ejecutarlo ANTES de capturar un "qué busca": guardar
-- uno sin la columna falla; guardar un prospecto sin él funciona con o sin ella.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

alter table prospectos add column if not exists search_criteria jsonb;

