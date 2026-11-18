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

