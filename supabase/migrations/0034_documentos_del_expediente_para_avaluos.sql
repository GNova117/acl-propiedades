-- ─────────────────────────────────────────────
-- Documentos del expediente para avalúos (2026-09-15)
-- El avalúo se entrega con un expediente armado: del comprador la
-- solicitud de avalúo + identificación, y del vendedor los documentos del
-- inmueble (escrituras, predial, agua, luz) + su identificación. Los
-- 5 tipos nuevos son: solicitud_avaluo, escrituras, predial, agua, luz.
-- El RFC NO es un tipo nuevo: es `cedula_fiscal`, que ya existía (la
-- cédula de identificación fiscal es el documento del RFC) y solo cambia
-- su etiqueta en la interfaz.
-- Mismo patrón que pago_avaluo/contrato — se busca y reemplaza el
-- constraint existente por su definición real, no por nombre adivinado.
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
  check (doc_type in ('ine', 'curp', 'cedula_fiscal', 'acta_nacimiento', 'pago_avaluo', 'contrato', 'carta_deslindamiento', 'aviso_privacidad', 'carta_derechos', 'solicitud_avaluo', 'escrituras', 'predial', 'agua', 'luz'));

