-- ─────────────────────────────────────────────
-- Aviso por WhatsApp cuando llega un mensaje de contacto nuevo. A
-- diferencia de los avisos de Agenda (pg_cron, corren en una ventana de
-- tiempo), este es por evento: un trigger after insert en
-- contact_messages llama a la función mensaje-contacto-whatsapp una sola
-- vez por mensaje, sin necesidad de reclamo/dedup. security definer para
-- que corra con los permisos del dueño de la función (no los del rol
-- 'anon' que hizo el insert público) al leer vault.decrypted_secrets —
-- mismo motivo por el que has_admin_section()/my_advisor_id() son
-- security definer. Reusa el mismo secreto compartido que ya protege las
-- funciones de Agenda (vault 'agenda_cron_secret' ↔ función CRON_SECRET) —
-- no hace falta un secreto nuevo para esto.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

create or replace function notify_new_contact_message() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/mensaje-contacto-whatsapp',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key'),
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'agenda_cron_secret')
    ),
    body := jsonb_build_object('name', new.name, 'phone', new.phone, 'message', new.message)
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_new_contact_message on contact_messages;
create trigger trg_notify_new_contact_message
after insert on contact_messages
for each row execute function notify_new_contact_message();

