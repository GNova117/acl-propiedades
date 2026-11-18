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

