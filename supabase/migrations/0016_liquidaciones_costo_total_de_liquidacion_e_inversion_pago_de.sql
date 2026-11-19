-- ─────────────────────────────────────────────
-- Liquidaciones: "Costo total de liquidación" e "Inversión — pago de
-- servicios" vuelven a ser captura manual — se quita la interpolación
-- automática de ambos. "Precio de la propiedad" se conserva como campo de
-- solo lectura aparte, ahora también visible como línea de referencia en
-- el RESUMEN, sin alimentar el cálculo.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

alter table liquidaciones add column if not exists costo_total numeric not null default 0;
alter table liquidaciones add column if not exists inversion_servicios numeric not null default 0;

