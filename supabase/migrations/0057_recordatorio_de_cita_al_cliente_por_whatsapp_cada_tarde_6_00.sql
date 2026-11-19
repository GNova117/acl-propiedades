-- ─────────────────────────────────────────────
-- Recordatorio de cita al cliente por WhatsApp (2026-09-28): cada tarde (6:00 pm
-- hora de México) cada cliente con una cita MAÑANA recibe un recordatorio. Lo
-- manda la Edge Function supabase/functions/agenda-recordatorio-cliente,
-- disparada por pg_cron con las mismas credenciales (Vault) y secretos que los
-- demás avisos de Agenda.
-- Requiere crear y aprobar en Meta Business Manager la plantilla de WhatsApp
-- "recordatorio_cita_cliente" (idioma es_MX, categoría Utilidad), con 4
-- variables con nombre: nombre_cliente, titulo_cita, fecha_hora, nombre_asesor.
-- Texto sugerido:
--   Hola {{nombre_cliente}}, te recordamos tu cita "{{titulo_cita}}" {{fecha_hora}}.
--   Te atenderá {{nombre_asesor}} de ACL Propiedades. Si necesitas cambiarla,
--   responde a este mensaje.
-- client_reminder_sent_at evita mandar dos veces el recordatorio de la misma cita.
-- (bloque re-ejecutable: cron.schedule con un nombre que ya existe actualiza ese job)
-- ─────────────────────────────────────────────
alter table agenda_citas add column if not exists client_reminder_sent_at timestamptz;

select cron.schedule(
  'agenda-recordatorio-cliente',
  '0 0 * * *', -- 6:00pm hora de México (UTC-6 fijo, sin horario de verano)
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/agenda-recordatorio-cliente',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key'),
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'agenda_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);

