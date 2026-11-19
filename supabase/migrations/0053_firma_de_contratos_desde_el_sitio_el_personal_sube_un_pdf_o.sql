-- ─────────────────────────────────────────────
-- Firma de contratos desde el sitio (2026-09-25). El personal sube un PDF (o lo
-- genera con el generador de documentos), se crea una solicitud con un enlace
-- privado /firmar/<token> y un código de 6 dígitos que el personal le da al
-- cliente por teléfono o WhatsApp. El cliente abre el enlace SIN iniciar
-- sesión, pone el código, lee el PDF y firma en pantalla.
--
-- Cómo se protege:
-- · La tabla está cerrada a todos menos al personal con el apartado
--   'documentos_legales'. El público solo llega por 3 funciones que exigen el
--   token (64 hex, 256 bits) y, para abrir o firmar, el código.
-- · El código se guarda con hash (nunca en claro) y se bloquea a los 5 intentos
--   fallidos; el personal puede regenerarlo.
-- · La solicitud caduca (7 días por omisión) y solo se puede firmar una vez.
-- · Al firmar se guardan fecha y hora del servidor, IP y navegador, y el hash
--   SHA-256 del PDF original se calcula en la base al crearlo.
-- · El personal no puede alterar la firma ni la evidencia: solo puede cambiar
--   estado, vigencia y la huella (columnas con permiso de UPDATE).
-- La huella (imagen capturada con el lector en la oficina) la agrega el personal.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

create table if not exists signing_requests (
  id uuid primary key default gen_random_uuid(),
  token text not null unique
    default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
    check (token ~ '^[0-9a-f]{64}$'),
  client_id uuid references clients(id) on delete set null,
  property_id uuid references properties(id) on delete set null,
  title text not null,
  signer_name text not null,
  document_b64 text not null,
  doc_sha256 text not null,
  code_hash text not null,
  failed_attempts int not null default 0,
  status text not null default 'pendiente' check (status in ('pendiente', 'firmado', 'cancelado')),
  expires_at timestamptz not null default now() + interval '7 days',
  created_by text,
  created_at timestamptz not null default now(),
  signed_at timestamptz,
  signed_name text,
  signature_b64 text,
  signer_ip text,
  signer_agent text,
  fingerprint_b64 text,
  fingerprint_by text,
  fingerprint_at timestamptz,
  sealed_at timestamptz,
  constraint signing_signed_has_evidence check (status <> 'firmado' or (signature_b64 is not null and signed_at is not null))
);

create index if not exists idx_signing_requests_client on signing_requests(client_id);
create index if not exists idx_signing_requests_created on signing_requests(created_at desc);

alter table signing_requests enable row level security;

drop policy if exists "Personal con documentos_legales ve solicitudes de firma" on signing_requests;
create policy "Personal con documentos_legales ve solicitudes de firma" on signing_requests for select
  using (has_admin_section('documentos_legales'));

drop policy if exists "Personal con documentos_legales edita solicitudes de firma" on signing_requests;
create policy "Personal con documentos_legales edita solicitudes de firma" on signing_requests for update
  using (has_admin_section('documentos_legales')) with check (has_admin_section('documentos_legales'));

drop policy if exists "Personal con documentos_legales borra solicitudes de firma" on signing_requests;
create policy "Personal con documentos_legales borra solicitudes de firma" on signing_requests for delete
  using (has_admin_section('documentos_legales'));

-- Sin política de insert: las solicitudes se crean solo con signing_create().
-- Y el personal solo puede actualizar estas columnas (no la firma ni la evidencia).
revoke update on signing_requests from anon, authenticated;
grant update (status, expires_at, fingerprint_b64, fingerprint_by, fingerprint_at, sealed_at) on signing_requests to authenticated;
revoke insert, truncate on signing_requests from anon, authenticated;

-- Hash del código: sha256(token:código). El token hace de "sal".
create or replace function _signing_code_hash(p_token text, p_code text)
returns text
language sql
immutable
as $$
  select encode(sha256(convert_to(p_token || ':' || coalesce(p_code, ''), 'utf8')), 'hex');
$$;

-- Código de 6 dígitos con aleatoriedad de uuid v4 (criptográfica).
create or replace function _signing_new_code()
returns text
language sql
volatile
as $$
  select lpad((('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))::bit(32)::bigint % 1000000)::text, 6, '0');
$$;

-- ── Personal: crear solicitud (devuelve el enlace y el código UNA vez) ──
create or replace function signing_create(
  p_client_id uuid,
  p_property_id uuid,
  p_title text,
  p_signer_name text,
  p_document_b64 text,
  p_expires_days int default 7
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  bytes bytea;
  new_code text := _signing_new_code();
  r signing_requests;
begin
  if not has_admin_section('documentos_legales') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if coalesce(trim(p_title), '') = '' or coalesce(trim(p_signer_name), '') = '' then
    raise exception 'title_and_signer_required';
  end if;
  if length(coalesce(p_document_b64, '')) > 14000000 then
    raise exception 'document_too_large';
  end if;
  bytes := decode(p_document_b64, 'base64');
  if substring(bytes from 1 for 4) <> '\x25504446'::bytea then
    raise exception 'not_a_pdf';
  end if;

  insert into signing_requests (client_id, property_id, title, signer_name, document_b64, doc_sha256, code_hash, expires_at, created_by)
  values (p_client_id, p_property_id, trim(p_title), trim(p_signer_name), p_document_b64,
          encode(sha256(bytes), 'hex'), 'pending', now() + make_interval(days => greatest(1, least(coalesce(p_expires_days, 7), 60))), auth.email())
  returning * into r;

  update signing_requests set code_hash = _signing_code_hash(r.token, new_code) where id = r.id;
  return jsonb_build_object('id', r.id, 'token', r.token, 'code', new_code, 'expires_at', r.expires_at);
end;
$$;

-- ── Personal: código nuevo (por si se perdió o se bloqueó) ──
create or replace function signing_regenerate_code(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  new_code text := _signing_new_code();
  r signing_requests;
begin
  if not has_admin_section('documentos_legales') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into r from signing_requests where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  if r.status <> 'pendiente' then raise exception 'not_pending'; end if;
  update signing_requests
  set code_hash = _signing_code_hash(r.token, new_code), failed_attempts = 0,
      expires_at = greatest(expires_at, now() + interval '1 day')
  where id = p_id;
  return jsonb_build_object('code', new_code);
end;
$$;

-- ── Público (con token): estado de la solicitud, sin revelar nada más ──
create or replace function signing_info(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'title', title,
    'status', case
      when status = 'pendiente' and now() > expires_at then 'expirado'
      when status = 'pendiente' and failed_attempts >= 5 then 'bloqueado'
      else status end)
  from signing_requests where token = p_token;
$$;

-- Comprueba token + código y cuenta los intentos fallidos. Devuelve NULL si todo
-- está bien, o el error como texto. (Los errores se devuelven, no se lanzan: un
-- error revertiría el conteo de intentos fallidos.)
create or replace function _signing_check(p_token text, p_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  r signing_requests;
begin
  select * into r from signing_requests where token = p_token for update;
  if not found then return 'not_found'; end if;
  if r.status <> 'pendiente' then return 'not_pending'; end if;
  if now() > r.expires_at then return 'expired'; end if;
  if r.failed_attempts >= 5 then return 'locked'; end if;
  if r.code_hash <> _signing_code_hash(p_token, p_code) then
    update signing_requests set failed_attempts = failed_attempts + 1 where id = r.id;
    return 'invalid_code';
  end if;
  return null;
end;
$$;

create or replace function signing_open(p_token text, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  err text := _signing_check(p_token, p_code);
  r signing_requests;
begin
  if err is not null then
    return jsonb_build_object('error', err);
  end if;
  select * into r from signing_requests where token = p_token;
  return jsonb_build_object('title', r.title, 'signer_name', r.signer_name, 'document_b64', r.document_b64, 'doc_sha256', r.doc_sha256);
end;
$$;

create or replace function signing_submit(p_token text, p_code text, p_signed_name text, p_signature_b64 text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  err text := _signing_check(p_token, p_code);
  headers json;
  ip text;
  agent text;
  r signing_requests;
begin
  if err is not null then
    return jsonb_build_object('error', err);
  end if;
  if coalesce(trim(p_signed_name), '') = '' or length(p_signed_name) > 200 then
    return jsonb_build_object('error', 'name_required');
  end if;
  -- Solo un PNG razonable: evita meter basura o archivos enormes.
  if p_signature_b64 is null or length(p_signature_b64) > 600000 or left(p_signature_b64, 5) <> 'iVBOR' then
    return jsonb_build_object('error', 'bad_signature');
  end if;

  headers := nullif(current_setting('request.headers', true), '')::json;
  ip := nullif(trim(split_part(coalesce(headers ->> 'x-forwarded-for', headers ->> 'cf-connecting-ip', ''), ',', 1)), '');
  agent := left(coalesce(headers ->> 'user-agent', ''), 300);

  update signing_requests
  set status = 'firmado', signed_at = now(), signed_name = trim(p_signed_name), signature_b64 = p_signature_b64,
      signer_ip = ip, signer_agent = nullif(agent, '')
  where token = p_token
  returning * into r;
  return jsonb_build_object('signed_at', r.signed_at, 'ip', r.signer_ip);
end;
$$;

-- Permisos de ejecución: las de personal solo para 'authenticated' (y ellas mismas
-- revisan el apartado); las públicas para todos, pero exigen el token.
revoke execute on function signing_create(uuid, uuid, text, text, text, int) from public, anon;
revoke execute on function signing_regenerate_code(uuid) from public, anon;
revoke execute on function _signing_check(text, text) from public, anon, authenticated;
revoke execute on function signing_info(text) from public;
revoke execute on function signing_open(text, text) from public;
revoke execute on function signing_submit(text, text, text, text) from public;
grant execute on function signing_create(uuid, uuid, text, text, text, int) to authenticated;
grant execute on function signing_regenerate_code(uuid) to authenticated;
grant execute on function signing_info(text) to anon, authenticated;
grant execute on function signing_open(text, text) to anon, authenticated;
grant execute on function signing_submit(text, text, text, text) to anon, authenticated;

-- Quedan en el registro de actividad (solo nombres de columna, nunca la firma).
do $$
begin
  if to_regclass('public.signing_requests') is not null and to_regprocedure('public.audit_row_change()') is not null then
    drop trigger if exists trg_audit_row_change on signing_requests;
    create trigger trg_audit_row_change after insert or update or delete on signing_requests
      for each row execute function audit_row_change();
  end if;
end;
$$;

