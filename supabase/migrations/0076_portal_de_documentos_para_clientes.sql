-- ─────────────────────────────────────────────
-- Portal de documentos para clientes (autoservicio) (2026-10)
--
-- El cliente NUNCA entrega credenciales del SAT ni de gob.mx: descarga su
-- propia Constancia de Situación Fiscal y su Acta de Nacimiento desde los
-- portales oficiales y sube el PDF aquí. El acceso es por un enlace privado
-- con token (/documentos/<token>, igual patrón que /informe/<token> y
-- /firmar/<token>: nada de login de cliente) que SOLO el asesor genera y
-- comparte desde /admin/clientes/:id/documentos — el cliente no se puede
-- autoregistrar.
--
-- Reutiliza client_documents (no se crea una tabla aparte): se le agregan
-- columnas para distinguir el origen (asesor vs. portal), guardar lo que
-- la extracción automática (texto + QR del PDF) encontró, y el estado de
-- revisión. El archivo sigue viviendo en el mismo bucket privado
-- client-documents, con el mismo esquema de ruta `${client_id}/...` que ya
-- usa el panel — así AdminClientDocuments.jsx no necesita cambiar cómo
-- pide las URLs firmadas.
--
-- Quién escribe qué:
-- · api/portal-upload.js (función de Vercel) usa SUPABASE_SERVICE_ROLE_KEY
--   para subir el archivo validado a Storage e insertar la fila — valida el
--   token, el tipo real del archivo y el límite de intentos ANTES de
--   escribir nada (igual que ya hacen las Edge Functions de Agenda con esa
--   misma llave). El estado de revisión que calcula ('valido' o
--   'requiere_revision') es solo una sugerencia automática: nunca
--   'rechazado' por sí sola — eso lo decide siempre una persona.
-- · portal_token_status / portal_register_consent / portal_confirm_document
--   son las únicas funciones que puede llamar el navegador del cliente
--   (anon, sin sesión) — security definer, cada una revisa el token por su
--   cuenta antes de leer o escribir nada.
-- · Generar/revocar el enlace y aprobar/rechazar un documento los hace el
--   asesor con su sesión normal, bajo las políticas RLS de siempre
--   (has_admin_section('clientes')) — no hace falta una función aparte.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

alter table client_documents add column if not exists source text not null default 'admin_capture'
  check (source in ('admin_capture', 'client_portal'));
alter table client_documents add column if not exists file_kind text not null default 'document'
  check (file_kind in ('document', 'backup_image'));
alter table client_documents add column if not exists extracted_data jsonb not null default '{}';
alter table client_documents add column if not exists qr_validated boolean;
alter table client_documents add column if not exists review_status text not null default 'pendiente'
  check (review_status in ('pendiente', 'valido', 'requiere_revision', 'rechazado'));
alter table client_documents add column if not exists review_notes text;
alter table client_documents add column if not exists reviewed_by text;
alter table client_documents add column if not exists reviewed_at timestamptz;
alter table client_documents add column if not exists client_confirmed boolean not null default false;

create index if not exists idx_client_documents_source on client_documents(source);

-- Un solo token por cliente (unique en client_id): "generar enlace" hace un
-- upsert — si ya había uno lo REGENERA (token nuevo, el anterior deja de
-- servir en el acto), igual que property_report_links/saveReportLink.
create table if not exists client_portal_tokens (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique references clients(id) on delete cascade,
  token text not null unique default replace(gen_random_uuid()::text, '-', '')
    check (token ~ '^[0-9a-f]{32}$'),
  active boolean not null default true,
  created_by text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days'),
  last_accessed_at timestamptz
);

create index if not exists idx_client_portal_tokens_client on client_portal_tokens(client_id);

alter table client_portal_tokens enable row level security;

drop policy if exists "Rol con apartado clientes maneja client_portal_tokens" on client_portal_tokens;
create policy "Rol con apartado clientes maneja client_portal_tokens" on client_portal_tokens for all
  using (has_admin_section('clientes')) with check (has_admin_section('clientes'));

-- Bitácora de accesos (requisito de privacidad): quién hizo qué y cuándo,
-- SIN nombre/RFC/CURP — solo ids y la acción. actor_ref es el correo del
-- asesor en acciones de admin, o null en acciones del cliente (el portal no
-- identifica al cliente por nombre, solo por el token que ya trae el enlace).
create table if not exists document_access_log (
  id uuid primary key default gen_random_uuid(),
  client_document_id uuid references client_documents(id) on delete set null,
  client_id uuid references clients(id) on delete set null,
  actor_type text not null check (actor_type in ('client', 'admin', 'system')),
  actor_ref text,
  action text not null check (action in ('view', 'download', 'upload', 'approve', 'reject', 'consent')),
  created_at timestamptz not null default now()
);

create index if not exists idx_document_access_log_client on document_access_log(client_id, created_at desc);

alter table document_access_log enable row level security;

drop policy if exists "Rol con apartado clientes lee document_access_log" on document_access_log;
create policy "Rol con apartado clientes lee document_access_log" on document_access_log for select
  using (has_admin_section('clientes'));

-- El panel también escribe aquí directo (al aprobar/rechazar), con su
-- propia sesión — por eso sí hay política de insert para 'authenticated'
-- (las acciones del cliente las registran las funciones security definer
-- de abajo, que no necesitan esta política porque corren con privilegios
-- propios).
drop policy if exists "Rol con apartado clientes escribe document_access_log" on document_access_log;
create policy "Rol con apartado clientes escribe document_access_log" on document_access_log for insert
  with check (has_admin_section('clientes'));

-- Evidencia de que el cliente aceptó el aviso de privacidad antes de subir
-- nada (LFPDPPP). IP y navegador vía request.headers, igual que ya hace
-- signing_submit() para la evidencia de firma — ver ese bloque arriba.
create table if not exists privacy_consents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  token_id uuid references client_portal_tokens(id) on delete set null,
  consent_version text not null,
  accepted_at timestamptz not null default now(),
  accepted_ip text,
  accepted_agent text
);

create index if not exists idx_privacy_consents_client on privacy_consents(client_id);

alter table privacy_consents enable row level security;

drop policy if exists "Rol con apartado clientes lee privacy_consents" on privacy_consents;
create policy "Rol con apartado clientes lee privacy_consents" on privacy_consents for select
  using (has_admin_section('clientes'));

-- Límite de intentos de subida por token (contra abuso/fuerza bruta del
-- enlace). api/portal-upload.js cuenta y escribe aquí con la llave de
-- servicio antes de procesar cualquier archivo — ver el límite en ese
-- archivo (PORTAL_UPLOAD_HOURLY_LIMIT), no fijo en SQL.
create table if not exists portal_upload_attempts (
  id uuid primary key default gen_random_uuid(),
  token_id uuid not null references client_portal_tokens(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_portal_upload_attempts_token on portal_upload_attempts(token_id, created_at desc);

alter table portal_upload_attempts enable row level security;

drop policy if exists "Rol con apartado clientes lee portal_upload_attempts" on portal_upload_attempts;
create policy "Rol con apartado clientes lee portal_upload_attempts" on portal_upload_attempts for select
  using (has_admin_section('clientes'));

-- ── Público (con token, sin sesión): estado del enlace + sus documentos ──
-- Nunca se le manda el client_id al navegador, solo el primer nombre (para
-- el saludo) y los documentos ya subidos por el PROPIO portal (nunca los
-- capturados por el asesor, aunque sean el mismo cliente).
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
  docs jsonb;
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

  return jsonb_build_object('status', 'activo', 'client_name', split_part(c.name, ' ', 1), 'documents', docs);
end;
$$;

revoke all on function portal_token_status(text) from public;
grant execute on function portal_token_status(text) to anon, authenticated;

-- ── Público (con token): registrar la aceptación del aviso de privacidad ──
create or replace function portal_register_consent(p_token text, p_consent_version text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t client_portal_tokens;
  headers json;
  ip text;
  agent text;
begin
  select * into t from client_portal_tokens where token = p_token;
  if not found then return jsonb_build_object('error', 'not_found'); end if;
  if not t.active then return jsonb_build_object('error', 'desactivado'); end if;
  if now() > t.expires_at then return jsonb_build_object('error', 'expirado'); end if;
  if coalesce(trim(p_consent_version), '') = '' then return jsonb_build_object('error', 'version_required'); end if;

  headers := nullif(current_setting('request.headers', true), '')::json;
  ip := nullif(trim(split_part(coalesce(headers ->> 'x-forwarded-for', headers ->> 'cf-connecting-ip', ''), ',', 1)), '');
  agent := left(coalesce(headers ->> 'user-agent', ''), 300);

  insert into privacy_consents (client_id, token_id, consent_version, accepted_ip, accepted_agent)
  values (t.client_id, t.id, p_consent_version, ip, agent);

  insert into document_access_log (client_id, actor_type, action)
  values (t.client_id, 'client', 'consent');

  update client_portal_tokens set last_accessed_at = now() where id = t.id;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function portal_register_consent(text, text) from public;
grant execute on function portal_register_consent(text, text) to anon, authenticated;

-- ── Público (con token): el cliente confirma o corrige los datos que leyó
-- la extracción automática, sobre UN documento que ya es suyo (el mismo
-- client_id del token) y que vino del propio portal — nunca puede tocar un
-- documento capturado por el asesor.
create or replace function portal_confirm_document(p_token text, p_document_id uuid, p_extracted_data jsonb, p_client_confirmed boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t client_portal_tokens;
  d client_documents;
begin
  select * into t from client_portal_tokens where token = p_token;
  if not found or not t.active or now() > t.expires_at then
    return jsonb_build_object('error', 'invalid_token');
  end if;

  select * into d from client_documents
    where id = p_document_id and client_id = t.client_id and source = 'client_portal'
    for update;
  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;

  update client_documents
  set extracted_data = coalesce(p_extracted_data, extracted_data),
      client_confirmed = coalesce(p_client_confirmed, client_confirmed)
  where id = d.id;

  insert into document_access_log (client_document_id, client_id, actor_type, action)
  values (d.id, t.client_id, 'client', 'upload');

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function portal_confirm_document(text, uuid, jsonb, boolean) from public;
grant execute on function portal_confirm_document(text, uuid, jsonb, boolean) to anon, authenticated;

