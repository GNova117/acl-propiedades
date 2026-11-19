-- ─────────────────────────────────────────────
-- Avisos de agenda por WhatsApp: resumen matutino (7am hora de México) y
-- recordatorio 30 min antes de cada cita, vía dos Edge Functions
-- (supabase/functions/agenda-resumen-diario, agenda-recordatorio-30min)
-- disparadas por pg_cron. Las credenciales reales (URL del proyecto,
-- llave pública, y el secreto que autoriza al cron a llamar las
-- funciones) NO van en este archivo — este repo es público en GitHub. Se
-- guardan aparte en Supabase Vault con un bloque que Claude te entrega
-- fuera de este archivo, para correr una sola vez.
-- (bloque re-ejecutable: cron.schedule con un nombre que ya existe
-- actualiza ese job en vez de duplicarlo)
-- ─────────────────────────────────────────────

create extension if not exists pg_cron;
create extension if not exists pg_net;

alter table agenda_citas add column if not exists reminder_sent_at timestamptz;

create table if not exists agenda_resumenes_enviados (
  advisor_id uuid not null references advisors(id) on delete cascade,
  fecha date not null,
  created_at timestamptz not null default now(),
  primary key (advisor_id, fecha)
);

alter table agenda_resumenes_enviados enable row level security;

drop policy if exists "Rol con apartado agenda lee resumenes enviados" on agenda_resumenes_enviados;
create policy "Rol con apartado agenda lee resumenes enviados" on agenda_resumenes_enviados for select
  using (has_admin_section('agenda'));

select cron.schedule(
  'agenda-resumen-diario',
  '0 13 * * *', -- 7:00am hora de México (UTC-6 fijo, sin horario de verano)
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/agenda-resumen-diario',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key'),
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'agenda_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'agenda-recordatorio-30min',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/agenda-recordatorio-30min',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key'),
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'agenda_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);

