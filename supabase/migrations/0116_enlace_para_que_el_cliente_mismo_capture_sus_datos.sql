
-- ─────────────────────────────────────────────
-- Enlace para que el cliente mismo capture sus datos (2026-11-19)
-- El asesor genera un enlace (/registro/<token>) desde Clientes y se lo manda al cliente por WhatsApp o correo. El asesor
-- decide ANTES si es comprador, vendedor o ambos (el cliente no lo elige); el cliente, sin iniciar sesión, llena nombre,
-- teléfono, correo y sus datos personales, acepta el aviso de privacidad y al enviar se crea el cliente en el panel.
-- · client_intake_links: un enlace por cliente nuevo, de un solo uso, vence a los 7 días (el asesor puede desactivarlo).
-- · client_intake_status(token): qué mostrar en la página pública (sin datos de nadie).
-- · client_intake_submit(token, datos, versión del aviso): valida, crea la fila en clients, marca el enlace como usado y
--   deja constancia del consentimiento (privacy_consents, con IP y navegador). Solo acepta una lista fija de campos: NO se
--   pide la contraseña del portal de crédito ni nada del trámite; eso lo captura el equipo.
-- · Freno de envíos: 10 por hora por IP y 100 por hora en total (enforce_public_rate_limit, bloque «Freno de envíos públicos»).
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

create table if not exists client_intake_links (
  id uuid primary key default gen_random_uuid(),
  token text not null unique check (token ~ '^[0-9a-f]{32}$'),
  type text not null check (type in ('comprador', 'vendedor', 'ambos')),
  label text check (label is null or char_length(label) <= 120),   -- nota interna del asesor («Pareja de Juan»)
  created_by text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  revoked_at timestamptz,
  submitted_at timestamptz,
  client_id uuid references clients(id) on delete set null
);

create index if not exists idx_client_intake_links_created on client_intake_links(created_at desc);

alter table client_intake_links enable row level security;

drop policy if exists "Rol con apartado clientes maneja client_intake_links" on client_intake_links;
create policy "Rol con apartado clientes maneja client_intake_links" on client_intake_links for all
  using (has_admin_section('clientes')) with check (has_admin_section('clientes'));

-- La constancia de consentimiento también puede venir de un enlace de registro (no solo del portal de documentos).
alter table privacy_consents add column if not exists intake_link_id uuid references client_intake_links(id) on delete set null;

-- ── Público (con token): qué mostrar ──
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
  return jsonb_build_object('status', 'activo', 'type', l.type);
end;
$$;

revoke all on function client_intake_status(text) from public;
grant execute on function client_intake_status(text) to anon, authenticated;

-- ── Público (con token): el cliente envía sus datos ──
-- Regresa { ok: true } o { ok: false, error: '<código>' } (la pantalla lo traduce). Un enlace que ya no sirve responde con el
-- mismo estado que client_intake_status. Un campo en blanco queda en null; RFC y CURP se guardan en mayúsculas.
create or replace function client_intake_submit(p_token text, p_data jsonb, p_consent_version text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  l client_intake_links;
  d jsonb := coalesce(p_data, '{}'::jsonb);
  nm text := left(btrim(coalesce(d ->> 'name', '')), 120);
  ph text := left(btrim(coalesce(d ->> 'phone', '')), 30);
  em text := lower(left(btrim(coalesce(d ->> 'email', '')), 160));
  bd_text text := btrim(coalesce(d ->> 'fecha_nacimiento', ''));
  bd date;
  civil text := btrim(coalesce(d ->> 'estado_civil', ''));
  v_rfc text := upper(btrim(coalesce(d ->> 'rfc', '')));
  v_curp text := upper(btrim(coalesce(d ->> 'curp', '')));
  buyer boolean;
  seller boolean;
  new_id uuid;
  headers json;
  ip text;
  agent text;
begin
  perform enforce_public_rate_limit('client_intake', 10, 100);

  select * into l from client_intake_links where token = p_token for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'invalido'); end if;
  if l.revoked_at is not null then return jsonb_build_object('ok', false, 'error', 'revocado'); end if;
  if l.submitted_at is not null then return jsonb_build_object('ok', false, 'error', 'usado'); end if;
  if now() > l.expires_at then return jsonb_build_object('ok', false, 'error', 'expirado'); end if;

  if coalesce(btrim(p_consent_version), '') = '' then return jsonb_build_object('ok', false, 'error', 'consent_required'); end if;
  if char_length(nm) < 3 then return jsonb_build_object('ok', false, 'error', 'name_required'); end if;
  if char_length(regexp_replace(ph, '\D', '', 'g')) < 10 then return jsonb_build_object('ok', false, 'error', 'phone_invalid'); end if;
  if em <> '' and em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then return jsonb_build_object('ok', false, 'error', 'email_invalid'); end if;
  if v_rfc <> '' and v_rfc !~ '^[A-ZÑ&]{4}[0-9]{6}[A-Z0-9]{3}$' then return jsonb_build_object('ok', false, 'error', 'rfc_invalid'); end if;
  if v_curp <> '' and v_curp !~ '^[A-Z]{4}[0-9]{6}[HM][A-Z]{5}[A-Z0-9]{2}$' then return jsonb_build_object('ok', false, 'error', 'curp_invalid'); end if;
  if civil <> '' and civil not in ('Soltero', 'Casado', 'Divorciado', 'Viudo', 'Unión libre') then return jsonb_build_object('ok', false, 'error', 'civil_invalid'); end if;
  if bd_text <> '' then
    begin
      bd := bd_text::date;
    exception when others then
      return jsonb_build_object('ok', false, 'error', 'date_invalid');
    end;
    if bd > current_date or bd < date '1900-01-01' then return jsonb_build_object('ok', false, 'error', 'date_invalid'); end if;
  end if;

  buyer := l.type <> 'vendedor';
  seller := l.type <> 'comprador';

  insert into clients (
    name, type, email, phone, notes, active,
    fecha_nacimiento, estado_civil, domicilio, rfc, curp, identificacion_oficial,
    nss, razon_social, registro_patronal, tel_empresa,
    referencia1_nombre, referencia1_telefono, referencia1_correo, referencia1_direccion,
    referencia2_nombre, referencia2_telefono, referencia2_correo, referencia2_direccion,
    numero_credito
  ) values (
    nm, l.type, nullif(em, ''), ph,
    'Datos capturados por el cliente desde el enlace de registro' || case when l.label is null then '.' else ' («' || l.label || '»).' end,
    true,
    bd, nullif(civil, ''),
    nullif(left(btrim(coalesce(d ->> 'domicilio', '')), 300), ''),
    nullif(v_rfc, ''), nullif(v_curp, ''),
    nullif(left(btrim(coalesce(d ->> 'identificacion_oficial', '')), 60), ''),
    case when buyer then nullif(left(btrim(coalesce(d ->> 'nss', '')), 20), '') end,
    case when buyer then nullif(left(btrim(coalesce(d ->> 'razon_social', '')), 160), '') end,
    case when buyer then nullif(left(btrim(coalesce(d ->> 'registro_patronal', '')), 40), '') end,
    case when buyer then nullif(left(btrim(coalesce(d ->> 'tel_empresa', '')), 30), '') end,
    case when buyer then nullif(left(btrim(coalesce(d ->> 'referencia1_nombre', '')), 120), '') end,
    case when buyer then nullif(left(btrim(coalesce(d ->> 'referencia1_telefono', '')), 30), '') end,
    case when buyer then nullif(left(btrim(coalesce(d ->> 'referencia1_correo', '')), 160), '') end,
    case when buyer then nullif(left(btrim(coalesce(d ->> 'referencia1_direccion', '')), 300), '') end,
    case when buyer then nullif(left(btrim(coalesce(d ->> 'referencia2_nombre', '')), 120), '') end,
    case when buyer then nullif(left(btrim(coalesce(d ->> 'referencia2_telefono', '')), 30), '') end,
    case when buyer then nullif(left(btrim(coalesce(d ->> 'referencia2_correo', '')), 160), '') end,
    case when buyer then nullif(left(btrim(coalesce(d ->> 'referencia2_direccion', '')), 300), '') end,
    case when seller then nullif(left(btrim(coalesce(d ->> 'numero_credito', '')), 40), '') end
  ) returning id into new_id;

  update client_intake_links set submitted_at = now(), client_id = new_id where id = l.id;

  headers := nullif(current_setting('request.headers', true), '')::json;
  ip := nullif(trim(split_part(coalesce(headers ->> 'x-forwarded-for', headers ->> 'cf-connecting-ip', ''), ',', 1)), '');
  agent := left(coalesce(headers ->> 'user-agent', ''), 300);
  insert into privacy_consents (client_id, intake_link_id, consent_version, accepted_ip, accepted_agent)
  values (new_id, l.id, p_consent_version, ip, agent);

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function client_intake_submit(text, jsonb, text) from public;
grant execute on function client_intake_submit(text, jsonb, text) to anon, authenticated;
