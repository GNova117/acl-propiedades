-- ─────────────────────────────────────────────
-- Aviso diario de seguimientos por WhatsApp (2026-09-25): cada mañana (7:05 am
-- hora de México) cada asesor con seguimientos de prospectos vencidos o para hoy
-- recibe UN resumen por WhatsApp. Lo manda la Edge Function
-- supabase/functions/seguimientos-resumen-diario, disparada por pg_cron, con las
-- mismas credenciales (Vault) y los mismos secretos que los avisos de Agenda.
-- Requiere crear y aprobar en Meta Business Manager la plantilla de WhatsApp
-- "resumen_seguimientos_dia" (idioma es_MX, categoría Utilidad), con 3 variables
-- con nombre: nombre_asesor, num_seguimientos y lista_seguimientos. Texto sugerido:
--   Hola {{nombre_asesor}}, hoy tienes {{num_seguimientos}} seguimientos de
--   prospectos pendientes: {{lista_seguimientos}}. Revísalos en el panel de ACL Propiedades.
-- seguimientos_resumenes_enviados evita mandar dos veces el mismo día al mismo asesor.
-- (bloque re-ejecutable: cron.schedule con un nombre que ya existe actualiza ese job)
-- ─────────────────────────────────────────────

create table if not exists seguimientos_resumenes_enviados (
  advisor_id uuid not null references advisors(id) on delete cascade,
  fecha date not null,
  created_at timestamptz not null default now(),
  primary key (advisor_id, fecha)
);

alter table seguimientos_resumenes_enviados enable row level security;

drop policy if exists "Rol con apartado prospectos lee resumenes de seguimientos enviados" on seguimientos_resumenes_enviados;
create policy "Rol con apartado prospectos lee resumenes de seguimientos enviados" on seguimientos_resumenes_enviados for select
  using (has_admin_section('prospectos'));

select cron.schedule(
  'seguimientos-resumen-diario',
  '5 13 * * *', -- 7:05am hora de México (UTC-6 fijo, sin horario de verano)
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/seguimientos-resumen-diario',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key'),
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'agenda_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);

