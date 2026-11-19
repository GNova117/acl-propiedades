-- ─────────────────────────────────────────────
-- Resumen semanal por correo (2026-10)
-- ─────────────────────────────────────────────
-- Cada lunes a las 8:00 am (hora de México) los socios reciben UN correo con lo
-- que pasó los últimos 7 días contra los 7 anteriores: ventas y su valor,
-- propiedades nuevas, visitas e interés, prospectos nuevos por origen, mensajes,
-- vistas de fichas y las propiedades más vistas, más lo que está por atender.
-- Lo manda la Edge Function supabase/functions/reporte-semanal (por Resend),
-- disparada por pg_cron con las mismas credenciales (Vault) y el mismo
-- CRON_SECRET que los demás avisos. Va a los correos cuyo rol tiene el apartado
-- 'reportes' (los mismos que ven /admin/reportes), o a WEEKLY_REPORT_TO si se
-- define ese secreto (lista separada por comas). No incluye utilidades ni
-- liquidaciones. reporte_semanal_enviados evita mandarlo dos veces la misma
-- semana. Requiere los secretos RESEND_API_KEY (y opcional RESEND_FROM,
-- SITE_URL, WEEKLY_REPORT_TO) de la función; desplegarla con la verificación
-- de JWT desactivada (valida con x-cron-secret, igual que las otras).
-- Para probar sin mandar nada: invocarla con el x-cron-secret y {"dryRun": true}.
-- (bloque re-ejecutable: cron.schedule con un nombre que ya existe actualiza ese job)
-- ─────────────────────────────────────────────

create table if not exists reporte_semanal_enviados (
  semana_inicio date primary key,
  destinatarios int not null default 0,
  created_at timestamptz not null default now()
);

alter table reporte_semanal_enviados enable row level security;

drop policy if exists "Rol con apartado reportes lee reportes semanales enviados" on reporte_semanal_enviados;
create policy "Rol con apartado reportes lee reportes semanales enviados" on reporte_semanal_enviados for select
  using (has_admin_section('reportes'));

select cron.schedule(
  'reporte-semanal',
  '0 14 * * 1', -- lunes 8:00am hora de México (UTC-6 fijo, sin horario de verano)
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/reporte-semanal',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key'),
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'agenda_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);

