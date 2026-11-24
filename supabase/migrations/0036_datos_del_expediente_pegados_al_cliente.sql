-- ─────────────────────────────────────────────
-- Datos del expediente pegados al cliente (2026-09-17)
-- Al comprador se le piden NSS, contraseña del portal de crédito y 2
-- referencias personales (nombre, teléfono, correo y dirección); al
-- vendedor, el número de crédito con el que paga el inmueble que vende.
-- Estos datos ya se capturaban en el perfilamiento y se siguen capturando
-- ahí: a petición explícita del negocio se piden en los dos lados, cada
-- pantalla con su propia copia. En `clients` viven para que el expediente
-- para avalúos pueda imprimir la hoja de datos sin depender de que exista
-- un perfilamiento. La contraseña queda en texto plano igual que en
-- perfilamientos_comprador — mismo riesgo aceptado, ver README.
-- Además se completan las referencias del perfilamiento del comprador
-- (antes solo nombre y teléfono) y se agrega el número de crédito al
-- perfilamiento del vendedor.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

alter table clients add column if not exists nss text;
alter table clients add column if not exists contrasena_portal text;
alter table clients add column if not exists numero_credito text;
alter table clients add column if not exists referencia1_nombre text;
alter table clients add column if not exists referencia1_telefono text;
alter table clients add column if not exists referencia1_correo text;
alter table clients add column if not exists referencia1_direccion text;
alter table clients add column if not exists referencia2_nombre text;
alter table clients add column if not exists referencia2_telefono text;
alter table clients add column if not exists referencia2_correo text;
alter table clients add column if not exists referencia2_direccion text;

alter table perfilamientos_comprador add column if not exists referencia1_correo text;
alter table perfilamientos_comprador add column if not exists referencia1_direccion text;
alter table perfilamientos_comprador add column if not exists referencia2_correo text;
alter table perfilamientos_comprador add column if not exists referencia2_direccion text;

alter table perfilamientos add column if not exists numero_credito text;

