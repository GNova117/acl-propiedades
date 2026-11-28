
-- ─────────────────────────────────────────────
-- Enlaces con token: vigencia visible para el cliente y enlace del informe con vencimiento (2026-11-25)
-- Los enlaces que se mandan por WhatsApp (selección, firma, documentos, registro, informe del vendedor) dan acceso a algo de una
-- persona. Que cada quien sepa hasta cuándo sirve su enlace, y que ninguno viva para siempre:
-- · signing_info, portal_token_status y client_intake_status ahora también regresan `expires_at` (el resto de lo que devolvían
--   queda igual), para que la página pública diga «Este enlace vence el …». La selección ya lo mostraba. client_intake_status
--   además trae `advisor` (nombre, foto y teléfono/WhatsApp del asesor que mandó el enlace): la página de registro lo leía directo
--   de la tabla de asesores, que desde la migración 0118 ya no entrega esas columnas al público.
-- · El enlace del informe de visitas (/informe/<token>) no vencía nunca y solo se podía regenerar o desactivar a mano. Ahora
--   `property_report_links.expires_at` (180 días desde que se crea o se regenera; los que ya existen cuentan desde hoy) y
--   visit_report_by_token no responde con uno vencido. El informe además trae `link_expires_at` para mostrarlo.
-- Revocar desde el panel ya existía en las selecciones, las firmas (cancelar), el portal de documentos, el enlace de registro y el
-- informe (desactivar/regenerar): no cambia.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

alter table property_report_links add column if not exists expires_at timestamptz not null default (now() + interval '180 days');

create or replace function visit_report_by_token(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select _visit_report_payload(l.property_id) || jsonb_build_object('link_expires_at', l.expires_at)
  from property_report_links l
  where l.token = p_token
    and l.expires_at > now();
$$;

revoke all on function visit_report_by_token(text) from public;
grant execute on function visit_report_by_token(text) to anon, authenticated;

create or replace function signing_info(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'title', title,
    'expires_at', expires_at,
    'status', case
      when status = 'pendiente' and now() > expires_at then 'expirado'
      when status = 'pendiente' and failed_attempts >= 5 then 'bloqueado'
      else status end)
  from signing_requests where token = p_token;
$$;

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
    'expires_at', t.expires_at,
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

create or replace function client_intake_status(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  l client_intake_links;
begin
  select * into l from client_intake_links where token = p_token;
  if not found then return jsonb_build_object('status', 'invalido'); end if;
  if l.revoked_at is not null then return jsonb_build_object('status', 'revocado'); end if;
  if l.submitted_at is not null then return jsonb_build_object('status', 'usado'); end if;
  if now() > l.expires_at then return jsonb_build_object('status', 'expirado'); end if;
  return jsonb_build_object(
    'status', 'activo', 'type', l.type, 'advisor_id', l.advisor_id, 'expires_at', l.expires_at,
    -- El contacto del asesor que mandó el enlace (para «avísale por WhatsApp» al terminar): quien tiene el enlace lo recibe aquí,
    -- porque el público ya no puede leer el teléfono directo de la tabla de asesores (migración 0118).
    'advisor', (select to_jsonb(x) from (select a.id, a.name, a.photo_url, a.phone, a.whatsapp from advisors a where a.id = l.advisor_id and a.active = true) x));
end;
$$;

revoke all on function portal_token_status(text) from public;
grant execute on function portal_token_status(text) to anon, authenticated;
revoke all on function client_intake_status(text) from public;
grant execute on function client_intake_status(text) to anon, authenticated;
