-- ─────────────────────────────────────────────
-- Liquidaciones: "Costo total de liquidación" deja de tomarse en automático
-- del precio de la propiedad y vuelve a ser captura manual (el precio de
-- Propiedades ahora solo se muestra como referencia informativa aparte,
-- "Precio de la propiedad", que no alimenta el cálculo). "Inversión — pago
-- de servicios" deja de capturarse como monto — ahora es un porcentaje
-- (tasa_pago_servicios) sobre la inversión en remodelación, calculado en
-- vivo (no se guarda el monto derivado, mismo criterio que las demás tasas
-- de esta tabla).
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

alter table liquidaciones add column if not exists costo_total numeric not null default 0;
alter table liquidaciones add column if not exists tasa_pago_servicios numeric not null default 10;
alter table liquidaciones drop column if exists inversion_servicios;

