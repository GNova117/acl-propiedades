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

