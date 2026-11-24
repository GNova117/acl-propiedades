-- ─────────────────────────────────────────────
-- Segmentación del cliente por financiamiento (2026-10-09)
-- Permite marcar con qué va a comprar: INFONAVIT, FOVISSSTE, crédito
-- bancario o de contado. Cuando es "infonavit", Solicitud de avalúo y
-- Solicitud de crédito preseleccionan al cliente (y, en Solicitud de
-- crédito, el producto "Infonavit") al crear una solicitud nueva desde su
-- ficha — ver AdminClientForm.jsx / AdminSolicitudAvaluo.jsx /
-- AdminSolicitudCredito.jsx.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

alter table clients add column if not exists financiamiento text;

do $$
declare
  con record;
begin
  for con in
    select conname from pg_constraint
    where conrelid = 'clients'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%financiamiento%'
  loop
    execute format('alter table clients drop constraint %I', con.conname);
  end loop;
end $$;

alter table clients add constraint clients_financiamiento_check
  check (financiamiento is null or financiamiento in ('infonavit', 'fovissste', 'bancario', 'contado'));

-- `financiamiento` no es sensible (no se cifra) pero clients_decrypted es la
-- vista que usa toda la app para leer clientes — hay que agregarla aquí
-- también o desaparece de esa lectura, igual que advierte el comentario de
-- la vista más arriba.
-- `create or replace view` no permite reordenar ni renombrar columnas ya
-- existentes en la vista — solo agregar nuevas al final. `financiamiento`
-- va al final de la lista, no junto a `active`, para no correr de lugar
-- `created_at`/`updated_at`/etc. que ya existían en esta vista.
create or replace view clients_decrypted
with (security_invoker = true) as
select
  id, name, type, email, phone, notes, active, created_at, updated_at,
  nss, _decrypt_portal_password(contrasena_portal) as contrasena_portal, numero_credito,
  referencia1_nombre, referencia1_telefono, referencia1_correo, referencia1_direccion,
  referencia2_nombre, referencia2_telefono, referencia2_correo, referencia2_direccion,
  razon_social, registro_patronal, tel_empresa, financiamiento
from clients;
grant select on clients_decrypted to authenticated;

