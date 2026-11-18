-- ─────────────────────────────────────────────
-- Cuenta bancaria del vendedor (2026-09-17)
-- Documento nuevo capturable solo en el expediente del vendedor: el estado
-- de cuenta/carátula donde se le deposita el pago de la operación. No entra
-- en el PDF del expediente para avalúos (ese orden lo define el valuador y
-- la cuenta es para el cobro, no para el avalúo), pero se puede ver y
-- descargar como cualquier otro documento del cliente.
-- Mismo patrón que los tipos anteriores — se busca y reemplaza el constraint
-- existente por su definición real, no por nombre adivinado.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

do $$
declare
  con record;
begin
  for con in
    select conname from pg_constraint
    where conrelid = 'client_documents'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%doc_type%'
  loop
    execute format('alter table client_documents drop constraint %I', con.conname);
  end loop;
end $$;

alter table client_documents add constraint client_documents_doc_type_check
  check (doc_type in ('ine', 'curp', 'cedula_fiscal', 'acta_nacimiento', 'pago_avaluo', 'contrato', 'carta_deslindamiento', 'aviso_privacidad', 'carta_derechos', 'solicitud_avaluo', 'escrituras', 'predial', 'agua', 'luz', 'cuenta_bancaria'));

