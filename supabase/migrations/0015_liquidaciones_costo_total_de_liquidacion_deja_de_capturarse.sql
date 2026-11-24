-- ─────────────────────────────────────────────
-- Liquidaciones: "Costo total de liquidación" deja de capturarse a mano de
-- nuevo — el usuario probó el campo manual en producción y pidió revertirlo:
-- el Resumen debe calcular siempre directo desde el precio vigente de la
-- propiedad (properties.price), sin un número aparte que se pueda
-- desincronizar. Se quita la columna por completo; el campo "Precio de la
-- propiedad" (solo lectura) es ahora la única fuente.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

alter table liquidaciones drop column if exists costo_total;

