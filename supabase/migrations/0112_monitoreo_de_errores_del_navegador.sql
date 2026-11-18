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

