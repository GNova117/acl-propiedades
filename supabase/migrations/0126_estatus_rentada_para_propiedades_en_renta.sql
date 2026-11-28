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
