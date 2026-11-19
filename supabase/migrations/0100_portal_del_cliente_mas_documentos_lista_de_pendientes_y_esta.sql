-- ─────────────────────────────────────────────
-- Portal del cliente: más documentos, lista de pendientes y estatus del
-- trámite (2026-11)
--
-- El portal /documentos/<token> ya no es solo constancia + acta: el asesor
-- elige qué documentos le pide a ESTE cliente (INE, CURP, acta, constancia,
-- escrituras, predial, agua, luz, estado de cuenta — todos tipos que ya
-- existían en client_documents, no cambia su check de doc_type) y en qué
-- etapa va su trámite, con una nota opcional que el cliente lee tal cual.
-- El cliente ve su lista de pendientes (qué falta, qué está en revisión,
-- qué hay que corregir y qué ya entregó en la oficina) y el avance.
--
-- Una fila por cliente en client_tramites (no en client_portal_tokens: el
-- estatus es del cliente aunque todavía no tenga enlace, y regenerar el
-- enlace no debe borrarlo). Si no hay fila, la app usa la lista de
-- documentos por omisión según el tipo de cliente (clientPortal.js,
-- defaultRequestedDocs) y la primera etapa.
-- Las etapas válidas son las de TRAMITE_STAGE_KEYS en src/lib/clientPortal.js.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor,
-- DESPUÉS del bloque "Portal de documentos para clientes (autoservicio)")
-- ─────────────────────────────────────────────

create table if not exists client_tramites (
  client_id uuid primary key references clients(id) on delete cascade,
  stage text not null default 'documentos'
    check (stage in ('documentos', 'revision', 'promocion', 'oferta', 'avaluo', 'credito', 'firma', 'entrega')),
  note text check (note is null or char_length(note) <= 500),
  requested_docs text[] not null default '{}'
    check (requested_docs <@ array['ine', 'curp', 'acta_nacimiento', 'cedula_fiscal', 'escrituras', 'predial', 'agua', 'luz', 'cuenta_bancaria']::text[]),
  updated_by text,
  updated_at timestamptz not null default now()
);

alter table client_tramites enable row level security;

drop policy if exists "Rol con apartado clientes maneja client_tramites" on client_tramites;
create policy "Rol con apartado clientes maneja client_tramites" on client_tramites for all
  using (has_admin_section('clientes')) with check (has_admin_section('clientes'));

-- portal_token_status ahora también regresa: el tipo de cliente y cómo
-- compra (para elegir las etapas que se muestran), el trámite (etapa, nota,
-- documentos pedidos) y, de lo que capturó el asesor en la oficina, SOLO el
-- tipo y la fecha — nunca la ruta del archivo ni nada que lo identifique —,
-- para que la lista de pendientes no le pida al cliente algo que ya entregó.
create or replace function portal_token_status(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  t client_portal_tokens;
  c clients;
  tr client_tramites;
  docs jsonb;
  office_docs jsonb;
begin
  select * into t from client_portal_tokens where token = p_token;
  if not found then
    return jsonb_build_object('status', 'invalido');
  end if;
  if not t.active then
    return jsonb_build_object('status', 'desactivado');
  end if;
  if now() > t.expires_at then
    return jsonb_build_object('status', 'expirado');
  end if;

  select * into c from clients where id = t.client_id;
  select * into tr from client_tramites where client_id = t.client_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', d.id,
    'doc_type', d.doc_type,
    'file_kind', d.file_kind,
    'review_status', d.review_status,
    'review_notes', d.review_notes,
    'extracted_data', d.extracted_data,
    'qr_validated', d.qr_validated,
    'client_confirmed', d.client_confirmed,
    'captured_at', d.captured_at
  ) order by d.captured_at desc), '[]'::jsonb)
  into docs
  from client_documents d
  where d.client_id = t.client_id and d.source = 'client_portal';

  select coalesce(jsonb_agg(jsonb_build_object('doc_type', d.doc_type, 'captured_at', d.captured_at) order by d.captured_at desc), '[]'::jsonb)
  into office_docs
  from client_documents d
  where d.client_id = t.client_id and d.source = 'admin_capture';

  return jsonb_build_object(
    'status', 'activo',
    'client_name', split_part(c.name, ' ', 1),
    'client_type', c.type,
    'financiamiento', c.financiamiento,
    'tramite', case when tr.client_id is null then null else jsonb_build_object(
      'stage', tr.stage,
      'note', tr.note,
      'requested_docs', to_jsonb(tr.requested_docs),
      'updated_at', tr.updated_at
    ) end,
    'documents', docs,
    'office_documents', office_docs
  );
end;
$$;

revoke all on function portal_token_status(text) from public;
grant execute on function portal_token_status(text) to anon, authenticated;

