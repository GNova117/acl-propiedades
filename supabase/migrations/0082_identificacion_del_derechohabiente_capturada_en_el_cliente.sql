-- ─────────────────────────────────────────────
-- Identificación del derechohabiente capturada en el cliente (2026-10-09)
-- Mismas claves `dh_*` que usan la sección 1 de la Solicitud de avalúo y la
-- sección 5 de la Solicitud de crédito INFONAVIT — ver clientExpedienteFields.js
-- (CLIENT_DERECHOHABIENTE_FIELDS) y clienteToDerechohabiente/
-- clienteToDerechohabienteCredito. Solo se piden/muestran cuando
-- `financiamiento = 'infonavit'` (AdminClientForm.jsx). No son datos
-- sensibles como `contrasena_portal`, así que no se cifran.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

alter table clients add column if not exists dh_apellido_paterno text;
alter table clients add column if not exists dh_apellido_materno text;
alter table clients add column if not exists dh_nombres text;
alter table clients add column if not exists dh_curp text;
alter table clients add column if not exists dh_rfc text;
alter table clients add column if not exists dh_calle_numero text;
alter table clients add column if not exists dh_colonia text;
alter table clients add column if not exists dh_municipio text;
alter table clients add column if not exists dh_estado text;
alter table clients add column if not exists dh_codigo_postal text;
alter table clients add column if not exists dh_telefono_casa text;
alter table clients add column if not exists dh_telefono_trabajo text;
alter table clients add column if not exists dh_telefono_celular text;

-- Mismo motivo que el bloque de `financiamiento` (y el de "Datos personales
-- pegados al cliente") arriba: hay que agregar las columnas nuevas también
-- a `clients_decrypted` o desaparecen de la lectura (ver
-- supabaseBackend.js getClients/getClientById). Van al final de la lista
-- por la misma razón: `create or replace view` no permite reordenar ni
-- renombrar columnas ya existentes, solo agregar nuevas al final.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

create or replace view clients_decrypted
with (security_invoker = true) as
select
  id, name, type, email, phone, notes, active, created_at, updated_at,
  nss, _decrypt_portal_password(contrasena_portal) as contrasena_portal, numero_credito,
  referencia1_nombre, referencia1_telefono, referencia1_correo, referencia1_direccion,
  referencia2_nombre, referencia2_telefono, referencia2_correo, referencia2_direccion,
  razon_social, registro_patronal, tel_empresa, financiamiento,
  fecha_nacimiento, estado_civil, domicilio, rfc, curp, identificacion_oficial,
  dh_apellido_paterno, dh_apellido_materno, dh_nombres, dh_curp, dh_rfc,
  dh_calle_numero, dh_colonia, dh_municipio, dh_estado, dh_codigo_postal,
  dh_telefono_casa, dh_telefono_trabajo, dh_telefono_celular
from clients;
grant select on clients_decrypted to authenticated;

