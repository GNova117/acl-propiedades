-- ─────────────────────────────────────────────
-- Aviso de prospectos sin atender (2026-10-19): un prospecto que llegó solo
-- (sitio, chatbot, WhatsApp, alerta, simulador...) y sigue en "Nuevo" sin
-- ningún contacto registrado dispara, cada 10 minutos y solo de 8:00 a 20:00
-- hora de México (un lead de las 11 pm se avisa a las 8 am, no a medianoche):
--   · a la hora de haber llegado, push al asesor responsable (un solo aviso
--     con todos sus prospectos pendientes);
--   · 3 horas después de ese aviso, si sigue sin atenderse, push a la oficina
--     (los logins sin asesor vinculado con el apartado 'prospectos');
--   · si el prospecto no tiene asesor (por ejemplo los del chatbot), la
--     oficina recibe el aviso directo a la hora, porque nadie más lo ve.
-- unattended_alert_at / unattended_escalated_at recuerdan qué ya se avisó para
-- no repetirlo. Lo que ya estaba sin atender al agregar esto queda marcado como
-- avisado (el panel ya lo señala); solo avisa lo que llegue de aquí en adelante.
-- ⚠️ ORDEN: correr este bloque DESPUÉS de volver a desplegar la Edge Function
-- enviar-push. La versión anterior de la función ignora advisorId y office y,
-- sin section, manda el aviso (con nombres de prospectos) a TODOS los
-- dispositivos registrados; la nueva ya los respeta.
-- Misma lista de orígenes y mismos umbrales que src/lib/prospects.js
-- (INBOUND_SOURCES, UNATTENDED_WARN_HOURS): si cambian allá, cambian aquí.
-- Usa push: necesita el bloque "Notificaciones push" y las llaves VAPID (ver
-- README); quien no haya activado las notificaciones en su dispositivo solo ve
-- el aviso dentro del panel.
-- (bloque re-ejecutable: cron.schedule con un nombre que ya existe actualiza ese job)
-- ─────────────────────────────────────────────

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'prospectos' and column_name = 'unattended_alert_at'
  ) then
    alter table prospectos add column unattended_alert_at timestamptz;
    alter table prospectos add column unattended_escalated_at timestamptz;
    update prospectos
    set unattended_alert_at = now(), unattended_escalated_at = now()
    where stage = 'nuevo'
      and last_contact_at is null
      and source in ('whatsapp', 'chatbot', 'simulador', 'estimacion', 'comparador', 'alerta', 'sitio');
  end if;
end;
$$;

create or replace function notify_unattended_prospects() returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  mx_hour int := extract(hour from (now() at time zone 'America/Mexico_City'));
  r record;
  office record;
begin
  if mx_hour < 8 or mx_hour >= 20 then
    return;
  end if;

  -- 1) Asesor responsable: pasó la primera hora sin contacto.
  for r in
    select p.advisor_id, count(*) as n, string_agg(p.name, ', ' order by p.created_at) as names
    from prospectos p
    where p.stage = 'nuevo'
      and p.last_contact_at is null
      and p.source in ('whatsapp', 'chatbot', 'simulador', 'estimacion', 'comparador', 'alerta', 'sitio')
      and p.advisor_id is not null
      and p.unattended_alert_at is null
      and p.created_at <= now() - interval '1 hour'
    group by p.advisor_id
  loop
    perform net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/enviar-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key'),
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'agenda_cron_secret')
      ),
      body := jsonb_build_object(
        'advisorId', r.advisor_id,
        'title', case when r.n = 1 then 'Prospecto sin atender' else r.n || ' prospectos sin atender' end,
        'body', left(r.names, 150),
        'url', '/admin/prospectos'
      )
    );
  end loop;

  update prospectos
  set unattended_alert_at = now()
  where stage = 'nuevo'
    and last_contact_at is null
    and source in ('whatsapp', 'chatbot', 'simulador', 'estimacion', 'comparador', 'alerta', 'sitio')
    and advisor_id is not null
    and unattended_alert_at is null
    and created_at <= now() - interval '1 hour';

  -- 2) Oficina: el asesor ya fue avisado hace 3 horas y sigue sin atender, o el
  --    prospecto no tiene asesor y lleva más de una hora.
  select count(*) as n, string_agg(p.name || ' (' || coalesce(a.name, 'sin asesor') || ')', ', ' order by p.created_at) as names
  into office
  from prospectos p
  left join advisors a on a.id = p.advisor_id
  where p.stage = 'nuevo'
    and p.last_contact_at is null
    and p.source in ('whatsapp', 'chatbot', 'simulador', 'estimacion', 'comparador', 'alerta', 'sitio')
    and p.unattended_escalated_at is null
    and (
      (p.advisor_id is not null and p.unattended_alert_at <= now() - interval '3 hours')
      or (p.advisor_id is null and p.created_at <= now() - interval '1 hour')
    );

  if office.n > 0 then
    perform net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/enviar-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key'),
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'agenda_cron_secret')
      ),
      body := jsonb_build_object(
        'section', 'prospectos',
        'office', true,
        'title', case when office.n = 1 then 'Prospecto sin atender' else office.n || ' prospectos sin atender' end,
        'body', left(office.names, 150),
        'url', '/admin/prospectos'
      )
    );

    update prospectos
    set unattended_escalated_at = now(),
        unattended_alert_at = coalesce(unattended_alert_at, now())
    where stage = 'nuevo'
      and last_contact_at is null
      and source in ('whatsapp', 'chatbot', 'simulador', 'estimacion', 'comparador', 'alerta', 'sitio')
      and unattended_escalated_at is null
      and (
        (advisor_id is not null and unattended_alert_at <= now() - interval '3 hours')
        or (advisor_id is null and created_at <= now() - interval '1 hour')
      );
  end if;
end;
$$;

revoke execute on function notify_unattended_prospects() from public, anon, authenticated;

select cron.schedule(
  'prospectos-sin-atender',
  '*/10 * * * *',
  $$ select notify_unattended_prospects(); $$
);

