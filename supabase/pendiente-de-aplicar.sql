-- ─────────────────────────────────────────────
-- SQL PENDIENTE DE APLICAR en Supabase — versión «para ponerse al día» (migraciones 0099 a 0114).
-- Pégalo COMPLETO en el SQL Editor y ejecútalo UNA vez. Cada bloque es re-ejecutable y están en el orden correcto, así que
-- sirve aunque a tu base ya le falte o ya tenga parte: lo que existe se respeta y lo que falta se crea.
-- Empieza en 0099 (Desarrollos) y trae, entre otros: Portal del cliente · Agendar visita (fases 1 a 8) · Selección de
-- propiedades en un solo enlace · Listado y ficha · Avisos por correo al cliente · Encuesta tras la visita · Ofertas y apartados ·
-- Contratos, comisiones y fusión · Freno de envíos · Dos pasos y dispositivos · Monitoreo de errores · Tiempo real · Conteo por tipo.
-- ─────────────────────────────────────────────
-- ─────────────────────────────────────────────
-- Desarrollos / torres (2026-10-29): un edificio con muchos departamentos que
-- se vende como un solo proyecto (/desarrollos/:slug). Las fotos viven en la
-- torre y en cada modelo (tipología), no en cada departamento; un depto solo
-- trae número, piso, modelo, precio, estatus y vista. Por eso `models` y
-- `units` son jsonb dentro de la fila (se editan juntos, desde un solo
-- formulario, y una torre rara vez pasa de unos cientos de deptos) en vez de
-- tablas aparte. Las fotos suben al bucket público property-images, bajo el
-- prefijo desarrollos/. Hereda el apartado `propiedades` — no hace falta
-- tocar roles. La lectura pública es solo de desarrollos publicados.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

create table if not exists developments (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  tagline text,
  description text,
  zone text not null,
  address text,
  lat double precision,
  lng double precision,
  stage text not null default 'preventa' check (stage in ('preventa', 'construccion', 'entrega_inmediata')),
  delivery_date text,
  developer_name text not null,
  developer_logo text,
  hero_image text,
  images text[] not null default '{}',
  amenities text[] not null default '{}',
  models jsonb not null default '[]'::jsonb,
  units jsonb not null default '[]'::jsonb,
  disclaimer text,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_developments_published on developments(published, created_at desc);

alter table developments enable row level security;

drop policy if exists "Public lee desarrollos publicados" on developments;
create policy "Public lee desarrollos publicados" on developments for select using (published = true);

drop policy if exists "Rol con apartado propiedades lee todos los desarrollos" on developments;
create policy "Rol con apartado propiedades lee todos los desarrollos" on developments for select
  using (has_admin_section('propiedades'));

drop policy if exists "Rol con apartado propiedades administra desarrollos" on developments;
create policy "Rol con apartado propiedades administra desarrollos" on developments for all
  using (has_admin_section('propiedades')) with check (has_admin_section('propiedades'));

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

-- ─────────────────────────────────────────────
-- Agendar visita con horarios reales (2026-11-03) — fase 1: base de datos.
-- Hasta ahora "Agendar visita" de la ficha guardaba la fecha como TEXTO dentro
-- de un contact_message y alguien tenía que agendarla a mano en la Agenda. Con
-- esto el visitante elige un horario libre del asesor y la cita cae directo en
-- agenda_citas. La lógica de horarios vive en estas funciones y se espeja en
-- src/lib/visitSlots.js (modo demo y pruebas): si cambia una regla, cambia en
-- los dos lados.
--
-- · advisor_visit_settings / advisor_availability / advisor_time_off: cuándo
--   atiende cada asesor. La reserva en línea NO se activa sola: un asesor sin
--   fila de ajustes con enabled = true (o sin ventanas) no ofrece horarios y
--   la ficha sigue con el formulario de siempre.
-- · agenda_citas gana propiedad, duración, estatus, origen, enlace secreto
--   (booking_token) y los datos de contacto de quien reservó sin ser cliente.
--   Las citas existentes quedan como 'confirmada' / 'admin'.
-- · get_visit_slots / book_visit / get_booking / reschedule_booking /
--   cancel_booking / confirm_booking_attendance son las ÚNICAS puertas del
--   navegador sin sesión (security definer, devuelven jsonb {error: 'codigo'}
--   en vez de lanzar excepciones, igual que portal_register_consent). Nadie
--   con rol anon lee agenda_citas directo ni ve datos de otras citas.
-- · Todo se calcula en hora de México (America/Mexico_City): el servidor corre
--   en UTC. Una cita que reserva el visitante también crea un contact_message
--   (canal 'visita') para reutilizar el aviso de WhatsApp y el inbox actuales.
-- · Doble reserva: book_visit toma un candado por asesor y día antes de
--   revisar el horario, así dos personas no se llevan el mismo.
-- · Fase 4 (/visita/:token): get_booking_slots da los horarios libres del MISMO
--   asesor de la cita (reschedule_booking no cambia de asesor, y el listado de
--   la ficha mezcla a todos). Al reprogramar o cancelar, el cliente le avisa al
--   asesor con un contact_message canal 'visita_cambio' (visit_notify_change):
--   el trigger de WhatsApp y el inbox de Mensajes ya existentes hacen el resto,
--   sin plantillas nuevas. Confirmar asistencia NO avisa: no vale un WhatsApp
--   por cada confirmación; se ve en la Agenda y en Mi día.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

create table if not exists advisor_visit_settings (
  advisor_id uuid primary key references advisors(id) on delete cascade,
  enabled boolean not null default false,
  slot_minutes int not null default 60 check (slot_minutes in (30, 45, 60, 90, 120)),
  min_notice_hours int not null default 2 check (min_notice_hours between 0 and 168),
  horizon_days int not null default 14 check (horizon_days between 1 and 60),
  updated_at timestamptz not null default now()
);

-- weekday: 0 = domingo … 6 = sábado (igual que JavaScript y extract(dow)).
create table if not exists advisor_availability (
  id uuid primary key default gen_random_uuid(),
  advisor_id uuid not null references advisors(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);

create index if not exists idx_advisor_availability_advisor on advisor_availability(advisor_id, weekday);

create table if not exists advisor_time_off (
  id uuid primary key default gen_random_uuid(),
  advisor_id uuid not null references advisors(id) on delete cascade,
  fecha_inicio date not null,
  fecha_fin date not null,
  motivo text,
  created_at timestamptz not null default now(),
  check (fecha_fin >= fecha_inicio)
);

create index if not exists idx_advisor_time_off_advisor on advisor_time_off(advisor_id, fecha_inicio);

-- Intentos de reservar desde el sitio, para limitar abuso por teléfono e IP.
-- RLS sin políticas: solo book_visit (security definer) escribe y lee.
create table if not exists visit_booking_attempts (
  id uuid primary key default gen_random_uuid(),
  phone_digits text,
  ip text,
  created_at timestamptz not null default now()
);

create index if not exists idx_visit_booking_attempts_phone on visit_booking_attempts(phone_digits, created_at desc);
create index if not exists idx_visit_booking_attempts_ip on visit_booking_attempts(ip, created_at desc);

alter table advisor_visit_settings enable row level security;
alter table advisor_availability enable row level security;
alter table advisor_time_off enable row level security;
alter table visit_booking_attempts enable row level security;

-- Cada asesor administra su propio horario; un acceso con 'agenda' sin asesor
-- vinculado (administración) administra el de todos — mismo criterio que agenda_citas.
drop policy if exists "Horario de visitas propio o todos con agenda" on advisor_visit_settings;
create policy "Horario de visitas propio o todos con agenda" on advisor_visit_settings for all
  using (has_admin_section('agenda') and (my_advisor_id() is null or my_advisor_id() = advisor_id))
  with check (has_admin_section('agenda') and (my_advisor_id() is null or my_advisor_id() = advisor_id));

drop policy if exists "Disponibilidad propia o todos con agenda" on advisor_availability;
create policy "Disponibilidad propia o todos con agenda" on advisor_availability for all
  using (has_admin_section('agenda') and (my_advisor_id() is null or my_advisor_id() = advisor_id))
  with check (has_admin_section('agenda') and (my_advisor_id() is null or my_advisor_id() = advisor_id));

drop policy if exists "Descansos propios o todos con agenda" on advisor_time_off;
create policy "Descansos propios o todos con agenda" on advisor_time_off for all
  using (has_admin_section('agenda') and (my_advisor_id() is null or my_advisor_id() = advisor_id))
  with check (has_admin_section('agenda') and (my_advisor_id() is null or my_advisor_id() = advisor_id));

alter table agenda_citas add column if not exists property_id uuid references properties(id) on delete set null;
alter table agenda_citas add column if not exists duracion_min int not null default 60 check (duracion_min between 15 and 480);
alter table agenda_citas add column if not exists status text not null default 'confirmada'
  check (status in ('confirmada', 'cancelada', 'realizada', 'no_asistio', 'solicitada'));
alter table agenda_citas add column if not exists source text not null default 'admin' check (source in ('admin', 'sitio'));
alter table agenda_citas add column if not exists booking_token text unique check (booking_token ~ '^[0-9a-f]{32}$');
alter table agenda_citas add column if not exists contact_name text;
alter table agenda_citas add column if not exists contact_phone text;
alter table agenda_citas add column if not exists contact_email text;
alter table agenda_citas add column if not exists message_id uuid references contact_messages(id) on delete set null;
-- Fase 6: el prospecto en que se convirtió (o al que se sumó) quien reservó la visita.
alter table agenda_citas add column if not exists prospecto_id uuid references prospectos(id) on delete set null;
alter table agenda_citas add column if not exists reschedule_count int not null default 0;
alter table agenda_citas add column if not exists client_confirmed_at timestamptz;
alter table agenda_citas add column if not exists cancelled_reason text;
alter table agenda_citas add column if not exists cancelled_by text check (cancelled_by in ('cliente', 'asesor'));

create index if not exists idx_agenda_citas_property on agenda_citas(property_id);
create index if not exists idx_agenda_citas_status on agenda_citas(status);

-- ── Interno: horarios libres de UN asesor entre dos fechas ──
-- Sin grant: solo lo llaman las funciones públicas de abajo. p_exclude_cita
-- libera el horario de la propia cita al reprogramarla.
create or replace function visit_free_slots(p_advisor_id uuid, p_from date, p_to date, p_exclude_cita uuid default null)
returns table (fecha date, hora time)
language plpgsql
security definer
set search_path = public
as $$
declare
  s advisor_visit_settings;
  now_mx timestamp := (now() at time zone 'America/Mexico_City');
  earliest timestamp;
  slot_len interval;
  i int;
  d date;
  w record;
  slot_start timestamp;
begin
  select * into s from advisor_visit_settings where advisor_id = p_advisor_id;
  if not found or not s.enabled then return; end if;

  earliest := now_mx + make_interval(hours => s.min_notice_hours);
  slot_len := make_interval(mins => s.slot_minutes);
  p_from := greatest(p_from, now_mx::date);
  p_to := least(p_to, now_mx::date + s.horizon_days);

  for i in 0 .. (p_to - p_from) loop
    d := p_from + i;
    if exists (select 1 from advisor_time_off o where o.advisor_id = p_advisor_id and d between o.fecha_inicio and o.fecha_fin) then
      continue;
    end if;

    for w in
      select a.start_time, a.end_time from advisor_availability a
      where a.advisor_id = p_advisor_id and a.weekday = extract(dow from d)::int
      order by a.start_time
    loop
      slot_start := d + w.start_time;
      while slot_start + slot_len <= d + w.end_time loop
        if slot_start >= earliest and not exists (
          select 1 from agenda_citas c
          where c.advisor_id = p_advisor_id
            and c.fecha = d
            and c.hora is not null
            and c.status <> 'cancelada'
            and (p_exclude_cita is null or c.id <> p_exclude_cita)
            and (d + c.hora) < slot_start + slot_len
            and (d + c.hora) + make_interval(mins => c.duracion_min) > slot_start
        ) then
          fecha := d;
          hora := slot_start::time;
          return next;
        end if;
        slot_start := slot_start + slot_len;
      end loop;
    end loop;
  end loop;
end;
$$;

revoke all on function visit_free_slots(uuid, date, date, uuid) from public;

-- ── Público: horarios libres para visitar una propiedad ──
-- Une los de todos los asesores de la propiedad y, por cada horario, dice cuáles
-- asesores (nombre y foto, nada de contacto) están libres a esa hora.
create or replace function get_visit_slots(p_property_id uuid, p_from date default null, p_days int default 14)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  prop properties;
  today date := (now() at time zone 'America/Mexico_City')::date;
  d_from date;
  d_to date;
  result jsonb;
begin
  select * into prop from properties where id = p_property_id;
  if not found or not prop.active or prop.status = 'vendida' then
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
$$;

revoke all on function get_visit_slots(uuid, date, int) from public;
grant execute on function get_visit_slots(uuid, date, int) to anon, authenticated;

-- ── Público: reservar una visita ──
-- Errores (jsonb {error}): invalid_name, invalid_email, invalid_phone,
-- invalid_note, invalid_slot, property_unavailable, rate_limited,
-- too_many_active, slot_unavailable.
create or replace function book_visit(
  p_property_id uuid,
  p_fecha date,
  p_hora time,
  p_name text,
  p_email text,
  p_phone text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
  if not found or not prop.active or prop.status = 'vendida' then
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
$$;

revoke all on function book_visit(uuid, date, time, text, text, text, text) from public;
grant execute on function book_visit(uuid, date, time, text, text, text, text) to anon, authenticated;

-- ── Público (con token): ver una visita reservada ──
create or replace function get_booking(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  c agenda_citas;
  adv advisors;
  prop properties;
  cl_name text;
  now_mx timestamp := (now() at time zone 'America/Mexico_City');
  start_at timestamp;
  mins_until numeric;
begin
  select * into c from agenda_citas where booking_token = p_token and p_token ~ '^[0-9a-f]{32}$';
  if not found then return jsonb_build_object('status', 'invalido'); end if;

  select * into adv from advisors where id = c.advisor_id;
  select * into prop from properties where id = c.property_id;
  -- Una cita que capturó el equipo en la Agenda también tiene enlace: el nombre sale del cliente ligado.
  select name into cl_name from clients where id = c.client_id;
  start_at := c.fecha + coalesce(c.hora, time '00:00');
  mins_until := extract(epoch from (start_at - now_mx)) / 60;

  return jsonb_build_object(
    'status', c.status,
    'fecha', c.fecha,
    'hora', to_char(c.hora, 'HH24:MI'),
    'duracion_min', c.duracion_min,
    'client_name', split_part(coalesce(nullif(trim(c.contact_name), ''), cl_name, ''), ' ', 1),
    'titulo', c.titulo,
    'lugar', c.lugar,
    'client_confirmed_at', c.client_confirmed_at,
    'reschedule_count', c.reschedule_count,
    -- Una cita del sitio se mueve siempre (se reservó con los horarios de su asesor); una que capturó el
    -- equipo, solo si su asesor ofrece horarios en línea (si no, no hay a dónde moverla desde aquí).
    'can_reschedule', c.status = 'confirmada' and c.hora is not null and mins_until >= 120 and c.reschedule_count < 2
      and (c.source = 'sitio' or exists (select 1 from advisor_visit_settings s where s.advisor_id = c.advisor_id and s.enabled)),
    'can_cancel', c.status in ('confirmada', 'solicitada') and c.hora is not null and mins_until > 0,
    'can_confirm', c.status = 'confirmada' and c.hora is not null and mins_until > 0 and c.client_confirmed_at is null,
    'advisor', case when adv.id is null then null else
      jsonb_build_object('id', adv.id, 'name', adv.name, 'phone', adv.phone, 'whatsapp', adv.whatsapp, 'photo_url', adv.photo_url)
    end,
    'property', case when prop.id is null then null else
      jsonb_build_object('id', prop.id, 'title', prop.title, 'code', prop.code, 'address', prop.address, 'main_image', prop.main_image, 'lat', prop.lat, 'lng', prop.lng)
    end
  );
end;
$$;

revoke all on function get_booking(text) from public;
grant execute on function get_booking(text) to anon, authenticated;

-- ── Interno: avisar al asesor que el cliente movió o canceló su visita ──
-- Sin grant: solo lo llaman reschedule_booking / cancel_booking. Texto igual al
-- de buildBookingChangeMessage() en src/lib/visitSlots.js.
create or replace function visit_notify_change(p_cita agenda_citas, p_kind text, p_old_fecha date, p_old_hora time, p_detail text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  prop properties;
  cl record;
  label text;
  msg text;
begin
  select * into prop from properties where id = p_cita.property_id;
  select name, phone, email into cl from clients where id = p_cita.client_id;
  label := coalesce(case when prop.code is not null then trim(prop.title) || ' (' || prop.code || ')' else trim(prop.title) end, trim(p_cita.titulo));

  if p_kind = 'reprogramada' then
    msg := 'Visita reprogramada por el cliente — ' || label || E'.\nAntes: ' || to_char(p_old_fecha, 'DD/MM/YYYY') || ' a las ' || to_char(p_old_hora, 'HH24:MI')
      || E'\nAhora: ' || to_char(p_cita.fecha, 'DD/MM/YYYY') || ' a las ' || to_char(p_cita.hora, 'HH24:MI');
  else
    msg := 'Visita cancelada por el cliente — ' || label || E'.\nEra el ' || to_char(p_old_fecha, 'DD/MM/YYYY') || ' a las ' || to_char(p_old_hora, 'HH24:MI')
      || case when coalesce(trim(p_detail), '') <> '' then E'\nMotivo: ' || trim(p_detail) else '' end;
  end if;

  insert into contact_messages (name, email, phone, message, property_id, channel, details)
  values (
    coalesce(nullif(trim(p_cita.contact_name), ''), cl.name, '(sin nombre)'), coalesce(p_cita.contact_email, cl.email, ''), coalesce(p_cita.contact_phone, cl.phone), msg,
    p_cita.property_id, 'visita_cambio',
    jsonb_build_object('cita_id', p_cita.id, 'kind', p_kind, 'advisor_id', p_cita.advisor_id)
  );
end;
$$;

revoke all on function visit_notify_change(agenda_citas, text, date, time, text) from public;

-- ── Público (con token): horarios libres del asesor de ESTA visita, para moverla ──
-- Solo si la visita sigue confirmada. La propia cita no estorba (se puede correr
-- media hora). Mismo formato que get_visit_slots: { slots: [{fecha, hora}] }.
create or replace function get_booking_slots(p_token text, p_days int default 14)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c agenda_citas;
  today date := (now() at time zone 'America/Mexico_City')::date;
  result jsonb;
begin
  select * into c from agenda_citas where booking_token = p_token and p_token ~ '^[0-9a-f]{32}$';
  if not found or c.status <> 'confirmada' then return jsonb_build_object('slots', '[]'::jsonb); end if;

  select coalesce(jsonb_agg(jsonb_build_object('fecha', f.fecha, 'hora', to_char(f.hora, 'HH24:MI')) order by f.fecha, f.hora), '[]'::jsonb)
  into result
  from visit_free_slots(c.advisor_id, today, today + greatest(least(coalesce(p_days, 14), 60), 1), c.id) f;

  return jsonb_build_object('slots', result);
end;
$$;

revoke all on function get_booking_slots(text, int) from public;
grant execute on function get_booking_slots(text, int) to anon, authenticated;

-- ── Público (con token): mover la visita a otro horario del mismo asesor ──
-- Errores: not_found, not_active, too_late (menos de 2 h), limit_reached
-- (2 cambios ya usados), slot_unavailable.
create or replace function reschedule_booking(p_token text, p_fecha date, p_hora time)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c agenda_citas;
  now_mx timestamp := (now() at time zone 'America/Mexico_City');
  free boolean;
  old_fecha date;
  old_hora time;
begin
  select * into c from agenda_citas where booking_token = p_token and p_token ~ '^[0-9a-f]{32}$';
  if not found then return jsonb_build_object('error', 'not_found'); end if;
  if c.status <> 'confirmada' or c.hora is null then return jsonb_build_object('error', 'not_active'); end if;
  old_fecha := c.fecha;
  old_hora := c.hora;
  if (c.fecha + c.hora) - now_mx < interval '2 hours' then return jsonb_build_object('error', 'too_late'); end if;
  if c.reschedule_count >= 2 then return jsonb_build_object('error', 'limit_reached'); end if;
  if p_fecha is null or p_hora is null then return jsonb_build_object('error', 'slot_unavailable'); end if;

  perform pg_advisory_xact_lock(hashtextextended(c.advisor_id::text || p_fecha::text, 0));

  select exists (select 1 from visit_free_slots(c.advisor_id, p_fecha, p_fecha, c.id) f where f.hora = p_hora) into free;
  if not free then return jsonb_build_object('error', 'slot_unavailable'); end if;

  -- Se reinician los recordatorios y la confirmación de asistencia: la cita es otra.
  update agenda_citas
  set fecha = p_fecha, hora = p_hora, reschedule_count = reschedule_count + 1,
      reminder_sent_at = null, client_reminder_sent_at = null, client_confirmed_at = null,
      updated_at = now()
  where id = c.id
  returning * into c;

  perform visit_notify_change(c, 'reprogramada', old_fecha, old_hora);

  return jsonb_build_object('ok', true, 'fecha', c.fecha, 'hora', to_char(c.hora, 'HH24:MI'), 'reschedule_count', c.reschedule_count);
end;
$$;

revoke all on function reschedule_booking(text, date, time) from public;
grant execute on function reschedule_booking(text, date, time) to anon, authenticated;

-- ── Público (con token): cancelar la visita (hasta la hora de la cita) ──
create or replace function cancel_booking(p_token text, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c agenda_citas;
  now_mx timestamp := (now() at time zone 'America/Mexico_City');
begin
  select * into c from agenda_citas where booking_token = p_token and p_token ~ '^[0-9a-f]{32}$';
  if not found then return jsonb_build_object('error', 'not_found'); end if;
  if c.status not in ('confirmada', 'solicitada') then return jsonb_build_object('error', 'not_active'); end if;
  if c.hora is not null and (c.fecha + c.hora) <= now_mx then return jsonb_build_object('error', 'too_late'); end if;

  update agenda_citas
  set status = 'cancelada', cancelled_by = 'cliente', cancelled_reason = nullif(left(trim(coalesce(p_reason, '')), 300), ''), updated_at = now()
  where id = c.id;

  -- c sigue con la fecha y la hora originales (el update no la reasigna).
  perform visit_notify_change(c, 'cancelada', c.fecha, c.hora, left(trim(coalesce(p_reason, '')), 300));

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function cancel_booking(text, text) from public;
grant execute on function cancel_booking(text, text) to anon, authenticated;

-- ── Público (con token): "sí voy a asistir" ──
create or replace function confirm_booking_attendance(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c agenda_citas;
  now_mx timestamp := (now() at time zone 'America/Mexico_City');
begin
  select * into c from agenda_citas where booking_token = p_token and p_token ~ '^[0-9a-f]{32}$';
  if not found then return jsonb_build_object('error', 'not_found'); end if;
  if c.status <> 'confirmada' then return jsonb_build_object('error', 'not_active'); end if;
  if c.hora is not null and (c.fecha + c.hora) <= now_mx then return jsonb_build_object('error', 'too_late'); end if;

  update agenda_citas set client_confirmed_at = coalesce(client_confirmed_at, now()), updated_at = now() where id = c.id;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function confirm_booking_attendance(text) from public;
grant execute on function confirm_booking_attendance(text) to anon, authenticated;

-- ─────────────────────────────────────────────
-- Agendar visita con horarios reales, fase 5 (2026-11-03): correos y recordatorios.
-- A quien reservó desde el sitio (agenda_citas.source = 'sitio', con contact_email) se le manda
-- por correo (Resend):
--   · al reservar: confirmación, con el enlace /visita/<token> y el .ics adjunto;
--   · al cambiar el horario (el cliente desde /visita/<token> o el asesor desde la Agenda):
--     el nuevo horario, con el .ics actualizado;
--   · al cancelarse (el cliente o el asesor): aviso con el enlace para agendar otra;
--   · ~24 h antes: recordatorio con el botón para confirmar asistencia;
--   · ~2 h antes: recordatorio con el mapa.
-- Edge Functions (se despliegan con la verificación de JWT DESACTIVADA, como las demás de
-- Agenda; validan con el mismo x-cron-secret y usan la service role key):
--   · supabase/functions/visita-correo         — la llama el trigger de abajo (confirmación y cambios);
--   · supabase/functions/visita-recordatorios  — la llama pg_cron cada 15 minutos.
-- Variables de las funciones: RESEND_API_KEY (obligatoria; la misma de enviar-correo y de las
-- alertas), RESEND_FROM y SITE_URL (opcionales; por omisión avisos@aclpropiedades.com y
-- https://acl-propiedades.vercel.app).
-- · email_reminder_24h_at / email_reminder_2h_at: cada recordatorio se "reclama" antes de mandarse,
--   así dos corridas nunca lo duplican. Al cambiar la fecha u hora de una cita (por quien sea) se
--   reinician TODOS sus recordatorios (trg_agenda_citas_reset_reminders): son otra cita.
-- · El trigger de correo nunca hace fallar una reserva, un cambio ni una cancelación: si no se pudo
--   encolar el correo (falta un secreto de Vault, pg_net caído…) solo deja un WARNING en el log.
-- · El recordatorio de WhatsApp de la tarde anterior (agenda-recordatorio-cliente) ahora también
--   cubre estas visitas, salvo a quien ya confirmó su asistencia (client_confirmed_at).
-- (bloque re-ejecutable: cron.schedule con un nombre que ya existe actualiza ese job)
-- ─────────────────────────────────────────────

alter table agenda_citas add column if not exists email_reminder_24h_at timestamptz;
alter table agenda_citas add column if not exists email_reminder_2h_at timestamptz;

create or replace function agenda_citas_reset_reminders()
returns trigger
language plpgsql
as $$
begin
  if new.fecha is distinct from old.fecha or new.hora is distinct from old.hora then
    new.reminder_sent_at := null;
    new.client_reminder_sent_at := null;
    new.email_reminder_24h_at := null;
    new.email_reminder_2h_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_agenda_citas_reset_reminders on agenda_citas;
create trigger trg_agenda_citas_reset_reminders
before update on agenda_citas
for each row execute function agenda_citas_reset_reminders();

create or replace function notify_visit_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  kind text;
begin
  -- Solo reservas del sitio con correo. Las citas que crea el equipo a mano no mandan correo.
  if new.source is distinct from 'sitio' or coalesce(trim(new.contact_email), '') = '' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    kind := case when new.status = 'solicitada' then 'solicitud' else 'confirmacion' end;
  elsif old.status in ('confirmada', 'solicitada') and new.status = 'cancelada' then
    kind := 'cancelacion';
  elsif old.status in ('cancelada', 'solicitada') and new.status = 'confirmada' then
    kind := 'confirmacion'; -- el asesor reactivó una visita cancelada o tomó una solicitud sin asesor
  elsif new.status = 'confirmada' and (new.fecha is distinct from old.fecha or new.hora is distinct from old.hora) then
    kind := 'reprogramada';
  else
    return new;
  end if;

  begin
    perform net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/visita-correo',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key'),
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'agenda_cron_secret')
      ),
      body := jsonb_build_object('cita_id', new.id, 'kind', kind)
    );
  exception when others then
    raise warning 'notify_visit_email: no se pudo encolar el correo (%) de la cita %: %', kind, new.id, sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists trg_notify_visit_email on agenda_citas;
create trigger trg_notify_visit_email
after insert or update on agenda_citas
for each row execute function notify_visit_email();

select cron.schedule(
  'visita-recordatorios',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/visita-recordatorios',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key'),
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'agenda_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ─────────────────────────────────────────────
-- Agendar visita con horarios reales, fase 6 (2026-11-03): cierre del ciclo.
-- · Quien reserva desde el sitio ya es un prospecto: book_visit llama a visit_promote_prospect, que
--   crea uno (fuente 'visita_agendada', etapa 'interesado', último contacto = ahora, seguimiento el
--   día DESPUÉS de la visita: ahí le toca al asesor llamar a preguntar qué le pareció) o, si ya hay un
--   prospecto ABIERTO con ese teléfono (últimos 10 dígitos) o correo, lo actualiza en vez de duplicarlo:
--   sube de 'nuevo'/'contactado' a 'interesado', anota la visita y adelanta el seguimiento si el que
--   tenía era anterior a hoy o posterior a la visita. Un prospecto cerrado o perdido no cuenta como
--   existente. agenda_citas.prospecto_id guarda la liga.
-- · trg_agenda_citas_sync_prospect mantiene ese seguimiento al día: si se mueve la visita, lo mueve
--   también (solo si seguía siendo la fecha automática, para no pisar una que el asesor cambió a
--   mano); si se cancela o el cliente no asiste, lo pone para mañana (recontactar pronto).
-- · property_visits.cita_id liga la visita registrada con la cita de la que salió ("Realizada" en la
--   Agenda abre el formulario ya prellenado): una cita no puede tener dos visitas (unique).
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

alter table property_visits add column if not exists cita_id uuid unique references agenda_citas(id) on delete set null;

-- p_requested = true cuando es una solicitud sin asesor (request_visit): el texto dice "Solicitó" y no
-- "Agendó", y el prospecto nace sin asesor (p_advisor_id null) hasta que alguien tome la visita.
drop function if exists visit_promote_prospect(uuid, uuid, text, text, text, date, time, uuid, text);

create or replace function visit_promote_prospect(
  p_property_id uuid,
  p_advisor_id uuid,
  p_name text,
  p_phone text,
  p_email text,
  p_fecha date,
  p_hora time,
  p_message_id uuid,
  p_note text default null,
  p_requested boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  today date := (now() at time zone 'America/Mexico_City')::date;
  prop properties;
  label text;
  phone10 text := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10);
  email_l text := lower(trim(coalesce(p_email, '')));
  follow date := p_fecha + 1;
  line text;
  existing prospectos;
  new_id uuid;
begin
  select * into prop from properties where id = p_property_id;
  label := coalesce(case when prop.code is not null then trim(prop.title) || ' (' || prop.code || ')' else trim(prop.title) end, 'una propiedad');
  line := case when p_requested then 'Solicitó una visita a ' else 'Agendó una visita a ' end
    || label || ' el ' || to_char(p_fecha, 'DD/MM/YYYY') || ' a las ' || to_char(p_hora, 'HH24:MI')
    || case when coalesce(trim(p_note), '') <> '' then '. Nota: ' || trim(p_note) else '' end;

  select * into existing from prospectos
  where stage in ('nuevo', 'contactado', 'interesado', 'negociacion')
    and (
      (length(phone10) = 10 and right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 10) = phone10)
      or (email_l <> '' and lower(trim(coalesce(email, ''))) = email_l)
    )
  order by created_at desc
  limit 1;

  if found then
    update prospectos
    set stage = case when stage in ('nuevo', 'contactado') then 'interesado' else stage end,
        last_contact_at = now(),
        next_followup_at = case when next_followup_at is null or next_followup_at < today or next_followup_at > follow then follow else next_followup_at end,
        property_id = coalesce(property_id, p_property_id),
        notes = case when coalesce(notes, '') = '' then line else notes || E'\n' || line end,
        updated_at = now()
    where id = existing.id;
    return existing.id;
  end if;

  insert into prospectos (name, phone, email, source, stage, advisor_id, property_id, message_id, notes, last_contact_at, next_followup_at, created_by)
  values (p_name, p_phone, p_email, 'visita_agendada', 'interesado', p_advisor_id, p_property_id, p_message_id, line, now(), follow, 'sitio')
  returning id into new_id;
  return new_id;
end;
$$;

revoke all on function visit_promote_prospect(uuid, uuid, text, text, text, date, time, uuid, text, boolean) from public;

create or replace function agenda_citas_sync_prospect()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  today date := (now() at time zone 'America/Mexico_City')::date;
begin
  if new.prospecto_id is null or new.source is distinct from 'sitio' then return new; end if;

  if new.status = 'confirmada' and new.fecha is distinct from old.fecha then
    update prospectos set next_followup_at = new.fecha + 1, updated_at = now()
    where id = new.prospecto_id and next_followup_at = old.fecha + 1 and stage in ('nuevo', 'contactado', 'interesado', 'negociacion');
  elsif old.status in ('confirmada', 'solicitada') and new.status in ('cancelada', 'no_asistio') then
    update prospectos set next_followup_at = today + 1, updated_at = now()
    where id = new.prospecto_id and next_followup_at = new.fecha + 1 and stage in ('nuevo', 'contactado', 'interesado', 'negociacion');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_agenda_citas_sync_prospect on agenda_citas;
create trigger trg_agenda_citas_sync_prospect
after update on agenda_citas
for each row execute function agenda_citas_sync_prospect();

-- ─────────────────────────────────────────────
-- Agendar visita con horarios reales, fase 7 (2026-11-06): solicitudes de visita SIN asesor.
-- · get_visit_slots ahora dice, por cada horario, qué asesores de la propiedad están libres a esa hora
--   (nombre y foto; nada de contacto): la ficha los muestra al elegir la hora.
-- · Si ningún horario le acomoda al visitante (o la propiedad no tiene asesor con horario activo),
--   request_visit deja una SOLICITUD: una cita en estatus 'solicitada', sin asesor (advisor_id null),
--   con el día y la hora que pidió. Aparece en la Agenda de TODOS los asesores (y de administración)
--   hasta que alguien la toma con claim_visit_request: la primera persona que la toma se la queda
--   (queda 'confirmada', con su nombre) y al cliente le llega el correo de confirmación; quien llega
--   segundo recibe 'already_taken'. Mientras tanto el cliente puede cancelarla desde /visita/<token>.
-- · Una solicitud no manda recordatorios, no cuenta como visita agendada en las métricas y no ocupa
--   horario de nadie. Se crea también un contact_message (canal 'visita_solicitud') para reutilizar el
--   aviso por WhatsApp (asesores de la propiedad y oficina) y la notificación push a todo el equipo.
-- · Integridad: una cita sin asesor solo puede ser 'solicitada' o 'cancelada'.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

alter table agenda_citas alter column advisor_id drop not null;

-- Bases anteriores: si agenda_citas ya tenía una columna `status` (con 'pendiente' y sin 'no_asistio' ni
-- 'solicitada'), el "add column if not exists" de arriba no la tocó. 'pendiente' era "por atender": es
-- 'confirmada' en este modelo. También el valor por omisión de las citas capturadas a mano.
alter table agenda_citas drop constraint if exists agenda_citas_status_check;
update agenda_citas set status = 'confirmada' where status = 'pendiente';
alter table agenda_citas alter column status set default 'confirmada';
alter table agenda_citas add constraint agenda_citas_status_check
  check (status in ('confirmada', 'cancelada', 'realizada', 'no_asistio', 'solicitada'));

alter table agenda_citas drop constraint if exists agenda_citas_advisor_required;
alter table agenda_citas add constraint agenda_citas_advisor_required
  check (advisor_id is not null or status in ('solicitada', 'cancelada'));

-- Las solicitudes sin asesor las ve y las puede cancelar cualquiera con el apartado 'agenda'; para tomarlas
-- se usa claim_visit_request (la política de edición no deja que un asesor se asigne una cita ajena).
drop policy if exists "Ver citas propias o todas con agenda" on agenda_citas;
create policy "Ver citas propias o todas con agenda" on agenda_citas for select
  using (has_admin_section('agenda') and (my_advisor_id() is null or my_advisor_id() = advisor_id or (advisor_id is null and status = 'solicitada')));

drop policy if exists "Editar citas propias o todas con agenda" on agenda_citas;
create policy "Editar citas propias o todas con agenda" on agenda_citas for update
  using (has_admin_section('agenda') and (my_advisor_id() is null or my_advisor_id() = advisor_id or (advisor_id is null and status = 'solicitada')))
  with check (has_admin_section('agenda') and (my_advisor_id() is null or my_advisor_id() = advisor_id or (advisor_id is null and status in ('solicitada', 'cancelada'))));

-- ── Público: dejar una solicitud de visita sin asesor ──
-- Errores (jsonb {error}): invalid_name, invalid_email, invalid_phone, invalid_note, invalid_slot
-- (sin fecha u hora, en el pasado o a más de 90 días), property_unavailable, rate_limited, too_many_active.
create or replace function request_visit(
  p_property_id uuid,
  p_fecha date,
  p_hora time,
  p_name text,
  p_email text,
  p_phone text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
  if not found or not prop.active or prop.status = 'vendida' then
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
$$;

revoke all on function request_visit(uuid, date, time, text, text, text, text) from public;
grant execute on function request_visit(uuid, date, time, text, text, text, text) to anon, authenticated;

-- ── Con sesión: tomar una solicitud sin asesor ──
-- Un asesor la toma para sí mismo; administración (acceso sin asesor vinculado) la asigna a p_advisor_id.
-- Errores: not_authorized, advisor_required, invalid_advisor, not_found, already_taken (otro la tomó antes,
-- o el cliente la canceló). Al tomarla queda 'confirmada' (el trigger manda el correo de confirmación al
-- cliente) y el prospecto, si no tenía asesor, pasa a ser de quien la tomó.
create or replace function claim_visit_request(p_cita_id uuid, p_advisor_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  mine uuid := my_advisor_id();
  chosen uuid;
  cita agenda_citas;
  minutes int;
begin
  if not has_admin_section('agenda') then return jsonb_build_object('error', 'not_authorized'); end if;

  chosen := coalesce(mine, p_advisor_id);
  if chosen is null then return jsonb_build_object('error', 'advisor_required'); end if;
  if not exists (select 1 from advisors where id = chosen and active) then return jsonb_build_object('error', 'invalid_advisor'); end if;

  select slot_minutes into minutes from advisor_visit_settings where advisor_id = chosen;

  update agenda_citas
  set advisor_id = chosen,
      status = 'confirmada',
      duracion_min = coalesce(minutes, duracion_min),
      updated_at = now()
  where id = p_cita_id and status = 'solicitada' and advisor_id is null
  returning * into cita;

  if not found then
    if exists (select 1 from agenda_citas where id = p_cita_id) then return jsonb_build_object('error', 'already_taken'); end if;
    return jsonb_build_object('error', 'not_found');
  end if;

  update prospectos set advisor_id = chosen, updated_at = now() where id = cita.prospecto_id and advisor_id is null;

  return jsonb_build_object('ok', true, 'cita_id', cita.id, 'advisor_id', chosen);
end;
$$;

revoke all on function claim_visit_request(uuid, uuid) from public;
grant execute on function claim_visit_request(uuid, uuid) to authenticated;

-- ─────────────────────────────────────────────
-- Agendar visita con horarios reales, fase 8 (2026-11-06): enlace para TODAS las citas.
-- Hasta ahora solo las reservas del sitio tenían enlace /visita/<token>. Ahora toda cita de la Agenda lo
-- tiene —también las que captura el equipo a mano—, para que el asesor se lo mande al cliente por WhatsApp
-- (o lo copie) y el cliente confirme su asistencia, cambie el horario o cancele sin llamar.
-- · agenda_citas.booking_token se llena solo (valor por omisión) y se rellena en las citas que ya existían.
-- · get_booking también responde por esas citas: el nombre sale del cliente ligado, y trae el título y el
--   lugar de la cita (no todas tienen propiedad). Reprogramar solo se ofrece si el asesor tiene horarios en
--   línea (las del sitio siempre). Las citas capturadas a mano NO mandan correo automático.
-- · Cuando el cliente cancela o mueve su cita, el aviso por WhatsApp también le llega al asesor de ESA cita
--   (details.advisor_id del mensaje), no solo a los asesores de la propiedad: una cita capturada a mano
--   puede no tener propiedad.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

alter table agenda_citas alter column booking_token set default replace(gen_random_uuid()::text, '-', '');
update agenda_citas set booking_token = replace(gen_random_uuid()::text, '-', '') where booking_token is null;

create or replace function notify_new_contact_message() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  advisor_phones jsonb := '[]'::jsonb;
  cita_advisor uuid;
  cita_phone text;
begin
  if new.property_id is not null then
    select coalesce(jsonb_agg(numero), '[]'::jsonb) into advisor_phones
    from (
      select coalesce(nullif(btrim(a.whatsapp), ''), nullif(btrim(a.phone), '')) as numero
      from property_advisors pa
      join advisors a on a.id = pa.advisor_id
      where pa.property_id = new.property_id
        and a.active
    ) s
    where numero is not null;
  end if;

  -- Mensajes ligados a una cita (reserva, cambio, solicitud): también va el asesor de la cita.
  if coalesce(new.details ->> 'advisor_id', '') ~ '^[0-9a-f-]{36}$' then
    cita_advisor := (new.details ->> 'advisor_id')::uuid;
    select coalesce(nullif(btrim(a.whatsapp), ''), nullif(btrim(a.phone), '')) into cita_phone
    from advisors a where a.id = cita_advisor and a.active;
    if cita_phone is not null and not advisor_phones ? cita_phone then
      advisor_phones := advisor_phones || to_jsonb(cita_phone);
    end if;
  end if;

  perform net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/mensaje-contacto-whatsapp',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key'),
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'agenda_cron_secret')
    ),
    body := jsonb_build_object(
      'name', new.name,
      'phone', new.phone,
      'message', new.message,
      'advisorPhones', advisor_phones
    )
  );
  return new;
end;
$$;

-- ─────────────────────────────────────────────
-- Selección de propiedades en un solo enlace (2026-11-13)
-- El asesor elige varias propiedades (las que le encajan a un prospecto u otras) y
-- manda UN enlace: /seleccion/<token>, una página pública con todas, el botón de
-- WhatsApp del asesor y «Me interesa» por propiedad. La fila guarda las propiedades,
-- el mensaje y quién la mandó; además cuenta cuándo la abrió el cliente (primera y
-- última vez, y cuántas veces) para el seguimiento: la ficha del prospecto muestra
-- «Abrió la selección» y la línea de tiempo anota el momento.
--
-- Privacidad: el token (32 hex, nunca corto ni adivinable) es la llave; la tabla NO
-- se lee desde fuera (RLS: solo personal con Prospectos o Propiedades, y cada asesor
-- ve las suyas; la oficina ve todas). La página pública llama a selection_open(),
-- security definer, que devuelve solo lo que la página necesita —las propiedades en sí
-- son las mismas que ya lee el sitio público— y anota la apertura. Un enlace
-- vence a los 60 días y el asesor puede desactivarlo (revoked_at).
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

create table if not exists property_selections (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default replace(gen_random_uuid()::text, '-', '')
    check (token ~ '^[0-9a-f]{32}$'),
  title text check (title is null or char_length(title) <= 120),
  note text check (note is null or char_length(note) <= 500),
  property_ids uuid[] not null check (cardinality(property_ids) between 1 and 12),
  advisor_id uuid references advisors(id) on delete set null,
  prospecto_id uuid references prospectos(id) on delete set null,
  created_by text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '60 days',
  first_opened_at timestamptz,
  last_opened_at timestamptz,
  open_count integer not null default 0,
  revoked_at timestamptz
);

create index if not exists idx_property_selections_prospecto on property_selections(prospecto_id);
create index if not exists idx_property_selections_advisor on property_selections(advisor_id, created_at desc);

alter table property_selections enable row level security;

drop policy if exists "Ver selecciones propias o todas" on property_selections;
create policy "Ver selecciones propias o todas" on property_selections for select
  using ((has_admin_section('prospectos') or has_admin_section('propiedades')) and (my_advisor_id() is null or my_advisor_id() = advisor_id));

drop policy if exists "Crear selecciones propias o todas" on property_selections;
create policy "Crear selecciones propias o todas" on property_selections for insert
  with check ((has_admin_section('prospectos') or has_admin_section('propiedades')) and (my_advisor_id() is null or my_advisor_id() = advisor_id));

-- Editar solo sirve para desactivar el enlace (revoked_at): las aperturas las anota selection_open().
drop policy if exists "Editar selecciones propias o todas" on property_selections;
create policy "Editar selecciones propias o todas" on property_selections for update
  using ((has_admin_section('prospectos') or has_admin_section('propiedades')) and (my_advisor_id() is null or my_advisor_id() = advisor_id))
  with check ((has_admin_section('prospectos') or has_admin_section('propiedades')) and (my_advisor_id() is null or my_advisor_id() = advisor_id));

drop policy if exists "Borrar selecciones propias o todas" on property_selections;
create policy "Borrar selecciones propias o todas" on property_selections for delete
  using ((has_admin_section('prospectos') or has_admin_section('propiedades')) and (my_advisor_id() is null or my_advisor_id() = advisor_id));

-- Lo que consulta la página pública /seleccion/<token>. Token que no existe = null (la página
-- muestra «enlace no válido»). `status`: ok | expired | revoked; en los dos últimos no se anota
-- apertura y no hace falta mostrar propiedades, pero sí el asesor para que el cliente le escriba.
-- p_track = false para que el asesor vea la página como el cliente sin contar como apertura.
create or replace function selection_open(p_token text, p_track boolean default true)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  s property_selections%rowtype;
  st text;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{32}$' then
    return null;
  end if;

  select * into s from property_selections where token = p_token;
  if not found then
    return null;
  end if;

  st := case
    when s.revoked_at is not null then 'revoked'
    when s.expires_at < now() then 'expired'
    else 'ok'
  end;

  if st = 'ok' and coalesce(p_track, true) then
    update property_selections
    set open_count = open_count + 1,
        first_opened_at = coalesce(first_opened_at, now()),
        last_opened_at = now()
    where id = s.id;
  end if;

  return jsonb_build_object(
    'status', st,
    'title', s.title,
    'note', s.note,
    'advisor_id', s.advisor_id,
    'property_ids', case when st = 'ok' then to_jsonb(s.property_ids) else '[]'::jsonb end,
    'created_at', s.created_at,
    'expires_at', s.expires_at
  );
end;
$$;

revoke all on function selection_open(text, boolean) from public;
grant execute on function selection_open(text, boolean) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Plano en la ficha (2026-11)
-- ---------------------------------------------------------------------------
-- Imagen del plano de la propiedad que se muestra en la ficha pública. Se
-- publica desde Construcción («Publicar en la ficha») o se sube desde el
-- formulario de la propiedad. Vive en el bucket público `property-images`
-- (mismas políticas de subida que las fotos). Re-ejecutable.
alter table properties add column if not exists floor_plan_url text;

-- ─────────────────────────────────────────────
-- Listado y ficha: próximas visitas, reacciones en la selección e interés en línea (2026-11-17)
--
-- Tres piezas independientes (cada una se puede ignorar sin romper las demás):
--
-- 1. «Visítala mañana» en las tarjetas del listado: next_visit_slots() devuelve, de un golpe
--    para varias propiedades, el primer horario libre de cada una (reusa get_visit_slots).
--
-- 2. «Me gusta / no me gusta» y comentario por propiedad en la selección que manda el asesor
--    (/seleccion/<token>): property_selections.reactions (jsonb) + selection_react(). El
--    cliente solo puede reaccionar a las propiedades de SU selección, mientras el enlace
--    esté vigente. selection_open() ahora también devuelve las reacciones.
--
-- 3. Interés en línea en el informe del vendedor: property_events cuenta cuántas personas
--    guardaron la propiedad en favoritos y cuántas veces se compartió (las vistas ya las
--    cuenta property_views); _visit_report_payload() suma el resumen en `interest`. Solo se
--    publican cifras agregadas; las filas crudas (quién y cuándo) no las lee nadie con anon
--    ni authenticated, igual que property_views.
--
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor; necesita que antes
--  estén "Agendar visita con horarios reales", "Selección de propiedades en un solo enlace"
--  y "property_views")
-- ─────────────────────────────────────────────

-- ── 1. Próximo horario libre de varias propiedades ──
-- Como mucho 48 propiedades por llamada y 14 días de horizonte. Una propiedad sin horarios
-- (sin asesor con reserva activa, vendida, inactiva…) simplemente no sale en el resultado.
create or replace function next_visit_slots(p_property_ids uuid[], p_days int default 7)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  pid uuid;
  first_slot jsonb;
  result jsonb := '[]'::jsonb;
begin
  if p_property_ids is null then
    return result;
  end if;
  foreach pid in array p_property_ids[1:48] loop
    continue when pid is null;
    first_slot := (get_visit_slots(pid, null, least(greatest(coalesce(p_days, 7), 1), 14)) -> 'slots') -> 0;
    if first_slot is not null then
      result := result || jsonb_build_array(jsonb_build_object('property_id', pid, 'fecha', first_slot ->> 'fecha', 'hora', first_slot ->> 'hora'));
    end if;
  end loop;
  return result;
end;
$$;

revoke all on function next_visit_slots(uuid[], int) from public;
grant execute on function next_visit_slots(uuid[], int) to anon, authenticated;

-- ── 2. Reacciones del cliente en una selección ──
-- reactions = { "<property_id>": { "r": "like" | "dislike" | null, "c": "comentario" | null, "at": "…" } }
alter table property_selections add column if not exists reactions jsonb not null default '{}'::jsonb;

-- Errores (jsonb {error}): unavailable (enlace inexistente, vencido o desactivado),
-- invalid_property, invalid_reaction, invalid_comment. Sin reacción ni comentario = borra la entrada.
create or replace function selection_react(p_token text, p_property_id uuid, p_reaction text, p_comment text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  s property_selections%rowtype;
  cleaned text := nullif(btrim(coalesce(p_comment, '')), '');
  next_reactions jsonb;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{32}$' then
    return jsonb_build_object('error', 'unavailable');
  end if;
  select * into s from property_selections where token = p_token;
  if not found or s.revoked_at is not null or s.expires_at < now() then
    return jsonb_build_object('error', 'unavailable');
  end if;
  if p_property_id is null or not (p_property_id = any (s.property_ids)) then
    return jsonb_build_object('error', 'invalid_property');
  end if;
  if p_reaction is not null and p_reaction not in ('like', 'dislike') then
    return jsonb_build_object('error', 'invalid_reaction');
  end if;
  if cleaned is not null and char_length(cleaned) > 300 then
    return jsonb_build_object('error', 'invalid_comment');
  end if;

  if p_reaction is null and cleaned is null then
    next_reactions := s.reactions - p_property_id::text;
  else
    next_reactions := jsonb_set(
      s.reactions,
      array[p_property_id::text],
      jsonb_build_object('r', p_reaction, 'c', cleaned, 'at', now())
    );
  end if;
  update property_selections set reactions = next_reactions where id = s.id;
  return jsonb_build_object('ok', true, 'reactions', next_reactions);
end;
$$;

revoke all on function selection_react(text, uuid, text, text) from public;
grant execute on function selection_react(text, uuid, text, text) to anon, authenticated;

-- Misma función de siempre, ahora con las reacciones.
create or replace function selection_open(p_token text, p_track boolean default true)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  s property_selections%rowtype;
  st text;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{32}$' then
    return null;
  end if;

  select * into s from property_selections where token = p_token;
  if not found then
    return null;
  end if;

  st := case
    when s.revoked_at is not null then 'revoked'
    when s.expires_at < now() then 'expired'
    else 'ok'
  end;

  if st = 'ok' and coalesce(p_track, true) then
    update property_selections
    set open_count = open_count + 1,
        first_opened_at = coalesce(first_opened_at, now()),
        last_opened_at = now()
    where id = s.id;
  end if;

  return jsonb_build_object(
    'status', st,
    'title', s.title,
    'note', s.note,
    'advisor_id', s.advisor_id,
    'property_ids', case when st = 'ok' then to_jsonb(s.property_ids) else '[]'::jsonb end,
    'created_at', s.created_at,
    'expires_at', s.expires_at,
    'reactions', case when st = 'ok' then s.reactions else '{}'::jsonb end
  );
end;
$$;

revoke all on function selection_open(text, boolean) from public;
grant execute on function selection_open(text, boolean) to anon, authenticated;

-- ── 3. Interés en línea: favoritos y veces compartida ──
create table if not exists property_events (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  visitor_id uuid not null,
  kind text not null check (kind in ('favorite', 'share')),
  event_on date not null default current_date,
  created_at timestamptz not null default now(),
  unique (property_id, visitor_id, kind, event_on)
);

create index if not exists idx_property_events_property on property_events(property_id, kind);

-- Sin políticas: nadie con anon/authenticated lee ni escribe la tabla directo.
alter table property_events enable row level security;

-- Una vez por visitante, evento y día (recargar o volver a tocar no infla la cifra). Una propiedad
-- que no existe o no está publicada se ignora sin error.
create or replace function track_property_event(p_property_id uuid, p_visitor_id uuid, p_kind text)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if p_kind is null or p_kind not in ('favorite', 'share') or p_visitor_id is null then
    return;
  end if;
  if not exists (select 1 from properties where id = p_property_id and active) then
    return;
  end if;
  insert into property_events (property_id, visitor_id, kind)
  values (p_property_id, p_visitor_id, p_kind)
  on conflict (property_id, visitor_id, kind, event_on) do nothing;
end;
$$;

revoke all on function track_property_event(uuid, uuid, text) from public;
grant execute on function track_property_event(uuid, uuid, text) to anon, authenticated;

-- El informe del vendedor, ahora con `interest`: vistas de la ficha (una por persona y día),
-- personas distintas, personas distintas en los últimos 7 días, personas que la guardaron en
-- favoritos y veces que se compartió. Mismos campos de siempre; solo se agrega ese objeto.
create or replace function _visit_report_payload(p_property_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'property', jsonb_build_object(
      'title', p.title,
      'code', p.code,
      'zone', p.zone,
      'status', p.status,
      'created_at', p.created_at,
      'main_image', p.main_image
    ),
    'sold_on', case when p.status = 'vendida' then (select v.fecha_venta from ventas v where v.property_id = p.id) end,
    'visits', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'visited_at', pv.visited_at,
          'interest', pv.interest,
          'reasons', to_jsonb(pv.reasons),
          'comments', nullif(btrim(pv.comments), '')
        )
        order by pv.visited_at desc
      )
      from property_visits pv
      where pv.property_id = p.id
    ), '[]'::jsonb),
    'interest', jsonb_build_object(
      'views', (select count(*) from property_views pv2 where pv2.property_id = p.id),
      'unique_visitors', (select count(distinct pv2.visitor_id) from property_views pv2 where pv2.property_id = p.id),
      'views_7d', (select count(distinct pv2.visitor_id) from property_views pv2 where pv2.property_id = p.id and pv2.viewed_on > current_date - 7),
      'favorites', (select count(distinct pe.visitor_id) from property_events pe where pe.property_id = p.id and pe.kind = 'favorite'),
      'shares', (select count(*) from property_events pe where pe.property_id = p.id and pe.kind = 'share')
    )
  )
  from properties p
  where p.id = p_property_id;
$$;

-- ─────────────────────────────────────────────
-- Avisos por correo al cliente del portal (2026-11-17)
--
-- Dos avisos automáticos para el cliente que tiene portal (/documentos/<token>):
--  · «Tu trámite avanzó»: cuando el asesor cambia la etapa del trámite, un trigger llama a la Edge
--    Function portal-avisos (pg_net), que le manda el correo.
--  · Recordatorios de documentos pendientes: pg_cron llama a esa misma función una vez al día
--    (10:30 hora de México); manda a lo más 3 recordatorios, uno cada 7 días como máximo, y solo si
--    todavía le falta algo por subir o corregir.
--
-- Son OPT-IN por cliente: el asesor los activa con «Avisar por correo» en el trámite del cliente
-- (client_tramites.notify_client, apagado por omisión), y solo se manda a quien tiene correo y un
-- enlace de portal vigente. Cada aviso se «reclama» en la base antes de enviarse (las funciones
-- portal_claim_*), así que dos corridas o un reintento nunca lo duplican.
--
-- Despliegue (en este orden):
--   1. Correr este bloque (re-ejecutable).
--   2. Desplegar la función:  supabase functions deploy portal-avisos --no-verify-jwt
--      (valida con su propio x-cron-secret, igual que visita-correo). Usa los secretos que ya existen:
--      CRON_SECRET, RESEND_API_KEY y, si los tienes, RESEND_FROM y SITE_URL.
--   3. Necesita los secretos de Vault que ya usan las demás funciones: project_url, publishable_key y
--      agenda_cron_secret.
-- (bloque re-ejecutable: cron.schedule con un nombre que ya existe actualiza ese job; necesita antes
--  el bloque «Portal del cliente: más documentos, lista de pendientes y estatus del trámite»)
-- ─────────────────────────────────────────────

alter table client_tramites add column if not exists notify_client boolean not null default false;
alter table client_tramites add column if not exists last_reminder_at timestamptz;
alter table client_tramites add column if not exists reminder_count integer not null default 0;
alter table client_tramites add column if not exists last_notified_stage text;

-- Los recordatorios empiezan de cero al activar los avisos, y al cambiar de etapa se espera una semana
-- (el cliente acaba de recibir el aviso de la etapa nueva).
create or replace function client_tramite_reset_reminders()
returns trigger
language plpgsql
as $$
begin
  if new.notify_client and not old.notify_client then
    new.reminder_count := 0;
    new.last_reminder_at := null;
  elsif new.stage is distinct from old.stage then
    new.reminder_count := 0;
    new.last_reminder_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_client_tramite_reset_reminders on client_tramites;
create trigger trg_client_tramite_reset_reminders
before update on client_tramites
for each row execute function client_tramite_reset_reminders();

-- Cambio de etapa con avisos activados → portal-avisos (si no se puede encolar, el cambio de etapa se
-- guarda igual: solo se pierde el aviso).
create or replace function notify_client_stage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not new.notify_client or new.stage is not distinct from old.stage then
    return new;
  end if;
  begin
    perform net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/portal-avisos',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key'),
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'agenda_cron_secret')
      ),
      body := jsonb_build_object('kind', 'etapa', 'client_id', new.client_id)
    );
  exception when others then
    raise warning 'notify_client_stage: no se pudo encolar el aviso del cliente %: %', new.client_id, sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists trg_client_tramite_notify on client_tramites;
create trigger trg_client_tramite_notify
after update of stage on client_tramites
for each row execute function notify_client_stage();

-- «Reclamos»: solo los usa la Edge Function (service_role); nadie más puede llamarlos.
-- Aviso de etapa: true si esta llamada lo reclamó (esa etapa aún no se había avisado).
create or replace function portal_claim_stage_notice(p_client_id uuid, p_stage text)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  changed integer;
begin
  update client_tramites
  set last_notified_stage = p_stage
  where client_id = p_client_id and notify_client and stage = p_stage and last_notified_stage is distinct from p_stage;
  get diagnostics changed = row_count;
  return changed > 0;
end;
$$;

-- Recordatorio: { claimed, prev_at, prev_count }. No se reclama con avisos apagados, con el máximo ya
-- mandado ni antes de que pasen p_min_days desde el último. prev_* sirven para liberarlo si falla el envío.
create or replace function portal_claim_reminder(p_client_id uuid, p_min_days integer default 7, p_max integer default 3)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  prev record;
begin
  select last_reminder_at, reminder_count into prev
  from client_tramites
  where client_id = p_client_id and notify_client
  for update;
  if not found
     or prev.reminder_count >= p_max
     or (prev.last_reminder_at is not null and prev.last_reminder_at > now() - make_interval(days => p_min_days)) then
    return jsonb_build_object('claimed', false);
  end if;
  update client_tramites set last_reminder_at = now(), reminder_count = reminder_count + 1 where client_id = p_client_id;
  return jsonb_build_object('claimed', true, 'prev_at', prev.last_reminder_at, 'prev_count', prev.reminder_count);
end;
$$;

create or replace function portal_release_reminder(p_client_id uuid, p_prev_at timestamptz, p_prev_count integer)
returns void
language sql
volatile
security definer
set search_path = public
as $$
  update client_tramites set last_reminder_at = p_prev_at, reminder_count = coalesce(p_prev_count, 0) where client_id = p_client_id;
$$;

revoke all on function portal_claim_stage_notice(uuid, text) from public, anon, authenticated;
revoke all on function portal_claim_reminder(uuid, integer, integer) from public, anon, authenticated;
revoke all on function portal_release_reminder(uuid, timestamptz, integer) from public, anon, authenticated;
grant execute on function portal_claim_stage_notice(uuid, text) to service_role;
grant execute on function portal_claim_reminder(uuid, integer, integer) to service_role;
grant execute on function portal_release_reminder(uuid, timestamptz, integer) to service_role;

-- Recordatorios: una vez al día a las 10:30 hora de México (16:30 UTC; México ya no cambia de horario).
select cron.schedule(
  'portal-recordatorios',
  '30 16 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/portal-avisos',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key'),
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'agenda_cron_secret')
    ),
    body := jsonb_build_object('kind', 'recordatorios')
  );
  $$
);

-- ─────────────────────────────────────────────
-- Encuesta tras la visita y vendidas recientes con sus días (2026-11-17)
--
-- 1. «Vendidas recientemente» del inicio: public_sales_stats() ahora devuelve también `recent_sold`
--    ([{ property_id, days }]) para mostrar «Vendida en N días». Mismas reglas que el promedio: una venta
--    registrada el mismo día del alta (o antes) lleva days = null, nunca «0 días».
--
-- 2. Encuesta tras la visita: cuando el asesor marca «Realizada» una visita reservada desde el sitio (con
--    correo), el trigger de correo manda «¿Cómo te fue?» (visita-correo, kind 'encuesta') con el enlace
--    /opinion/<booking_token>. El cliente califica de 1 a 5 y puede dejar un comentario (máx. 500); una sola
--    respuesta por visita. get_visit_survey() y submit_visit_feedback() son públicas y se guían por el
--    mismo token de la visita; las respuestas (visit_feedback) solo las leen el asesor de esa visita y la
--    oficina (RLS). El correo se «reclama» (visit_claim_survey, solo service_role): marcar «Realizada» más de
--    una vez no lo manda otra vez.
--
-- Despliegue: correr este bloque (re-ejecutable) y volver a desplegar la función visita-correo
--   (supabase functions deploy visita-correo --no-verify-jwt). Sin eso, todo sigue como antes.
-- (bloque re-ejecutable: necesita antes "Agendar visita con horarios reales")
-- ─────────────────────────────────────────────

-- ── 1. Vendidas recientes con sus días ──
create or replace function public_sales_stats() returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'total', count(*),
    'last_12_months', count(*) filter (where v.fecha_venta >= current_date - 365),
    'avg_days_to_sell', round(avg(v.fecha_venta - p.created_at::date) filter (where v.fecha_venta - p.created_at::date > 0)),
    'recent_sold', coalesce((
      select jsonb_agg(jsonb_build_object('property_id', r.property_id, 'days', case when r.days > 0 then r.days end) order by r.fecha_venta desc)
      from (
        select v3.property_id, v3.fecha_venta, (v3.fecha_venta - p3.created_at::date) as days
        from ventas v3
        join properties p3 on p3.id = v3.property_id
        where p3.active
        order by v3.fecha_venta desc
        limit 6
      ) r
    ), '[]'::jsonb),
    'recent_property_ids', coalesce((
      select jsonb_agg(r.property_id)
      from (
        select v2.property_id
        from ventas v2
        join properties p2 on p2.id = v2.property_id
        where p2.active
        order by v2.fecha_venta desc
        limit 6
      ) r
    ), '[]'::jsonb)
  )
  from ventas v
  join properties p on p.id = v.property_id;
$$;

revoke all on function public_sales_stats() from public;
grant execute on function public_sales_stats() to anon, authenticated;

-- ── 2. Encuesta tras la visita ──
alter table agenda_citas add column if not exists survey_sent_at timestamptz;

create table if not exists visit_feedback (
  id uuid primary key default gen_random_uuid(),
  cita_id uuid not null unique references agenda_citas(id) on delete cascade,
  property_id uuid references properties(id) on delete set null,
  advisor_id uuid references advisors(id) on delete set null,
  rating smallint not null check (rating between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 500),
  created_at timestamptz not null default now()
);

create index if not exists idx_visit_feedback_advisor on visit_feedback(advisor_id, created_at desc);

alter table visit_feedback enable row level security;

-- Solo lectura para el personal (el asesor de la visita, o la oficina). Nadie escribe directo: se hace por submit_visit_feedback().
drop policy if exists "Ver opiniones de visitas propias o todas con agenda" on visit_feedback;
create policy "Ver opiniones de visitas propias o todas con agenda" on visit_feedback for select
  using (has_admin_section('agenda') and (my_advisor_id() is null or my_advisor_id() = advisor_id));

-- Lo que consulta /opinion/<token>. status: invalido | ok | respondida | no_disponible (la visita aún no es «realizada»).
create or replace function get_visit_survey(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  c agenda_citas;
  prop properties;
  answered boolean;
begin
  select * into c from agenda_citas where booking_token = p_token and p_token ~ '^[0-9a-f]{32}$';
  if not found then
    return jsonb_build_object('status', 'invalido');
  end if;
  select * into prop from properties where id = c.property_id;
  select exists (select 1 from visit_feedback where cita_id = c.id) into answered;
  return jsonb_build_object(
    'status', case when answered then 'respondida' when c.status = 'realizada' then 'ok' else 'no_disponible' end,
    'fecha', c.fecha,
    'property', case when prop.id is null then null else jsonb_build_object('title', prop.title, 'code', prop.code) end
  );
end;
$$;

-- Errores (jsonb {error}): invalid (token), not_ready, invalid_rating, invalid_comment, already_answered.
create or replace function submit_visit_feedback(p_token text, p_rating integer, p_comment text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  c agenda_citas;
  cleaned text := nullif(btrim(coalesce(p_comment, '')), '');
  inserted integer;
begin
  select * into c from agenda_citas where booking_token = p_token and p_token ~ '^[0-9a-f]{32}$';
  if not found then return jsonb_build_object('error', 'invalid'); end if;
  if c.status <> 'realizada' then return jsonb_build_object('error', 'not_ready'); end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then return jsonb_build_object('error', 'invalid_rating'); end if;
  if cleaned is not null and char_length(cleaned) > 500 then return jsonb_build_object('error', 'invalid_comment'); end if;

  insert into visit_feedback (cita_id, property_id, advisor_id, rating, comment)
  values (c.id, c.property_id, c.advisor_id, p_rating, cleaned)
  on conflict (cita_id) do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then return jsonb_build_object('error', 'already_answered'); end if;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function get_visit_survey(text) from public;
revoke all on function submit_visit_feedback(text, integer, text) from public;
grant execute on function get_visit_survey(text) to anon, authenticated;
grant execute on function submit_visit_feedback(text, integer, text) to anon, authenticated;

-- «Reclamo» del correo de la encuesta: true solo la primera vez (solo la usa la Edge Function, con service_role).
create or replace function visit_claim_survey(p_cita_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  changed integer;
begin
  update agenda_citas set survey_sent_at = now() where id = p_cita_id and status = 'realizada' and survey_sent_at is null;
  get diagnostics changed = row_count;
  return changed > 0;
end;
$$;

revoke all on function visit_claim_survey(uuid) from public, anon, authenticated;
grant execute on function visit_claim_survey(uuid) to service_role;

-- El trigger de correo de visitas, ahora también con la encuesta al marcar «Realizada».
create or replace function notify_visit_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  kind text;
begin
  -- Solo reservas del sitio con correo. Las citas que crea el equipo a mano no mandan correo.
  if new.source is distinct from 'sitio' or coalesce(trim(new.contact_email), '') = '' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    kind := case when new.status = 'solicitada' then 'solicitud' else 'confirmacion' end;
  elsif old.status is distinct from 'realizada' and new.status = 'realizada' then
    kind := 'encuesta'; -- el asesor marcó la visita como realizada: se le pide su opinión
  elsif old.status in ('confirmada', 'solicitada') and new.status = 'cancelada' then
    kind := 'cancelacion';
  elsif old.status in ('cancelada', 'solicitada') and new.status = 'confirmada' then
    kind := 'confirmacion'; -- el asesor reactivó una visita cancelada o tomó una solicitud sin asesor
  elsif new.status = 'confirmada' and (new.fecha is distinct from old.fecha or new.hora is distinct from old.hora) then
    kind := 'reprogramada';
  else
    return new;
  end if;

  begin
    perform net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/visita-correo',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key'),
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'agenda_cron_secret')
      ),
      body := jsonb_build_object('cita_id', new.id, 'kind', kind)
    );
  exception when others then
    raise warning 'notify_visit_email: no se pudo encolar el correo (%) de la cita %: %', kind, new.id, sqlerrm;
  end;

  return new;
end;
$$;

-- ─────────────────────────────────────────────
-- Ofertas y apartados por propiedad, y calendario suscribible de la Agenda (2026-11-17)
--
-- 1. property_offers: ofertas del cliente y contraofertas del propietario por propiedad (quién, cuánto, nota y
--    estado). Solo la ve y la maneja quien tiene el apartado Propiedades o Naves (mismo permiso que la propiedad).
-- 2. property_holds: apartados (monto, fecha límite, estado). A lo mucho UNO vigente por propiedad (índice
--    único parcial). El aviso de «por vencer» y «vencido» se calcula con la fecha: nada cambia solo en la base.
-- 3. agenda_feed_tokens + create_agenda_feed_token() + get_agenda_feed(): una URL secreta por persona del equipo
--    para suscribir la Agenda en Google/Apple/Outlook (SOLO lectura, un sentido: el calendario externo no
--    escribe en el sitio). El token es un secreto: quien tenga la URL ve las citas de esa persona; se puede
--    regenerar para invalidar la anterior. No expone teléfonos ni correos de clientes.

create table if not exists property_offers (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  party text not null check (party in ('cliente', 'propietario')),
  buyer_name text not null check (char_length(btrim(buyer_name)) between 1 and 120),
  amount numeric not null check (amount > 0),
  note text check (note is null or char_length(note) <= 300),
  status text not null default 'abierta' check (status in ('abierta', 'aceptada', 'rechazada', 'retirada')),
  created_by text default auth.email(),
  created_at timestamptz not null default now()
);

create index if not exists idx_property_offers_property on property_offers(property_id, created_at desc);

alter table property_offers enable row level security;

drop policy if exists "Rol con apartado propiedades o naves maneja property_offers" on property_offers;
create policy "Rol con apartado propiedades o naves maneja property_offers" on property_offers for all
  using (has_admin_section('propiedades') or has_admin_section('naves_industriales'))
  with check (has_admin_section('propiedades') or has_admin_section('naves_industriales'));

create table if not exists property_holds (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  advisor_id uuid references advisors(id) on delete set null default my_advisor_id(),
  buyer_name text not null check (char_length(btrim(buyer_name)) between 1 and 120),
  buyer_phone text check (buyer_phone is null or char_length(buyer_phone) <= 30),
  amount numeric not null check (amount >= 0),
  due_date date not null,
  note text check (note is null or char_length(note) <= 300),
  status text not null default 'vigente' check (status in ('vigente', 'concretado', 'cancelado')),
  created_by text default auth.email(),
  created_at timestamptz not null default now()
);

create index if not exists idx_property_holds_property on property_holds(property_id, created_at desc);
create index if not exists idx_property_holds_due on property_holds(due_date) where status = 'vigente';
-- Una propiedad no se aparta dos veces a la vez.
create unique index if not exists uniq_property_holds_vigente on property_holds(property_id) where status = 'vigente';

alter table property_holds enable row level security;

drop policy if exists "Rol con apartado propiedades o naves maneja property_holds" on property_holds;
create policy "Rol con apartado propiedades o naves maneja property_holds" on property_holds for all
  using (has_admin_section('propiedades') or has_admin_section('naves_industriales'))
  with check (has_admin_section('propiedades') or has_admin_section('naves_industriales'));

create table if not exists agenda_feed_tokens (
  email text primary key,
  advisor_id uuid references advisors(id) on delete cascade,
  token text not null unique check (token ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

alter table agenda_feed_tokens enable row level security;

-- Cada quien ve (y solo ve) su propio registro; nadie escribe directo: se hace por create_agenda_feed_token().
drop policy if exists "Ver mi propio token de calendario" on agenda_feed_tokens;
create policy "Ver mi propio token de calendario" on agenda_feed_tokens for select
  using (email = auth.email());

-- Crea o REGENERA el token de quien llama (la URL anterior deja de servir). Requiere el apartado Agenda.
create or replace function create_agenda_feed_token()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  new_token text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
begin
  if auth.email() is null or not has_admin_section('agenda') then
    raise exception 'No tienes acceso a la Agenda' using errcode = '42501';
  end if;
  insert into agenda_feed_tokens (email, advisor_id, token)
  values (auth.email(), my_advisor_id(), new_token)
  on conflict (email) do update set token = excluded.token, advisor_id = excluded.advisor_id, created_at = now();
  return new_token;
end;
$$;

revoke all on function create_agenda_feed_token() from public, anon;
grant execute on function create_agenda_feed_token() to authenticated;

-- Lo que lee /api/agenda-ics con el token: las citas confirmadas de esa persona (o todas, si es de oficina) de la
-- última semana en adelante. Sin teléfonos ni correos del cliente. Token inválido → arreglo vacío (no revela nada).
create or replace function get_agenda_feed(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  t agenda_feed_tokens;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return '[]'::jsonb;
  end if;
  select * into t from agenda_feed_tokens where token = p_token;
  if not found then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id, 'titulo', c.titulo, 'fecha', c.fecha, 'hora', c.hora,
      'duracion_min', c.duracion_min, 'lugar', c.lugar, 'actividades', c.actividades
    ) order by c.fecha, c.hora)
    from (
      select * from agenda_citas
      where status = 'confirmada'
        and fecha >= current_date - 7
        and (t.advisor_id is null or advisor_id = t.advisor_id)
      order by fecha, hora
      limit 1000
    ) c
  ), '[]'::jsonb);
end;
$$;

revoke all on function get_agenda_feed(text) from public;
grant execute on function get_agenda_feed(text) to anon, authenticated;

-- ─────────────────────────────────────────────
-- Contratos de intermediación, comisiones por asesor y fusión de prospectos (2026-11-17)
--
-- 1. property_contracts: tipo (exclusiva o abierta) y fecha de vencimiento del contrato con el propietario, para
--    avisar antes de que venza. Va en una tabla APARTE de properties a propósito: properties se lee en público
--    (cualquiera puede consultarla), y esto es interno. Solo el personal con el apartado Propiedades o Naves.
-- 2. commissions: comisión de cada asesor por propiedad y concepto (captación o venta), con su estado
--    (pendiente o pagada) y la fecha de pago. Confidencial como las liquidaciones: la manejan solo los dos
--    socios; cada asesor puede LEER las suyas (no las de otros).
-- 3. merge_prospects(): fusiona dos prospectos duplicados en uno, sin perder su historia (etapas, contactos,
--    citas, selecciones y notas internas pasan al que se conserva).
-- 4. team_leaderboard(): lo que lleva cada asesor ACTIVO en el mes (contactos, visitas, prospectos captados, ventas) y
--    cuántas de sus metas ha cumplido, para la tabla de posiciones. Solo CONTEOS (nada de nombres de clientes ni
--    montos); las metas no se revelan, solo cuántas van cumplidas. Cualquier persona del equipo con Prospectos o Agenda.

create table if not exists property_contracts (
  property_id uuid primary key references properties(id) on delete cascade,
  kind text not null check (kind in ('exclusiva', 'abierta')),
  expires_on date not null,
  note text check (note is null or char_length(note) <= 300),
  updated_by text default auth.email(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_property_contracts_expires on property_contracts(expires_on);

alter table property_contracts enable row level security;

drop policy if exists "Rol con apartado propiedades o naves maneja property_contracts" on property_contracts;
create policy "Rol con apartado propiedades o naves maneja property_contracts" on property_contracts for all
  using (has_admin_section('propiedades') or has_admin_section('naves_industriales'))
  with check (has_admin_section('propiedades') or has_admin_section('naves_industriales'));

create table if not exists commissions (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  advisor_id uuid not null references advisors(id) on delete cascade,
  concept text not null check (concept in ('captacion', 'venta')),
  amount numeric not null check (amount >= 0),
  status text not null default 'pendiente' check (status in ('pendiente', 'pagada')),
  paid_on date,
  note text check (note is null or char_length(note) <= 300),
  updated_by text default auth.email(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (property_id, concept),
  -- Una comisión pagada lleva su fecha de pago; una pendiente no.
  constraint commissions_paid_has_date check ((status = 'pagada') = (paid_on is not null))
);

create index if not exists idx_commissions_advisor on commissions(advisor_id, status);

alter table commissions enable row level security;

drop policy if exists "Solo socios manejan commissions" on commissions;
create policy "Solo socios manejan commissions" on commissions for all
  using (auth.email() in ('inmobiliaria@aclpropiedades.com', 'mh@aclpropiedades.com'))
  with check (auth.email() in ('inmobiliaria@aclpropiedades.com', 'mh@aclpropiedades.com'));

drop policy if exists "Cada asesor lee sus commissions" on commissions;
create policy "Cada asesor lee sus commissions" on commissions for select
  using (advisor_id = my_advisor_id());

-- Fusiona p_remove dentro de p_keep (el que se conserva) y borra p_remove. Quien llama debe tener el apartado
-- Prospectos y, si es un asesor (no la oficina), ser dueño de los dos. Lo que el prospecto conservado ya tiene se
-- respeta; los huecos (teléfono, correo, qué busca, propiedad, visita, asesor) se llenan con los del otro; las
-- notas se juntan; la etapa es la más avanzada (perdido es la más baja); el seguimiento, el más próximo.
create or replace function merge_prospects(p_keep uuid, p_remove uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  k prospectos;
  r prospectos;
  me uuid := my_advisor_id();
  ranks text[] := array['perdido', 'nuevo', 'contactado', 'interesado', 'negociacion', 'cerrado'];
  new_stage text;
  merged_notes text;
begin
  if auth.email() is null or not has_admin_section('prospectos') then
    raise exception 'No tienes acceso a Prospectos' using errcode = '42501';
  end if;
  if p_keep is null or p_remove is null or p_keep = p_remove then
    return jsonb_build_object('error', 'invalid');
  end if;

  select * into k from prospectos where id = p_keep for update;
  if not found then return jsonb_build_object('error', 'not_found'); end if;
  select * into r from prospectos where id = p_remove for update;
  if not found then return jsonb_build_object('error', 'not_found'); end if;

  if me is not null and (k.advisor_id is distinct from me or r.advisor_id is distinct from me) then
    return jsonb_build_object('error', 'forbidden');
  end if;

  new_stage := case when array_position(ranks, r.stage) > array_position(ranks, k.stage) then r.stage else k.stage end;
  merged_notes := nullif(concat_ws(E'\n\n',
    nullif(btrim(coalesce(k.notes, '')), ''),
    case when nullif(btrim(coalesce(r.notes, '')), '') is not null then 'Fusionado con «' || r.name || '»: ' || btrim(r.notes) end
  ), '');

  -- visit_id es único: se libera en el que se borra antes de pasárselo al que se conserva.
  if r.visit_id is not null then
    update prospectos set visit_id = null where id = r.id;
  end if;

  update prospectos set
    phone = coalesce(nullif(btrim(coalesce(k.phone, '')), ''), r.phone),
    email = coalesce(nullif(btrim(coalesce(k.email, '')), ''), r.email),
    looking_for = coalesce(nullif(btrim(coalesce(k.looking_for, '')), ''), r.looking_for),
    property_id = coalesce(k.property_id, r.property_id),
    visit_id = coalesce(k.visit_id, r.visit_id),
    advisor_id = coalesce(k.advisor_id, r.advisor_id),
    notes = merged_notes,
    stage = new_stage,
    lost_reason = case when new_stage = 'perdido' then coalesce(k.lost_reason, r.lost_reason) else null end,
    last_contact_at = greatest(k.last_contact_at, r.last_contact_at),
    next_followup_at = least(k.next_followup_at, r.next_followup_at),
    created_at = least(k.created_at, r.created_at),
    updated_at = now()
  where id = k.id;

  update prospecto_etapas set prospecto_id = k.id where prospecto_id = r.id;
  update prospecto_contactos set prospecto_id = k.id where prospecto_id = r.id;
  update agenda_citas set prospecto_id = k.id where prospecto_id = r.id;
  update property_selections set prospecto_id = k.id where prospecto_id = r.id;
  update internal_notes set entity_id = k.id where entity_type = 'prospect' and entity_id = r.id;

  delete from prospectos where id = r.id;
  return jsonb_build_object('ok', true, 'kept', k.id);
end;
$$;

revoke all on function merge_prospects(uuid, uuid) from public, anon;
grant execute on function merge_prospects(uuid, uuid) to authenticated;

create or replace function team_leaderboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  month_start timestamptz := date_trunc('month', now());
begin
  if auth.email() is null or not (has_admin_section('prospectos') or has_admin_section('agenda')) then
    raise exception 'No tienes acceso al equipo' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(to_jsonb(r) order by r.name)
    from (
      select
        a.id as advisor_id,
        a.name,
        c.contacts, v.visits, p.new_prospects, s.sales,
        coalesce((g.contacts > 0)::int + (g.visits > 0)::int + (g.new_prospects > 0)::int + (g.sales > 0)::int, 0) as goals_set,
        coalesce((g.contacts > 0 and c.contacts >= g.contacts)::int + (g.visits > 0 and v.visits >= g.visits)::int
          + (g.new_prospects > 0 and p.new_prospects >= g.new_prospects)::int + (g.sales > 0 and s.sales >= g.sales)::int, 0) as goals_met
      from advisors a
      left join advisor_goals g on g.advisor_id = a.id
      cross join lateral (select count(*)::int as contacts from prospecto_contactos pc join prospectos pr on pr.id = pc.prospecto_id where pr.advisor_id = a.id and pc.at >= month_start) c
      cross join lateral (select count(*)::int as visits from property_visits pv where pv.advisor_id = a.id and pv.visited_at >= month_start) v
      cross join lateral (select count(*)::int as new_prospects from prospectos pr where pr.advisor_id = a.id and pr.created_at >= month_start) p
      cross join lateral (select count(*)::int as sales from ventas ve where ve.advisor_id = a.id and ve.fecha_venta >= month_start::date) s
      where a.active
    ) r
  ), '[]'::jsonb);
end;
$$;

revoke all on function team_leaderboard() from public, anon;
grant execute on function team_leaderboard() to authenticated;

-- ─────────────────────────────────────────────
-- Freno de envíos públicos en el servidor (2026-11-18)
-- Hasta ahora el freno del formulario de contacto (campo trampa y espera de 60 s) vivía solo en el navegador: quien
-- llamara a la API directo podía mandar mensajes sin límite (cada uno dispara un aviso por WhatsApp). Ahora la base
-- cuenta los envíos anónimos por conexión (IP) y en total, y rechaza el exceso. Aplica a:
--   · contact_messages (formulario de Contacto, solicitudes de visita y de información) — 10 por hora por IP, 200 por hora en total
--   · property_alerts  (suscripción a avisos, que manda correos/WhatsApp a terceros)    — 10 por hora por IP, 100 por hora en total
-- Solo cuenta a quien entra como anónimo (rol «anon»): el personal con sesión, el SQL Editor y las funciones del
-- servidor (service role) no se frenan. Las reservas de visita ya tenían su propio freno (visit_booking_attempts).
-- Limitaciones (a propósito): quien rote de IP puede seguir mandando hasta el tope global; y detrás de una misma red
-- (oficina, datos móviles compartidos) varias personas comparten el cupo. Para frenar bots de verdad (no solo exceso)
-- el siguiente paso sería Cloudflare Turnstile, que necesita una cuenta y llaves propias.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

create table if not exists public_rate_hits (
  id bigserial primary key,
  bucket text not null,
  ip text,
  created_at timestamptz not null default now()
);
create index if not exists idx_public_rate_hits_bucket_ip on public_rate_hits(bucket, ip, created_at desc);
create index if not exists idx_public_rate_hits_bucket_time on public_rate_hits(bucket, created_at desc);

-- Sin políticas: solo las funciones de abajo (security definer) leen y escriben.
alter table public_rate_hits enable row level security;

-- IP de quien llama, tal como la reporta el proxy de Supabase (primer valor de x-forwarded-for). null si no hay.
create or replace function request_client_ip()
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
  if headers is null then return null; end if;
  return nullif(trim(split_part(coalesce(headers ->> 'x-forwarded-for', headers ->> 'cf-connecting-ip', ''), ',', 1)), '');
end;
$$;

-- Cuenta un envío anónimo en `p_bucket` y lo rechaza (error 54429) si esa IP ya llegó a su tope o si el total pasó el suyo.
create or replace function enforce_public_rate_limit(p_bucket text, p_ip_limit int, p_global_limit int, p_window interval default interval '1 hour')
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  caller_ip text;
begin
  -- Solo se frena a quien entra como anónimo.
  if coalesce(auth.role(), '') <> 'anon' then
    return;
  end if;

  caller_ip := request_client_ip();

  if caller_ip is not null
     and (select count(*) from public_rate_hits h where h.bucket = p_bucket and h.ip = caller_ip and h.created_at > now() - p_window) >= p_ip_limit then
    raise exception 'Demasiados envíos desde tu conexión. Inténtalo de nuevo más tarde.' using errcode = '54429';
  end if;

  if (select count(*) from public_rate_hits h where h.bucket = p_bucket and h.created_at > now() - p_window) >= p_global_limit then
    raise exception 'Estamos recibiendo demasiados envíos. Inténtalo de nuevo más tarde.' using errcode = '54429';
  end if;

  insert into public_rate_hits (bucket, ip) values (p_bucket, caller_ip);

  -- Limpieza de pasada: casi nunca, y solo lo viejo.
  if random() < 0.02 then
    delete from public_rate_hits where created_at < now() - interval '2 days';
  end if;
end;
$$;

revoke all on function enforce_public_rate_limit(text, int, int, interval) from public, anon, authenticated;
revoke all on function request_client_ip() from public;
grant execute on function request_client_ip() to anon, authenticated;

create or replace function trg_limit_contact_messages()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform enforce_public_rate_limit('contact_messages', 10, 200);
  return new;
end;
$$;

drop trigger if exists trg_limit_contact_messages on contact_messages;
create trigger trg_limit_contact_messages
before insert on contact_messages
for each row execute function trg_limit_contact_messages();

create or replace function trg_limit_property_alerts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform enforce_public_rate_limit('property_alerts', 10, 100);
  return new;
end;
$$;

drop trigger if exists trg_limit_property_alerts on property_alerts;
create trigger trg_limit_property_alerts
before insert on property_alerts
for each row execute function trg_limit_property_alerts();

-- ─────────────────────────────────────────────
-- Verificación en dos pasos y dispositivos del panel (2026-11-18)
-- 1) mfa_ok(): verdadero si la sesión ya confirmó su código (aal2) o si la persona NO tiene la verificación activada.
--    Así nadie queda fuera por no haberla activado todavía, pero quien SÍ la activó ya no puede leer los datos sensibles con
--    una sesión que solo tenga la contraseña (aal1). Se aplica como política «restrictive» (se suma a las que ya existen) a:
--      · clients (INE/CURP/contraseña del portal), client_documents y perfilamientos_comprador
--      · el bucket privado de archivos de clientes (client-documents)
--    Alcance: acceso directo a tablas y archivos. Las funciones del servidor (security definer) no pasan por aquí.
-- 2) admin_devices: dispositivos que han entrado al panel (el navegador se registra solo al iniciar sesión).
--    Supabase no deja a la app listar las sesiones reales, así que esta lista es de «dispositivos vistos»; cerrar las demás
--    sesiones sí es real (signOut con scope «others») y además borra de la lista a los otros dispositivos.
-- Requiere activar MFA (TOTP) en Supabase: Authentication → Sign In / Providers → Multi-Factor.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

create or replace function mfa_ok()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
    or not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified');
$$;

revoke all on function mfa_ok() from public;
grant execute on function mfa_ok() to authenticated;

drop policy if exists "Dos pasos para datos sensibles" on clients;
create policy "Dos pasos para datos sensibles" on clients as restrictive for all to authenticated
  using (mfa_ok()) with check (mfa_ok());

drop policy if exists "Dos pasos para datos sensibles" on client_documents;
create policy "Dos pasos para datos sensibles" on client_documents as restrictive for all to authenticated
  using (mfa_ok()) with check (mfa_ok());

do $$
begin
  if to_regclass('public.perfilamientos_comprador') is not null then
    execute 'drop policy if exists "Dos pasos para datos sensibles" on perfilamientos_comprador';
    execute 'create policy "Dos pasos para datos sensibles" on perfilamientos_comprador as restrictive for all to authenticated using (mfa_ok()) with check (mfa_ok())';
  end if;
end $$;

drop policy if exists "Dos pasos para archivos de clientes" on storage.objects;
create policy "Dos pasos para archivos de clientes" on storage.objects as restrictive for all to authenticated
  using (bucket_id <> 'client-documents' or mfa_ok())
  with check (bucket_id <> 'client-documents' or mfa_ok());

create table if not exists admin_devices (
  user_id uuid not null,
  device_id text not null check (length(device_id) between 8 and 80),
  label text not null default '' check (length(label) <= 120),
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  primary key (user_id, device_id)
);

alter table admin_devices enable row level security;

drop policy if exists "Cada quien ve sus dispositivos" on admin_devices;
create policy "Cada quien ve sus dispositivos" on admin_devices for select to authenticated
  using (user_id = auth.uid());

create or replace function touch_admin_device(p_device_id text, p_label text default '')
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or p_device_id is null or length(p_device_id) not between 8 and 80 then
    return;
  end if;
  insert into admin_devices (user_id, device_id, label)
  values (auth.uid(), p_device_id, left(coalesce(p_label, ''), 120))
  on conflict (user_id, device_id) do update set last_seen = now(), label = excluded.label;
  -- Sin acumular: solo los 20 más recientes de cada persona.
  delete from admin_devices d
  where d.user_id = auth.uid()
    and d.device_id in (select device_id from admin_devices where user_id = auth.uid() order by last_seen desc offset 20);
end;
$$;

create or replace function forget_other_admin_devices(p_device_id text)
returns int
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  removed int;
begin
  if auth.uid() is null then return 0; end if;
  delete from admin_devices where user_id = auth.uid() and device_id <> coalesce(p_device_id, '');
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function touch_admin_device(text, text) from public, anon;
revoke all on function forget_other_admin_devices(text) from public, anon;
grant execute on function touch_admin_device(text, text) to authenticated;
grant execute on function forget_other_admin_devices(text) to authenticated;

-- ─────────────────────────────────────────────
-- Monitoreo de errores del navegador (2026-11-18)
-- Hasta ahora un fallo en producción no avisaba a nadie. El sitio manda cada error del navegador (mensaje, pila, ruta sin
-- datos personales ni enlaces secretos, navegador y versión) a report_client_error; se agrupan por «huella» (el mismo
-- error cuenta como uno con su número de veces) y los administradores (apartado «roles») los ven en /admin/errores.
-- La Edge Function errores-aviso, disparada por pg_cron cada 30 minutos, manda UN correo con los errores nuevos
-- (o que reaparecieron tras marcarse como resueltos). Sin servicios de terceros.
-- report_client_error es público (los visitantes no tienen cuenta) y usa el freno de envíos públicos de arriba
-- (60 por hora por IP, 600 por hora en total). Requiere los secretos CRON_SECRET, RESEND_API_KEY (y opcional RESEND_FROM,
-- SITE_URL, ERRORS_REPORT_TO) de la función; desplegarla con la verificación de JWT desactivada.
-- (bloque re-ejecutable: cron.schedule con un nombre que ya existe actualiza ese job)
-- ─────────────────────────────────────────────

create table if not exists client_errors (
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null unique,
  message text not null,
  stack text,
  source text not null default 'window',
  url text,
  user_agent text,
  release text,
  count int not null default 1,
  status text not null default 'nuevo' check (status in ('nuevo', 'resuelto', 'ignorado')),
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  notified_at timestamptz
);

create index if not exists idx_client_errors_status_seen on client_errors(status, last_seen desc);

alter table client_errors enable row level security;

drop policy if exists "Administradores leen errores" on client_errors;
create policy "Administradores leen errores" on client_errors for select
  using (has_admin_section('roles'));

drop policy if exists "Administradores actualizan errores" on client_errors;
create policy "Administradores actualizan errores" on client_errors for update
  using (has_admin_section('roles')) with check (has_admin_section('roles'));

drop policy if exists "Administradores borran errores" on client_errors;
create policy "Administradores borran errores" on client_errors for delete
  using (has_admin_section('roles'));

create or replace function report_client_error(
  p_fingerprint text,
  p_message text,
  p_stack text default null,
  p_url text default null,
  p_user_agent text default null,
  p_release text default null,
  p_source text default 'window'
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if p_fingerprint is null or p_fingerprint !~ '^[0-9a-f]{8}$' or coalesce(trim(p_message), '') = '' then
    return;
  end if;

  perform enforce_public_rate_limit('client_errors', 60, 600);

  insert into client_errors (fingerprint, message, stack, source, url, user_agent, release)
  values (
    p_fingerprint,
    left(p_message, 500),
    left(p_stack, 4000),
    case when p_source in ('window', 'promise', 'react') then p_source else 'window' end,
    left(p_url, 300),
    left(p_user_agent, 300),
    left(p_release, 40)
  )
  on conflict (fingerprint) do update set
    count = client_errors.count + 1,
    last_seen = now(),
    url = excluded.url,
    user_agent = excluded.user_agent,
    release = excluded.release,
    -- Si ya estaba resuelto y vuelve a pasar, reaparece como nuevo y se avisa otra vez.
    status = case when client_errors.status = 'resuelto' then 'nuevo' else client_errors.status end,
    notified_at = case when client_errors.status = 'resuelto' then null else client_errors.notified_at end;
end;
$$;

revoke all on function report_client_error(text, text, text, text, text, text, text) from public;
grant execute on function report_client_error(text, text, text, text, text, text, text) to anon, authenticated;

select cron.schedule(
  'errores-aviso',
  '*/30 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/errores-aviso',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key'),
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'agenda_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ─────────────────────────────────────────────
-- Tiempo real del panel (2026-11-18)
-- Mensajes de contacto y prospectos nuevos aparecen en el panel al instante, sin recargar ni cambiar de pantalla
-- (Supabase Realtime, solo a las personas con sesión; las políticas de lectura de cada tabla siguen mandando: quien no puede
-- leer una fila tampoco recibe su aviso). Solo hay que agregar las tablas a la publicación «supabase_realtime».
-- Es lo único que hace este bloque; si prefieres, también se puede activar en el panel de Supabase:
-- Database → Replication.
-- (bloque re-ejecutable: no repite una tabla que ya está en la publicación)
-- ─────────────────────────────────────────────

do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    return; -- fuera de Supabase (o con Realtime apagado): nada que hacer
  end if;
  foreach t in array array['contact_messages', 'prospectos'] loop
    if to_regclass('public.' || t) is not null
       and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ─────────────────────────────────────────────
-- Conteo de propiedades por tipo, sin bajar el catálogo (2026-11-18)
-- El encabezado y el inicio del sitio bajaban TODAS las propiedades activas solo para contar cuántas hay de cada tipo (y el
-- inicio, además, para elegir las destacadas). Ahora piden este número ya contado. Cuenta las propiedades activas (con
-- cualquier estatus), igual que antes. Función de solo lectura que respeta las políticas de la tabla.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

create or replace function public_type_counts()
returns jsonb
language sql
stable
as $$
  select coalesce(jsonb_object_agg(type, n), '{}'::jsonb)
  from (select type, count(*)::int as n from properties where active group by type) t;
$$;

revoke all on function public_type_counts() from public;
grant execute on function public_type_counts() to anon, authenticated;
