-- ─────────────────────────────────────────────
-- Datos de la empresa del comprador en el cliente (2026-09-17)
-- El trámite de crédito pide comprobar la relación laboral: razón social,
-- registro patronal y número de la empresa. Ya se capturaban en el
-- perfilamiento del comprador (mismas llaves) y ahora también van pegados
-- al cliente, para que la hoja de datos del expediente para avalúos los
-- imprima sin depender de que exista un perfilamiento.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

alter table clients add column if not exists razon_social text;
alter table clients add column if not exists registro_patronal text;
alter table clients add column if not exists tel_empresa text;

