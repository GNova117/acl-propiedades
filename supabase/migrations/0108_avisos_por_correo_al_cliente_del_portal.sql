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

