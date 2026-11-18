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

