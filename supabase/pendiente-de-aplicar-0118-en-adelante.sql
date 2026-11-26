-- ─────────────────────────────────────────────
-- SQL PENDIENTE DE APLICAR en Supabase — migraciones 0118 a 0130 (13 archivos), todo junto.
-- Pégalo COMPLETO en el SQL Editor y ejecútalo UNA vez. Cada bloque es re-ejecutable y van en orden: lo que ya exista se respeta.
-- Al final anota las migraciones como aplicadas y devuelve la cuenta. Se genera con `npm run sql:pendiente`; no lo edites a mano.
-- ─────────────────────────────────────────────


-- ─────────────────────────────────────────────
-- Seguridad: lectura pública mínima, correo del staff y límites por IP
-- (auditoría, puntos 101–104 y 112; bloque re-ejecutable)
-- ─────────────────────────────────────────────
-- ORDEN DE DESPLIEGUE: primero publicar el sitio (ya pide solo columnas públicas de asesores y lee el
-- contacto del equipo / de una selección por función) y después correr este bloque. Al revés, el sitio
-- viejo pide `advisors(*)` y la base le negaría las columnas privadas.

-- 102: la API pública ya no devuelve propiedades desactivadas (borradores). El personal con sesión sigue
-- viéndolas todas, igual que antes: su vista previa de un borrador y las pantallas del panel no cambian.
drop policy if exists "Public can read active properties" on properties;
create policy "Public can read active properties" on properties for select
  using (active = true or auth.role() = 'authenticated');

drop policy if exists "Public can read property_advisors" on property_advisors;
create policy "Public can read property_advisors" on property_advisors for select
  using (
    auth.role() = 'authenticated'
    or exists (select 1 from properties p where p.id = property_advisors.property_id and p.active = true)
  );

-- 103: de los asesores, el público solo lee los activos y solo nombre, foto y puesto. Teléfono, correo y
-- WhatsApp salen únicamente por las funciones de abajo: los del equipo publicado en /nosotros
-- (show_in_team) y el del asesor que mandó una selección, a quien tenga el enlace.
drop policy if exists "Public can read active advisors" on advisors;
create policy "Public can read active advisors" on advisors for select
  using (active = true or auth.role() = 'authenticated');

revoke select on advisors from anon;
grant select (id, name, photo_url, bio, active, show_in_team, created_at) on advisors to anon;

create or replace function team_advisors()
returns table (id uuid, name text, photo_url text, bio text, phone text, email text, whatsapp text)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, a.name, a.photo_url, a.bio, a.phone, a.email, a.whatsapp
  from advisors a
  where a.active = true and a.show_in_team = true
  order by a.name;
$$;

revoke all on function team_advisors() from public;
grant execute on function team_advisors() to anon, authenticated;

-- Responde también con la selección vencida o retirada: la página pública le muestra al cliente a quién escribirle
-- para pedir otra (igual que antes, cuando leía la fila del asesor directo). Lo único que da acceso es el token.
create or replace function selection_advisor(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select to_jsonb(x)
  from (
    select a.id, a.name, a.photo_url, a.phone, a.whatsapp
    from property_selections s
    join advisors a on a.id = s.advisor_id
    where p_token ~ '^[0-9a-f]{32}$'
      and s.token = p_token
      and a.active = true
  ) x;
$$;

revoke all on function selection_advisor(text) from public;
grant execute on function selection_advisor(text) to anon, authenticated;

-- 104: el tope del chat también por IP (guardada como huella, no en claro), para que rotar el id de sesión
-- del navegador no baste para agotar el cupo diario de todos.
alter table chat_rate_limits add column if not exists ip_hash text;
create index if not exists idx_chat_rate_limits_ip on chat_rate_limits(ip_hash, created_at desc);

-- 101: registro de correos mandados desde el panel (Edge Function enviar-correo), para limitar por hora y
-- poder auditar. Sin políticas: solo la service role (la función) la lee y escribe.
create table if not exists email_send_log (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  to_email text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_email_send_log_user on email_send_log(user_email, created_at desc);
alter table email_send_log enable row level security;

-- 112: las cubetas públicas aceptan solo imágenes y con tope de tamaño (las privadas ya lo tenían). Solo
-- aplica a subidas nuevas; lo ya guardado no se toca.
update storage.buckets
set file_size_limit = 15728640,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
where id in ('property-images', 'advisor-photos', 'blog-images');

update storage.buckets
set file_size_limit = 31457280,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'property-360';


-- ─────────────────────────────────────────────
-- Plantilla membretada solo para roles con acceso (2026-11-25)
-- La hoja membretada (logotipo, marca de agua y pie) con la que se arman los PDF deja de ser un archivo público: ahora la entrega
-- /api/plantilla únicamente a quien tenga sesión y el apartado `membrete` en su rol. No hay tabla nueva: solo se agrega el apartado.
-- Se le da al rol Administrador; para los asesores se activa desde Roles y accesos (casilla «Plantilla membretada»). Quien no la
-- tenga sigue generando sus PDF, pero sobre una hoja en blanco.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

update admin_roles
set sections = array_append(sections, 'membrete')
where slug = 'admin' and not ('membrete' = any(sections));


-- ─────────────────────────────────────────────
-- Ubicación aproximada por propiedad (2026-11-25)
-- Para una casa vacía o de un vendedor que no quiere que su dirección exacta circule, el mapa público muestra solo una zona
-- (círculo de 500 m) en vez del punto. Ocultarlo en la pantalla no bastaría: la API pública devolvería las coordenadas exactas.
-- Por eso, con `location_approximate`:
-- · `properties.lat/lng` (lo único que lee el público) guardan una coordenada DIFUMINADA, desplazada hasta ~350 m de forma estable
--   (depende del id de la propiedad, así que guardar de nuevo no cambia el punto y no se puede promediar volviendo a pedirla);
-- · las coordenadas EXACTAS viven en `property_exact_location`, que solo leen y escriben los roles con Propiedades o Naves.
-- El formulario del panel sigue mostrando y guardando las exactas: un disparador las separa. Una propiedad sin la casilla se
-- queda igual que siempre. El texto de «Dirección» sí se publica tal cual: en estas propiedades conviene capturar solo la colonia.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

alter table properties add column if not exists location_approximate boolean not null default false;

create table if not exists property_exact_location (
  property_id uuid primary key references properties(id) on delete cascade deferrable initially deferred,
  lat double precision not null,
  lng double precision not null,
  updated_at timestamptz not null default now()
);

alter table property_exact_location enable row level security;

drop policy if exists "Rol con apartado propiedades o naves_industriales maneja property_exact_location" on property_exact_location;
create policy "Rol con apartado propiedades o naves_industriales maneja property_exact_location" on property_exact_location for all
  using (has_admin_section('propiedades') or has_admin_section('naves_industriales'))
  with check (has_admin_section('propiedades') or has_admin_section('naves_industriales'));

-- Coordenada difuminada, estable por propiedad: hasta ±250 m en latitud y en longitud (≈ 350 m en diagonal).
create or replace function blur_coordinates(p_id uuid, p_lat double precision, p_lng double precision)
returns double precision[]
language sql
immutable
set search_path = public
as $$
  select array[
    p_lat + ((('x' || substr(md5(p_id::text || 'lat'), 1, 8))::bit(32)::bigint)::double precision / 4294967295.0 - 0.5) * 2 * 0.00225,
    p_lng + ((('x' || substr(md5(p_id::text || 'lng'), 1, 8))::bit(32)::bigint)::double precision / 4294967295.0 - 0.5) * 2 * 0.00225
      / greatest(cos(radians(p_lat)), 0.2)
  ];
$$;

create or replace function properties_split_location()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  coords_changed boolean;
  was_approximate boolean := tg_op = 'UPDATE' and old.location_approximate;
  blurred double precision[];
  exact_row property_exact_location%rowtype;
begin
  coords_changed := tg_op = 'INSERT' or new.lat is distinct from old.lat or new.lng is distinct from old.lng;

  if new.location_approximate then
    -- Se parte de las coordenadas exactas cuando son nuevas (alta, cambio en el formulario) o cuando recién se activa la casilla.
    -- Si ya era aproximada y las coordenadas no cambiaron, lo guardado es el punto difuminado: no se toca nada.
    if coords_changed or not was_approximate then
      insert into property_exact_location (property_id, lat, lng) values (new.id, new.lat, new.lng)
      on conflict (property_id) do update set lat = excluded.lat, lng = excluded.lng, updated_at = now();
      blurred := blur_coordinates(new.id, new.lat, new.lng);
      new.lat := blurred[1];
      new.lng := blurred[2];
    end if;
  elsif was_approximate then
    -- Se apaga la casilla: si no mandaron coordenadas nuevas, se recuperan las exactas guardadas.
    if not coords_changed then
      select * into exact_row from property_exact_location where property_id = new.id;
      if found then
        new.lat := exact_row.lat;
        new.lng := exact_row.lng;
      end if;
    end if;
    delete from property_exact_location where property_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_properties_split_location on properties;
create trigger trg_properties_split_location
before insert or update of lat, lng, location_approximate on properties
for each row execute function properties_split_location();


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


-- ─────────────────────────────────────────────
-- Un secreto distinto por función programada (2026-11-25)
-- Las 12 funciones de Edge que dispara la base (pg_cron y los triggers vía pg_net) compartían UN secreto en el encabezado
-- `x-cron-secret`: si se filtraba el de una llamada, servía para disparar cualquiera. Ahora cada función recibe el suyo, derivado del
-- secreto maestro (Vault `agenda_cron_secret`, que sigue siendo el mismo CRON_SECRET de las funciones):
--     secreto de la función = HMAC-SHA256(llave = secreto maestro, mensaje = nombre de la función), en hexadecimal.
-- El maestro ya no viaja en ninguna llamada y el de una función no sirve para otra. No hay secretos nuevos que sembrar.
-- · cron_secret_for('<función>') calcula ese valor (solo lo ejecutan los roles internos de la base, nunca el público).
-- · Los trabajos de pg_cron y las funciones de trigger que mandaban el secreto maestro se reescriben para mandar el de su función. Se
--   toma el nombre de la función de la propia URL (`/functions/v1/<nombre>`); lo que no tenga exactamente una, no se toca.
-- · Las funciones de Edge aceptan los dos secretos mientras CRON_ACCEPT_SHARED_SECRET no valga «false» (ver
--   supabase/functions/_shared/cronAuth.js): desplegar primero las funciones, aplicar esta migración y, cuando todo funcione, apagar
--   la transición con `supabase secrets set CRON_ACCEPT_SHARED_SECRET=false`.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

create or replace function cron_secret_for(p_function text)
returns text
language sql
stable
security definer
set search_path = public, extensions
as $$
  select encode(extensions.hmac(convert_to(p_function, 'UTF8'), convert_to(s.decrypted_secret, 'UTF8'), 'sha256'), 'hex')
  from vault.decrypted_secrets s
  where s.name = 'agenda_cron_secret';
$$;

revoke all on function cron_secret_for(text) from public, anon, authenticated;

do $$
declare
  shared constant text := '(select decrypted_secret from vault.decrypted_secrets where name = ''agenda_cron_secret'')';
  f record;
  j record;
  fns text[];
begin
  -- Funciones de trigger (aviso de mensajes, de prospectos sin atender, de visitas, del portal, del registro…).
  for f in
    select p.oid, pg_get_functiondef(p.oid) as def
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f' and p.prosrc like '%agenda_cron_secret%'
  loop
    select array_agg(distinct m[1]) into fns from regexp_matches(f.def, '/functions/v1/([a-z0-9-]+)', 'g') as m;
    if fns is not null and cardinality(fns) = 1 and position(shared in f.def) > 0 then
      execute replace(f.def, shared, format('cron_secret_for(%L)', fns[1]));
    end if;
  end loop;

  -- Trabajos programados de pg_cron.
  for j in select jobname, schedule, command from cron.job where jobname is not null and command like '%agenda_cron_secret%' loop
    select array_agg(distinct m[1]) into fns from regexp_matches(j.command, '/functions/v1/([a-z0-9-]+)', 'g') as m;
    if fns is not null and cardinality(fns) = 1 and position(shared in j.command) > 0 then
      perform cron.schedule(j.jobname, j.schedule, replace(j.command, shared, format('cron_secret_for(%L)', fns[1])));
    end if;
  end loop;
end $$;


-- ─────────────────────────────────────────────
-- La papelería de los clientes dura 3 años (2026-11-25)
-- Regla del negocio: los documentos de un cliente (INE, CURP, comprobantes, constancia fiscal, acta, expedientes de avalúo) se
-- conservan 3 años y después se depuran. Los 3 años se cuentan desde la ÚLTIMA ACTIVIDAD con ese cliente: lo más reciente entre
-- que se dio de alta o se editó, el último documento capturado, el último movimiento de su trámite y su última cita en la Agenda.
-- Mientras haya actividad la papelería no vence; un cliente que lleva 3 años sin movimiento sí.
-- · papeleria_retention(): el plazo (3 años) en un solo lugar.
-- · papeleria_vencida(): los documentos que ya cumplieron el plazo (solo la service role y quien tiene el apartado Roles).
-- · papeleria_resumen(): cuántos hay y qué pasó en la última corrida (para la tarjeta de Roles y accesos).
-- · retention_purge_log: bitácora de cada corrida de la depuración.
-- · La función de Edge `depurar-papeleria` corre el día 1 de cada mes (pg_cron). POR OMISIÓN ES UN SIMULACRO: solo cuenta y registra lo
--   que borraría. Borra de verdad únicamente con `supabase secrets set RETENTION_PURGE_ENABLED=true`.
-- No se borra nada más que archivos y filas de documentos; el cliente, sus ventas y su historial no se tocan.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

create or replace function papeleria_retention()
returns interval
language sql
immutable
as $$ select interval '3 years' $$;

create table if not exists retention_purge_log (
  id uuid primary key default gen_random_uuid(),
  ran_at timestamptz not null default now(),
  dry_run boolean not null,
  documents_due integer not null default 0,
  documents_deleted integer not null default 0,
  files_failed integer not null default 0,
  detail jsonb
);

alter table retention_purge_log enable row level security;

drop policy if exists "Rol con apartado roles lee retention_purge_log" on retention_purge_log;
create policy "Rol con apartado roles lee retention_purge_log" on retention_purge_log for select
  using (has_admin_section('roles'));

-- Última actividad con un cliente.
create or replace function _client_last_activity(p_client_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select greatest(
    c.created_at,
    c.updated_at,
    (select max(d.captured_at) from client_documents d where d.client_id = c.id),
    (select t.updated_at from client_tramites t where t.client_id = c.id),
    (select max(a.fecha)::timestamptz from agenda_citas a where a.client_id = c.id)
  )
  from clients c
  where c.id = p_client_id;
$$;

revoke all on function _client_last_activity(uuid) from public, anon, authenticated;

create or replace function papeleria_vencida()
returns table (kind text, id uuid, client_id uuid, bucket text, file_path text, last_activity timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), current_user) not in ('service_role', 'postgres') and not has_admin_section('roles') then
    raise exception 'Sin acceso' using errcode = '42501';
  end if;

  return query
  select 'documento'::text, d.id, d.client_id, 'client-documents'::text, d.file_path, _client_last_activity(d.client_id)
  from client_documents d
  where _client_last_activity(d.client_id) < now() - papeleria_retention()
  union all
  -- Expedientes de avalúo de la Agenda: con cliente, cuenta su actividad; sin cliente, la fecha de la cita (o de la subida).
  select 'expediente'::text, e.id, a.client_id, 'agenda-expedientes'::text, e.file_path,
         case when a.client_id is not null then greatest(_client_last_activity(a.client_id), a.fecha::timestamptz) else greatest(e.created_at, a.fecha::timestamptz) end
  from agenda_expedientes e
  join agenda_citas a on a.id = e.cita_id
  where case when a.client_id is not null then greatest(_client_last_activity(a.client_id), a.fecha::timestamptz) else greatest(e.created_at, a.fecha::timestamptz) end
        < now() - papeleria_retention();
end;
$$;

revoke all on function papeleria_vencida() from public, anon;
grant execute on function papeleria_vencida() to authenticated, service_role;

create or replace function papeleria_resumen()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  due record;
  last_run retention_purge_log;
begin
  if not has_admin_section('roles') then
    raise exception 'Sin acceso' using errcode = '42501';
  end if;
  select count(*) as documents, count(distinct v.client_id) as clients, min(v.last_activity) as oldest into due from papeleria_vencida() v;
  select * into last_run from retention_purge_log order by ran_at desc limit 1;
  return jsonb_build_object(
    'retention_years', 3,
    'documents', due.documents,
    'clients', due.clients,
    'oldest_activity', due.oldest,
    'last_run', case when last_run.id is null then null else jsonb_build_object(
      'ran_at', last_run.ran_at, 'dry_run', last_run.dry_run, 'documents_due', last_run.documents_due,
      'documents_deleted', last_run.documents_deleted, 'files_failed', last_run.files_failed) end
  );
end;
$$;

revoke all on function papeleria_resumen() from public, anon;
grant execute on function papeleria_resumen() to authenticated;

-- Corrida mensual (día 1, 09:00 UTC). El secreto es el de SU función (migración 0122).
select cron.schedule(
  'depurar-papeleria',
  '0 9 1 * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/depurar-papeleria',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key'),
      'x-cron-secret', cron_secret_for('depurar-papeleria')
    ),
    body := '{}'::jsonb
  );
  $$
);


-- ─────────────────────────────────────────────
-- Vistas por IP, límites de tamaño en mensajes, novedades sin la llave maestra y conteos sin vendidas (2026-11-26)
-- · record_property_view contaba cualquier visitor_id inventado: con un script se inflaba el «N personas la vieron» y las vistas del
--   informe al vendedor. Ahora cada vista nueva guarda la huella de la IP (sin la IP) y una misma IP no puede sumar más de 40 vistas
--   nuevas por hora. Lo que pase del tope simplemente no se anota (la ficha sigue funcionando y devuelve el conteo).
-- · contact_messages aceptaba nombre, mensaje y `details` de cualquier tamaño y un `channel` cualquiera de quien llamara a la API: un bot
--   podía guardar megabytes por envío. Límites: nombre 200, correo 254, teléfono 40, mensaje 5,000 caracteres, `details` 16 KB y channel
--   en minúsculas/guion bajo de hasta 30. Es NOT VALID a propósito: vale para lo que se escriba de ahora en adelante, no revisa lo viejo.
-- · El flujo de GitHub «Novedades» guardaba la llave service_role (acceso total a la base) solo para insertar una fila. Ahora llama a
--   registrar_novedad(token, …), que solo inserta en site_updates y solo con el secreto `novedades_token` de Vault (ver
--   .github/workflows/log-site-update.yml). Una filtración de ese token ya no abre la base: lo máximo es escribir una novedad.
-- · public_type_counts (conteos del inicio y del menú) contaba también las propiedades vendidas como si estuvieran a la venta.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

-- ── Vistas por IP ──
alter table property_views add column if not exists ip_hash text;
create index if not exists idx_property_views_ip on property_views(ip_hash, created_at desc);

create or replace function record_property_view(p_property_id uuid, p_visitor_id uuid, p_days int default 3)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ip text := request_client_ip();
  v_hash text := case when v_ip is null then null else md5('acl-views:' || v_ip) end;
begin
  if v_hash is null
     or (select count(*) from property_views where ip_hash = v_hash and created_at > now() - interval '1 hour') < 40 then
    insert into property_views (property_id, visitor_id, ip_hash)
    values (p_property_id, p_visitor_id, v_hash)
    on conflict (property_id, visitor_id, viewed_on) do nothing;
  end if;

  return (
    select count(distinct visitor_id)
    from property_views
    where property_id = p_property_id
      and viewed_on > current_date - p_days
  );
end;
$$;

revoke all on function record_property_view(uuid, uuid, int) from public;
grant execute on function record_property_view(uuid, uuid, int) to anon, authenticated;

-- ── Límites de tamaño en contact_messages ──
alter table contact_messages drop constraint if exists contact_messages_limits;
alter table contact_messages add constraint contact_messages_limits check (
  char_length(name) <= 200
  and char_length(email) <= 254
  and char_length(coalesce(phone, '')) <= 40
  and char_length(message) <= 5000
  and (details is null or pg_column_size(details) <= 16384)
  and channel ~ '^[a-z_]{1,30}$'
) not valid;

-- ── Novedades sin la llave maestra ──
-- Para activarlo: guardar en Vault un secreto largo y aleatorio llamado `novedades_token` (select vault.create_secret('<token>', 'novedades_token');)
-- y poner el mismo valor en el secreto NOVEDADES_TOKEN del repositorio de GitHub.
create or replace function registrar_novedad(p_token text, p_title text, p_body text, p_author text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  expected text;
begin
  select decrypted_secret into expected from vault.decrypted_secrets where name = 'novedades_token';
  if expected is null or length(expected) < 20 or p_token is null or p_token <> expected then
    return jsonb_build_object('error', 'unauthorized');
  end if;
  if nullif(trim(coalesce(p_title, '')), '') is null or nullif(trim(coalesce(p_body, '')), '') is null then
    return jsonb_build_object('error', 'invalid');
  end if;
  insert into site_updates (title, body, created_by)
  values (left(trim(p_title), 300), left(trim(p_body), 10000), left(nullif(trim(coalesce(p_author, '')), ''), 100));
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function registrar_novedad(text, text, text, text) from public;
grant execute on function registrar_novedad(text, text, text, text) to anon, authenticated;

-- ── Conteos del inicio y del menú sin las vendidas ──
create or replace function public_type_counts()
returns jsonb
language sql
stable
as $$
  select coalesce(jsonb_object_agg(type, n), '{}'::jsonb)
  from (select type, count(*)::int as n from properties where active and status <> 'vendida' group by type) t;
$$;

revoke all on function public_type_counts() from public;
grant execute on function public_type_counts() to anon, authenticated;

-- ─────────────────────────────────────────────
-- Derechos ARCO: consultar y borrar los datos de una persona (2026-11-25)
-- La ley mexicana (LFPDPPP) da a cada persona el derecho de Acceso, Rectificación, Cancelación y Oposición sobre sus datos. Hasta
-- hoy atender una solicitud era buscar a mano en 6 pantallas. Esta migración deja una herramienta para quien tenga el apartado `arco`
-- (se le da al rol Administrador; a otros roles desde Roles y accesos). La persona se identifica por teléfono (10 dígitos) o por
-- correo completo — nunca por nombre, para no mezclar a dos personas distintas.
--
-- · arco_buscar(consulta, registrar): ACCESO. Junta todo lo que hay de esa persona en mensajes de contacto, prospectos, alertas,
--   apartados, citas, visitas y clientes. Con `registrar = true` deja constancia (sin guardar el dato en claro).
-- · arco_cancelar(consulta, confirmar): CANCELACIÓN. Borra mensajes, prospectos (con sus etapas y contactos) y alertas; en citas,
--   visitas y apartados deja el registro pero quita nombre, teléfono y correo. NO toca a los CLIENTES: sus documentos se conservan
--   3 años por obligación (ver 0123) y se avisan como «retenidos». También quita el nombre del registro de actividad.
-- · arco_requests: constancia de cada solicitud atendida (qué tipo, cuándo, quién y cuántos registros), con la identificación
--   guardada solo como huella SHA-256. Rectificación y Oposición se atienden con las pantallas normales (editar / quitar la alerta).
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

update admin_roles
set sections = array_append(sections, 'arco')
where slug = 'admin' and not ('arco' = any(sections));

create table if not exists arco_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('acceso', 'cancelacion')),
  subject_hash text not null,
  performed_by text,
  result jsonb not null default '{}'::jsonb
);

alter table arco_requests enable row level security;
revoke all on arco_requests from anon, authenticated;
grant select on arco_requests to authenticated;
drop policy if exists "Roles con apartado arco ven las solicitudes" on arco_requests;
create policy "Roles con apartado arco ven las solicitudes" on arco_requests for select to authenticated
  using (has_admin_section('arco'));

-- Una sola identificación: correo completo o teléfono con al menos 10 dígitos (se comparan los últimos 10).
create or replace function arco_parse(p_query text, out o_email text, out o_phone text)
language plpgsql
immutable
as $$
declare
  q text := btrim(coalesce(p_query, ''));
  digits text;
begin
  if q ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    o_email := lower(q);
  else
    digits := regexp_replace(q, '\D', '', 'g');
    if length(digits) >= 10 then
      o_phone := right(digits, 10);
    else
      raise exception 'Escribe el correo completo o el teléfono a 10 dígitos de la persona' using errcode = '22023';
    end if;
  end if;
end;
$$;

-- Condición SQL «esta fila es de esa persona» para una tabla con columnas de correo y/o teléfono.
create or replace function arco_cond(p_ecol text, p_pcol text, p_email text, p_phone text)
returns text
language sql
immutable
as $$
  select coalesce(nullif(concat_ws(' or ',
    case when p_ecol is not null and p_email is not null then format('lower(btrim(%I)) = %L', p_ecol, p_email) end,
    case when p_pcol is not null and p_phone is not null
      then format('right(regexp_replace(coalesce(%I, ''''), ''\D'', '''', ''g''), 10) = %L', p_pcol, p_phone) end
  ), ''), 'false')
$$;

-- Las fuentes de datos personales: tabla, columna de correo, de teléfono, qué hacer al cancelar y, si se anonimiza, qué columnas.
create or replace function arco_sources()
returns table (tbl text, ecol text, pcol text, act text, scrub text)
language sql
immutable
as $$
  select * from (values
    ('agenda_citas',      'contact_email', 'contact_phone', 'scrub',    'contact_name = null, contact_phone = null, contact_email = null'),
    ('property_visits',   null,            'prospect_phone', 'scrub',   'prospect_name = null, prospect_phone = null'),
    ('property_holds',    null,            'buyer_phone',   'scrub',    'buyer_name = ''Anonimizado'', buyer_phone = null'),
    ('contact_messages',  'email',         'phone',         'delete',   null),
    ('prospectos',        'email',         'phone',         'delete',   null),
    ('property_alerts',   'email',         'phone',         'delete',   null),
    ('clients',           'email',         'phone',         'retain',   null)
  ) as s(tbl, ecol, pcol, act, scrub)
$$;

create or replace function arco_guard()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), current_user) not in ('service_role', 'postgres') and not has_admin_section('arco') then
    raise exception 'No tienes acceso a esta herramienta' using errcode = '42501';
  end if;
end;
$$;

create or replace function arco_actor()
returns text
language sql
stable
as $$ select coalesce(nullif(auth.jwt() ->> 'email', ''), current_user) $$;

create or replace function arco_buscar(p_query text, p_registrar boolean default false)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  e text;
  p text;
  s record;
  cond text;
  rows_json jsonb;
  result jsonb := '{}'::jsonb;
  counts jsonb := '{}'::jsonb;
begin
  perform arco_guard();
  select o_email, o_phone into e, p from arco_parse(p_query);

  for s in select * from arco_sources() loop
    cond := arco_cond(s.ecol, s.pcol, e, p);
    if s.tbl = 'agenda_citas' then
      cond := cond
        || format(' or prospecto_id in (select id from prospectos where %s)', arco_cond('email', 'phone', e, p))
        || format(' or message_id in (select id from contact_messages where %s)', arco_cond('email', 'phone', e, p));
    end if;
    -- A los clientes nunca se les exporta la contraseña del portal ni el NSS: son del cliente, no se reparten por esta vía.
    execute format(
      'select coalesce(jsonb_agg(to_jsonb(t) %s), ''[]''::jsonb) from %I t where %s',
      case when s.tbl = 'clients' then '- ''contrasena_portal'' - ''nss''' else '' end, s.tbl, cond
    ) into rows_json;
    result := result || jsonb_build_object(s.tbl, jsonb_build_object('accion', s.act, 'filas', rows_json));
    counts := counts || jsonb_build_object(s.tbl, jsonb_array_length(rows_json));
  end loop;

  if p_registrar then
    insert into arco_requests (kind, subject_hash, performed_by, result)
    values ('acceso', encode(sha256(convert_to(coalesce(e, p), 'utf8')), 'hex'), arco_actor(), counts);
  end if;
  return result;
end;
$$;

create or replace function arco_cancelar(p_query text, p_confirmar boolean default false)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  e text;
  p text;
  s record;
  cond text;
  ids text[];
  counts jsonb := '{}'::jsonb;
begin
  perform arco_guard();
  if p_confirmar is not true then
    raise exception 'Falta confirmar la cancelación' using errcode = '22023';
  end if;
  select o_email, o_phone into e, p from arco_parse(p_query);

  -- Primero lo que cuelga de otras filas (citas), después las filas que se borran, para poder seguir el enlace a su dueño.
  for s in select * from arco_sources() loop
    cond := arco_cond(s.ecol, s.pcol, e, p);
    if s.tbl = 'agenda_citas' then
      cond := cond
        || format(' or prospecto_id in (select id from prospectos where %s)', arco_cond('email', 'phone', e, p))
        || format(' or message_id in (select id from contact_messages where %s)', arco_cond('email', 'phone', e, p));
    end if;

    if s.act = 'delete' then
      execute format('with d as (delete from %I where %s returning id) select coalesce(array_agg(id::text), ''{}'') from d', s.tbl, cond) into ids;
    elsif s.act = 'scrub' then
      execute format('with u as (update %I set %s where %s returning id) select coalesce(array_agg(id::text), ''{}'') from u', s.tbl, s.scrub, cond) into ids;
    else
      execute format('select coalesce(array_agg(id::text), ''{}'') from %I where %s', s.tbl, cond) into ids;
    end if;

    counts := counts || jsonb_build_object(case when s.act = 'retain' then 'retenidos' else s.tbl end, coalesce(array_length(ids, 1), 0));
    -- El registro de actividad guarda el nombre de la persona como etiqueta: se quita de las filas que acabamos de borrar o anonimizar.
    if s.act <> 'retain' and coalesce(array_length(ids, 1), 0) > 0 then
      update audit_log set label = null where table_name = s.tbl and row_id = any(ids);
    end if;
  end loop;

  insert into arco_requests (kind, subject_hash, performed_by, result)
  values ('cancelacion', encode(sha256(convert_to(coalesce(e, p), 'utf8')), 'hex'), arco_actor(), counts);
  return counts;
end;
$$;

revoke execute on function arco_parse(text), arco_cond(text, text, text, text), arco_sources(), arco_guard(), arco_actor() from public, anon, authenticated;
revoke execute on function arco_buscar(text, boolean), arco_cancelar(text, boolean) from public, anon;
grant execute on function arco_buscar(text, boolean), arco_cancelar(text, boolean) to authenticated;

-- ─────────────────────────────────────────────
-- Estatus «rentada» para las propiedades en renta (2026-11-26)
-- Una propiedad rentada solo podía marcarse «vendida», y eso la metía en las cifras de ventas. Ahora hay un estatus propio:
-- · `rentada` se agrega a los estatus permitidos. NO cuenta como venta (ventas y «vendidas en N días» siguen siendo solo `vendida`).
-- · Como una vendida, ya no se ofrece en el listado por omisión, no cuenta como «disponible» en el inicio y el menú, y no se puede
--   pedir ni agendar visita (book_visit, request_visit y get_visit_slots la rechazan igual que a una vendida).
-- «En pausa» y «retirada» no necesitan estatus: se desactiva la propiedad (casilla «Activa») y deja de verse en el sitio.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

alter table properties drop constraint if exists properties_status_check;
alter table properties add constraint properties_status_check check (status in ('disponible', 'apartada', 'vendida', 'rentada'));

create or replace function public_type_counts()
returns jsonb
language sql
stable
as $$
  select coalesce(jsonb_object_agg(type, n), '{}'::jsonb)
  from (select type, count(*)::int as n from properties where active and status in ('disponible', 'apartada') group by type) t;
$$;

CREATE OR REPLACE FUNCTION public.book_visit(p_property_id uuid, p_fecha date, p_hora time without time zone, p_name text, p_email text, p_phone text, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  now_mx timestamp := (now() at time zone 'America/Mexico_City');
  headers json;
  client_ip text;
  digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  prop properties;
  candidate record;
  chosen uuid;
  chosen_adv advisors;
  free boolean;
  msg_id uuid;
  prospect_id uuid;
  cita agenda_citas;
  label text;
  fecha_txt text;
begin
  if coalesce(trim(p_name), '') = '' or length(trim(p_name)) > 120 then return jsonb_build_object('error', 'invalid_name'); end if;
  if coalesce(trim(p_email), '') !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then return jsonb_build_object('error', 'invalid_email'); end if;
  if length(digits) < 10 or length(digits) > 15 then return jsonb_build_object('error', 'invalid_phone'); end if;
  if length(coalesce(p_note, '')) > 500 then return jsonb_build_object('error', 'invalid_note'); end if;
  if p_fecha is null or p_hora is null then return jsonb_build_object('error', 'invalid_slot'); end if;

  select * into prop from properties where id = p_property_id;
  if not found or not prop.active or prop.status in ('vendida', 'rentada') then
    return jsonb_build_object('error', 'property_unavailable');
  end if;

  -- Límite de abuso: 5 intentos por teléfono y 10 por IP en la última hora, y
  -- máximo 2 visitas futuras activas por teléfono (últimos 10 dígitos).
  headers := nullif(current_setting('request.headers', true), '')::json;
  client_ip := nullif(trim(split_part(coalesce(headers ->> 'x-forwarded-for', headers ->> 'cf-connecting-ip', ''), ',', 1)), '');

  if (select count(*) from visit_booking_attempts where phone_digits = right(digits, 10) and created_at > now() - interval '1 hour') >= 5
     or (client_ip is not null and (select count(*) from visit_booking_attempts a where a.ip = client_ip and a.created_at > now() - interval '1 hour') >= 10) then
    return jsonb_build_object('error', 'rate_limited');
  end if;
  insert into visit_booking_attempts (phone_digits, ip) values (right(digits, 10), client_ip);

  if (
    select count(*) from agenda_citas c
    where c.source = 'sitio' and c.status in ('confirmada', 'solicitada') and c.fecha >= now_mx::date
      and right(regexp_replace(coalesce(c.contact_phone, ''), '\D', '', 'g'), 10) = right(digits, 10)
  ) >= 2 then
    return jsonb_build_object('error', 'too_many_active');
  end if;

  -- Candado por asesor y día, siempre en el mismo orden (sin interbloqueos):
  -- dos reservas del mismo horario se forman en fila y la segunda ya ve la primera.
  for candidate in
    select a.id from property_advisors pa join advisors a on a.id = pa.advisor_id and a.active
    where pa.property_id = p_property_id order by a.id
  loop
    perform pg_advisory_xact_lock(hashtextextended(candidate.id::text || p_fecha::text, 0));
  end loop;

  -- Entre los asesores libres a esa hora, el de menos citas ese día (empate: menor id).
  for candidate in
    select a.id from property_advisors pa join advisors a on a.id = pa.advisor_id and a.active
    where pa.property_id = p_property_id order by a.id
  loop
    select exists (select 1 from visit_free_slots(candidate.id, p_fecha, p_fecha) f where f.hora = p_hora) into free;
    if free then
      if chosen is null or
         (select count(*) from agenda_citas c where c.advisor_id = candidate.id and c.fecha = p_fecha and c.status <> 'cancelada')
         < (select count(*) from agenda_citas c where c.advisor_id = chosen and c.fecha = p_fecha and c.status <> 'cancelada') then
        chosen := candidate.id;
      end if;
    end if;
  end loop;

  if chosen is null then return jsonb_build_object('error', 'slot_unavailable'); end if;
  select * into chosen_adv from advisors where id = chosen;

  label := case when prop.code is not null then trim(prop.title) || ' (' || prop.code || ')' else trim(prop.title) end;
  fecha_txt := to_char(p_fecha, 'DD/MM/YYYY');

  insert into contact_messages (name, email, phone, message, property_id, channel, details)
  values (
    trim(p_name), trim(p_email), trim(p_phone),
    'Visita agendada — ' || label || E'.\nFecha: ' || fecha_txt || ' a las ' || to_char(p_hora, 'HH24:MI')
      || case when coalesce(trim(p_note), '') <> '' then E'\nNota: ' || trim(p_note) else '' end,
    p_property_id, 'visita',
    jsonb_build_object('fecha', p_fecha, 'hora', to_char(p_hora, 'HH24:MI'), 'advisor_id', chosen)
  )
  returning id into msg_id;

  -- Fase 6: quien reserva ya es un prospecto (interesado, con seguimiento al día siguiente de la visita);
  -- si ya hay uno abierto con ese teléfono o correo se actualiza en vez de duplicarlo.
  prospect_id := visit_promote_prospect(p_property_id, chosen, trim(p_name), trim(p_phone), trim(p_email), p_fecha, p_hora, msg_id, p_note);

  insert into agenda_citas (
    advisor_id, property_id, titulo, fecha, hora, duracion_min, actividades, lugar,
    status, source, booking_token, contact_name, contact_phone, contact_email, message_id, prospecto_id
  )
  values (
    chosen, p_property_id, 'Visita: ' || label, p_fecha, p_hora,
    (select slot_minutes from advisor_visit_settings where advisor_id = chosen),
    nullif(trim(coalesce(p_note, '')), ''), prop.address,
    'confirmada', 'sitio', replace(gen_random_uuid()::text, '-', ''),
    trim(p_name), trim(p_phone), trim(p_email), msg_id, prospect_id
  )
  returning * into cita;

  return jsonb_build_object(
    'ok', true,
    'token', cita.booking_token,
    'fecha', cita.fecha,
    'hora', to_char(cita.hora, 'HH24:MI'),
    'duracion_min', cita.duracion_min,
    'advisor', jsonb_build_object('id', chosen_adv.id, 'name', chosen_adv.name, 'phone', chosen_adv.phone, 'whatsapp', chosen_adv.whatsapp, 'photo_url', chosen_adv.photo_url),
    'property', jsonb_build_object('id', prop.id, 'title', prop.title, 'code', prop.code, 'address', prop.address)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_visit_slots(p_property_id uuid, p_from date DEFAULT NULL::date, p_days integer DEFAULT 14)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  prop properties;
  today date := (now() at time zone 'America/Mexico_City')::date;
  d_from date;
  d_to date;
  result jsonb;
begin
  select * into prop from properties where id = p_property_id;
  if not found or not prop.active or prop.status in ('vendida', 'rentada') then
    return jsonb_build_object('slots', '[]'::jsonb);
  end if;

  d_from := greatest(coalesce(p_from, today), today);
  d_to := d_from + greatest(least(coalesce(p_days, 14), 60), 1);

  select coalesce(jsonb_agg(jsonb_build_object('fecha', x.fecha, 'hora', to_char(x.hora, 'HH24:MI'), 'advisors', x.advisors) order by x.fecha, x.hora), '[]'::jsonb)
  into result
  from (
    select f.fecha, f.hora,
           jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'photo_url', a.photo_url) order by a.name, a.id) as advisors
    from property_advisors pa
    join advisors a on a.id = pa.advisor_id and a.active
    cross join lateral visit_free_slots(a.id, d_from, d_to) f
    where pa.property_id = p_property_id
    group by f.fecha, f.hora
  ) x;

  return jsonb_build_object('slots', result);
end;
$function$;

CREATE OR REPLACE FUNCTION public.request_visit(p_property_id uuid, p_fecha date, p_hora time without time zone, p_name text, p_email text, p_phone text, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  now_mx timestamp := (now() at time zone 'America/Mexico_City');
  headers json;
  client_ip text;
  digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  prop properties;
  msg_id uuid;
  prospect_id uuid;
  cita agenda_citas;
  label text;
begin
  if coalesce(trim(p_name), '') = '' or length(trim(p_name)) > 120 then return jsonb_build_object('error', 'invalid_name'); end if;
  if coalesce(trim(p_email), '') !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then return jsonb_build_object('error', 'invalid_email'); end if;
  if length(digits) < 10 or length(digits) > 15 then return jsonb_build_object('error', 'invalid_phone'); end if;
  if length(coalesce(p_note, '')) > 500 then return jsonb_build_object('error', 'invalid_note'); end if;
  if p_fecha is null or p_hora is null or (p_fecha + p_hora) < now_mx + interval '1 hour' or p_fecha > now_mx::date + 90 then
    return jsonb_build_object('error', 'invalid_slot');
  end if;

  select * into prop from properties where id = p_property_id;
  if not found or not prop.active or prop.status in ('vendida', 'rentada') then
    return jsonb_build_object('error', 'property_unavailable');
  end if;

  -- Mismo límite de abuso que book_visit: 5 intentos por teléfono y 10 por IP por hora.
  headers := nullif(current_setting('request.headers', true), '')::json;
  client_ip := nullif(trim(split_part(coalesce(headers ->> 'x-forwarded-for', headers ->> 'cf-connecting-ip', ''), ',', 1)), '');

  if (select count(*) from visit_booking_attempts where phone_digits = right(digits, 10) and created_at > now() - interval '1 hour') >= 5
     or (client_ip is not null and (select count(*) from visit_booking_attempts a where a.ip = client_ip and a.created_at > now() - interval '1 hour') >= 10) then
    return jsonb_build_object('error', 'rate_limited');
  end if;
  insert into visit_booking_attempts (phone_digits, ip) values (right(digits, 10), client_ip);

  if (
    select count(*) from agenda_citas c
    where c.source = 'sitio' and c.status in ('confirmada', 'solicitada') and c.fecha >= now_mx::date
      and right(regexp_replace(coalesce(c.contact_phone, ''), '\D', '', 'g'), 10) = right(digits, 10)
  ) >= 2 then
    return jsonb_build_object('error', 'too_many_active');
  end if;

  label := case when prop.code is not null then trim(prop.title) || ' (' || prop.code || ')' else trim(prop.title) end;

  insert into contact_messages (name, email, phone, message, property_id, channel, details)
  values (
    trim(p_name), trim(p_email), trim(p_phone),
    'Solicitud de visita sin asesor — ' || label || E'.\nFecha preferida: ' || to_char(p_fecha, 'DD/MM/YYYY') || ' a las ' || to_char(p_hora, 'HH24:MI')
      || case when coalesce(trim(p_note), '') <> '' then E'\nNota: ' || trim(p_note) else '' end
      || E'\nEstá en la Agenda de todos hasta que un asesor la tome.',
    p_property_id, 'visita_solicitud',
    jsonb_build_object('fecha', p_fecha, 'hora', to_char(p_hora, 'HH24:MI'), 'sin_asesor', true)
  )
  returning id into msg_id;

  prospect_id := visit_promote_prospect(p_property_id, null, trim(p_name), trim(p_phone), trim(p_email), p_fecha, p_hora, msg_id, p_note, true);

  insert into agenda_citas (
    advisor_id, property_id, titulo, fecha, hora, actividades, lugar,
    status, source, booking_token, contact_name, contact_phone, contact_email, message_id, prospecto_id
  )
  values (
    null, p_property_id, 'Visita: ' || label, p_fecha, p_hora,
    nullif(trim(coalesce(p_note, '')), ''), prop.address,
    'solicitada', 'sitio', replace(gen_random_uuid()::text, '-', ''),
    trim(p_name), trim(p_phone), trim(p_email), msg_id, prospect_id
  )
  returning * into cita;

  return jsonb_build_object(
    'ok', true,
    'token', cita.booking_token,
    'fecha', cita.fecha,
    'hora', to_char(cita.hora, 'HH24:MI'),
    'property', jsonb_build_object('id', prop.id, 'title', prop.title, 'code', prop.code, 'address', prop.address)
  );
end;
$function$;

-- ─────────────────────────────────────────────
-- Depuración de datos personales: chats, mensajes, prospectos y contratos (2026-11-26)
-- Reglas del negocio (decididas por el dueño):
--   · chats        1 semana   — chat_rate_limits: lo único que el chat guarda (sesión y huella de la IP; el texto de la conversación no se guarda).
--   · mensajes     1 semana   — contact_messages (los del formulario de contacto, atendidos o no).
--   · prospectos   1 mes      — prospectos, contado desde su ÚLTIMA ACTIVIDAD (alta, edición, contacto, cambio de etapa). Un prospecto con un
--                               seguimiento programado a futuro no vence mientras esa fecha no pase.
--   · contratos    6 meses    — signing_requests (documento enviado a firma, su firma, IP y huella), contados desde lo más reciente entre
--                               que se creó, se firmó o se selló.
-- Cada día corre `depurar_datos()` (pg_cron). Los chats se borran de una vez (es solo bitácora de límites); las otras tres reglas
-- ARRANCAN COMO SIMULACRO: cuentan y registran lo que borrarían, sin borrar. Se activan una por una desde la tarjeta «Depuración de
-- datos» de Roles y accesos (o con datos_activar) cuando se revisó el simulacro.
-- Al borrar se quita también el nombre del registro de actividad (audit_log). Las citas y visitas conservan su historial: para quitar
-- los datos de una persona concreta está la herramienta de Derechos ARCO (0125).
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

create table if not exists retention_rules (
  kind text primary key check (kind in ('chats', 'mensajes', 'prospectos', 'contratos')),
  retention interval not null check (retention >= interval '1 day'),
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by text
);

insert into retention_rules (kind, retention, enabled) values
  ('chats', interval '7 days', true),
  ('mensajes', interval '7 days', false),
  ('prospectos', interval '1 month', false),
  ('contratos', interval '6 months', false)
on conflict (kind) do nothing;

create table if not exists datos_purge_log (
  id uuid primary key default gen_random_uuid(),
  ran_at timestamptz not null default now(),
  kind text not null,
  dry_run boolean not null,
  due integer not null default 0,
  deleted integer not null default 0
);
create index if not exists idx_datos_purge_log_ran on datos_purge_log(ran_at desc);

alter table retention_rules enable row level security;
alter table datos_purge_log enable row level security;
revoke all on retention_rules, datos_purge_log from anon, authenticated;
grant select on retention_rules, datos_purge_log to authenticated;
drop policy if exists "Rol con apartado roles lee retention_rules" on retention_rules;
create policy "Rol con apartado roles lee retention_rules" on retention_rules for select to authenticated using (has_admin_section('roles'));
drop policy if exists "Rol con apartado roles lee datos_purge_log" on datos_purge_log;
create policy "Rol con apartado roles lee datos_purge_log" on datos_purge_log for select to authenticated using (has_admin_section('roles'));

-- Los ids (como texto) de lo que ya cumplió su plazo en cada regla.
create or replace function datos_vencidos(p_kind text)
returns table (id text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r interval;
begin
  select retention into r from retention_rules where kind = p_kind;
  if r is null then return; end if;

  if p_kind = 'chats' then
    return query select c.id::text from chat_rate_limits c where c.created_at < now() - r;
  elsif p_kind = 'mensajes' then
    return query select m.id::text from contact_messages m where m.created_at < now() - r;
  elsif p_kind = 'prospectos' then
    return query
      select p.id::text
      from prospectos p
      where greatest(
              p.created_at, p.updated_at, p.last_contact_at,
              (select max(e.at) from prospecto_etapas e where e.prospecto_id = p.id),
              (select max(k.at) from prospecto_contactos k where k.prospecto_id = p.id)
            ) < now() - r
        and (p.next_followup_at is null or p.next_followup_at < current_date);
  elsif p_kind = 'contratos' then
    return query
      select s.id::text
      from signing_requests s
      where greatest(s.created_at, s.signed_at, s.sealed_at, s.fingerprint_at) < now() - r;
  end if;
end;
$$;

revoke all on function datos_vencidos(text) from public, anon, authenticated;

create or replace function datos_borrar(p_kind text, p_ids text[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer := 0;
  tbl text;
begin
  if coalesce(array_length(p_ids, 1), 0) = 0 then return 0; end if;
  if p_kind = 'chats' then
    delete from chat_rate_limits where id::text = any(p_ids);
    get diagnostics n = row_count;
    return n;
  elsif p_kind = 'mensajes' then
    delete from contact_messages where id::text = any(p_ids);
    tbl := 'contact_messages';
  elsif p_kind = 'prospectos' then
    delete from prospectos where id::text = any(p_ids);
    tbl := 'prospectos';
  elsif p_kind = 'contratos' then
    delete from signing_requests where id::text = any(p_ids);
    tbl := 'signing_requests';
  else
    return 0;
  end if;
  get diagnostics n = row_count;
  -- El registro de actividad guarda el nombre como etiqueta: se quita de lo que se borró.
  update audit_log set label = null where table_name = tbl and row_id = any(p_ids);
  return n;
end;
$$;

revoke all on function datos_borrar(text, text[]) from public, anon, authenticated;

-- La corrida diaria. Solo la service role (o el dueño de la base, desde pg_cron).
create or replace function depurar_datos()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rule retention_rules;
  ids text[];
  due integer;
  deleted integer;
  result jsonb := '{}'::jsonb;
begin
  if coalesce(auth.role(), current_user) not in ('service_role', 'postgres') then
    raise exception 'Sin acceso' using errcode = '42501';
  end if;

  for rule in select * from retention_rules order by kind loop
    select coalesce(array_agg(v.id), '{}') into ids from datos_vencidos(rule.kind) v;
    due := coalesce(array_length(ids, 1), 0);
    deleted := case when rule.enabled then datos_borrar(rule.kind, ids) else 0 end;
    insert into datos_purge_log (kind, dry_run, due, deleted) values (rule.kind, not rule.enabled, due, deleted);
    result := result || jsonb_build_object(rule.kind, jsonb_build_object('due', due, 'deleted', deleted, 'dry_run', not rule.enabled));
  end loop;

  -- La bitácora de corridas no crece sin fin: se queda un año.
  delete from datos_purge_log where ran_at < now() - interval '1 year';
  return result;
end;
$$;

revoke all on function depurar_datos() from public, anon, authenticated;
grant execute on function depurar_datos() to service_role;

-- Resumen para la tarjeta de Roles y accesos.
create or replace function datos_resumen()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  rule retention_rules;
  last_run datos_purge_log;
  due integer;
  result jsonb := '[]'::jsonb;
begin
  if not has_admin_section('roles') then
    raise exception 'Sin acceso' using errcode = '42501';
  end if;
  for rule in select * from retention_rules order by kind loop
    select count(*) into due from datos_vencidos(rule.kind);
    select * into last_run from datos_purge_log where kind = rule.kind order by ran_at desc limit 1;
    result := result || jsonb_build_object(
      'kind', rule.kind,
      'retention', rule.retention::text,
      'enabled', rule.enabled,
      'due', due,
      'last_run', case when last_run.id is null then null else jsonb_build_object(
        'ran_at', last_run.ran_at, 'dry_run', last_run.dry_run, 'due', last_run.due, 'deleted', last_run.deleted) end
    );
  end loop;
  return result;
end;
$$;

revoke all on function datos_resumen() from public, anon;
grant execute on function datos_resumen() to authenticated;

-- Activar o apagar el borrado de una regla (de simulacro a real y de regreso).
create or replace function datos_activar(p_kind text, p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not has_admin_section('roles') then
    raise exception 'Sin acceso' using errcode = '42501';
  end if;
  update retention_rules set enabled = coalesce(p_enabled, false), updated_at = now(), updated_by = coalesce(nullif(auth.jwt() ->> 'email', ''), current_user)
  where kind = p_kind;
  if not found then
    raise exception 'Regla desconocida' using errcode = '22023';
  end if;
end;
$$;

revoke all on function datos_activar(text, boolean) from public, anon;
grant execute on function datos_activar(text, boolean) to authenticated;

-- Corrida diaria (07:30 UTC). Llama directo a la función de la base: no pasa por la red ni necesita secretos.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'depurar-datos') then
    perform cron.unschedule('depurar-datos');
  end if;
  perform cron.schedule('depurar-datos', '30 7 * * *', 'select depurar_datos()');
end $$;

-- ─────────────────────────────────────────────
-- Las vistas de una ficha no cuentan al equipo ni a los robots (2026-11-26)
-- «N personas la vieron» (y las vistas del informe al vendedor) contaban también a los asesores enseñando la ficha con su sesión
-- iniciada y a los robots que ejecutan JavaScript (Googlebot, vistas previas de WhatsApp o Facebook, Lighthouse, navegadores sin
-- cabeza). Ahora record_property_view no anota la vista si quien llama tiene sesión del panel (rol `authenticated`) o si su
-- User-Agent es de un robot; igual devuelve el conteo, para que la ficha se vea igual.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

create or replace function request_user_agent()
returns text
language plpgsql
stable
as $$
declare
  headers json;
begin
  begin
    headers := nullif(current_setting('request.headers', true), '')::json;
  exception when others then
    return null;
  end;
  return headers ->> 'user-agent';
end;
$$;

create or replace function record_property_view(p_property_id uuid, p_visitor_id uuid, p_days int default 3)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ip text := request_client_ip();
  v_hash text := case when v_ip is null then null else md5('acl-views:' || v_ip) end;
  v_ua text := coalesce(request_user_agent(), '');
  v_counts boolean;
begin
  -- No cuenta: el equipo con sesión del panel y los robots (por su User-Agent).
  v_counts := coalesce(auth.role(), 'anon') <> 'authenticated'
              and v_ua !~* '(bot|crawl|spider|slurp|headless|lighthouse|facebookexternalhit|whatsapp|preview|python-requests|curl/|wget)';

  if v_counts and (v_hash is null
     or (select count(*) from property_views where ip_hash = v_hash and created_at > now() - interval '1 hour') < 40) then
    insert into property_views (property_id, visitor_id, ip_hash)
    values (p_property_id, p_visitor_id, v_hash)
    on conflict (property_id, visitor_id, viewed_on) do nothing;
  end if;

  return (
    select count(distinct visitor_id)
    from property_views
    where property_id = p_property_id
      and viewed_on > current_date - p_days
  );
end;
$$;

revoke all on function request_user_agent() from public;
grant execute on function record_property_view(uuid, uuid, int) to anon, authenticated;

-- ─────────────────────────────────────────────
-- Índices para lo que más se consulta (2026-11-26)
-- · properties: el listado público filtra por activa + estatus y ordena por fecha o precio; el panel ordena por fecha.
-- · contact_messages y prospectos: las listas del panel ordenan por fecha de creación (y las limpiezas diarias de 0127 las recorren).
-- · prospectos(phone): detección de duplicados y búsqueda por teléfono.
-- Son solo índices (no cambian datos); `if not exists` los hace re-ejecutables.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

create index if not exists idx_properties_active_status on properties(active, status);
create index if not exists idx_properties_price on properties(price);
create index if not exists idx_properties_created_at on properties(created_at desc);
create index if not exists idx_contact_messages_created_at on contact_messages(created_at desc);
create index if not exists idx_prospectos_created_at on prospectos(created_at desc);
create index if not exists idx_prospectos_phone on prospectos(phone);

-- ─────────────────────────────────────────────
-- `updated_at` de propiedades lo pone la base (2026-11-26)
-- Antes lo llenaba el navegador del asesor: cambios hechos por otro camino (marcar vendida, edición en lote, una función) no lo
-- actualizaban y «Actualizada el…», los informes y el orden por fecha quedaban viejos. Ahora un disparador lo fija a la hora de la base
-- en cada UPDATE (solo si la fila cambió de verdad).
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

create or replace function properties_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  if to_jsonb(new) - 'updated_at' is distinct from to_jsonb(old) - 'updated_at' then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_properties_touch_updated_at on properties;
create trigger trg_properties_touch_updated_at
  before update on properties
  for each row execute function properties_touch_updated_at();

-- ── Anotar como aplicadas (para llevar la cuenta con `npm run db:migrate`) ──
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);
insert into supabase_migrations.schema_migrations (version, name) values
  ('0118', 'seguridad_lectura_publica_correo_del_staff_y_limites_por_ip'),
  ('0119', 'plantilla_membretada_solo_para_roles_con_acceso'),
  ('0120', 'ubicacion_aproximada_por_propiedad_coordenadas_exactas_solo_para_el_'),
  ('0121', 'enlaces_con_token_vigencia_visible_y_el_informe_del_vendedor_'),
  ('0122', 'un_secreto_distinto_por_funcion_programada_derivado_del_maestro'),
  ('0123', 'papeleria_de_clientes_se_conserva_3_anos_y_despues_se_depura'),
  ('0124', 'vistas_por_ip_limites_de_mensajes_novedades_sin_llave_maestra_y_conteo_sin_vendidas'),
  ('0125', 'derechos_arco_consultar_y_borrar_los_datos_de_una_persona'),
  ('0126', 'estatus_rentada_para_propiedades_en_renta'),
  ('0127', 'depuracion_de_chats_mensajes_prospectos_y_contratos'),
  ('0128', 'las_vistas_de_una_ficha_no_cuentan_al_equipo_ni_a_los_robots'),
  ('0129', 'indices_para_lo_que_mas_se_consulta'),
  ('0130', 'updated_at_de_propiedades_lo_pone_la_base')
on conflict (version) do nothing;

-- Comprobación: debe devolver 0130 (la última versión anotada).
select max(version) as ultima_migracion_anotada from supabase_migrations.schema_migrations;
