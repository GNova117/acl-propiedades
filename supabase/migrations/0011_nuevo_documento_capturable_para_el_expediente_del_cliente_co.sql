-- ─────────────────────────────────────────────
-- Nuevo documento capturable para el expediente del cliente: contrato.
-- Mismo patrón que pago_avaluo — se busca y reemplaza el constraint
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
  check (doc_type in ('ine', 'curp', 'cedula_fiscal', 'acta_nacimiento', 'pago_avaluo', 'contrato'));

