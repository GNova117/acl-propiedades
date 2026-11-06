-- ═════════════════════════════════════════════════════════════════════════
-- AGENDAR VISITA CON HORARIOS REALES — fases 1 a 7 (reserva en la ficha,
-- página /visita/<token>, correos y recordatorios, prospecto y métricas, y
-- solicitudes de visita sin asesor).
--
-- Qué es este archivo: una copia EXACTA del último bloque de supabase/schema.sql
-- (desde "Agendar visita con horarios reales" hasta el final), para pegarlo solo en
-- Supabase → SQL Editor sin tener que correr todo el schema. Una prueba
-- (supabase/agendarVisitaSql.test.js) falla si deja de coincidir con schema.sql.
--
-- Cómo usarlo: pega TODO el archivo en el SQL Editor y pulsa Run. Es
-- RE-EJECUTABLE (se puede correr más de una vez sin duplicar nada) y no contiene
-- secretos. Antes de correrlo, y qué hacer después (funciones, secretos y
-- pruebas), está en docs/agendar-visita-despliegue.md.
--
-- Requisitos previos (ya existen si tu base está al día con schema.sql):
--   extensiones pg_cron y pg_net; secretos de Vault project_url, publishable_key
--   y agenda_cron_secret; y las tablas properties, advisors, property_advisors,
--   contact_messages, agenda_citas, prospectos, property_visits y admin_access.
-- ═════════════════════════════════════════════════════════════════════════

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
  now_mx timestamp := (now() at time zone 'America/Mexico_City');
  start_at timestamp;
  mins_until numeric;
begin
  select * into c from agenda_citas where booking_token = p_token and p_token ~ '^[0-9a-f]{32}$';
  if not found then return jsonb_build_object('status', 'invalido'); end if;

  select * into adv from advisors where id = c.advisor_id;
  select * into prop from properties where id = c.property_id;
  start_at := c.fecha + coalesce(c.hora, time '00:00');
  mins_until := extract(epoch from (start_at - now_mx)) / 60;

  return jsonb_build_object(
    'status', c.status,
    'fecha', c.fecha,
    'hora', to_char(c.hora, 'HH24:MI'),
    'duracion_min', c.duracion_min,
    'client_name', split_part(c.contact_name, ' ', 1),
    'client_confirmed_at', c.client_confirmed_at,
    'reschedule_count', c.reschedule_count,
    'can_reschedule', c.status = 'confirmada' and c.hora is not null and mins_until >= 120 and c.reschedule_count < 2,
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
  label text;
  msg text;
begin
  select * into prop from properties where id = p_cita.property_id;
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
    coalesce(p_cita.contact_name, '(sin nombre)'), coalesce(p_cita.contact_email, ''), p_cita.contact_phone, msg,
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

alter table agenda_citas drop constraint if exists agenda_citas_status_check;
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
