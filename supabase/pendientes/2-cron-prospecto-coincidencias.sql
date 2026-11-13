-- ══════════════════════════════════════════════════════════════════════════════
-- ARCHIVO 2 de 2 — Cron de «Le encaja a tu prospecto». Córrelo SOLO DESPUÉS de:
--   1) haber corrido el ARCHIVO 1, y
--   2) desplegar la Edge Function `prospecto-coincidencias` SIN verificar JWT (supabase/functions/prospecto-coincidencias),
--      con las mismas variables que las demás funciones de cron (CRON_SECRET, etc.), y tener `enviar-push` desplegada.
-- Programa una llamada cada hora (minuto 15); la función misma descarta lo que cae fuera de 8 am a 8 pm (hora de México).
-- Re-ejecutable: cron.schedule con un nombre que ya existe actualiza ese job. Requiere pg_cron, pg_net y los secretos de Vault
-- (project_url, publishable_key, agenda_cron_secret) que ya usan los demás cron.
-- ══════════════════════════════════════════════════════════════════════════════

-- Cron de «Le encaja a tu prospecto»: cada hora en el minuto 15 (la función misma descarta lo que cae fuera de 8 am a 8 pm).
select cron.schedule(
  'prospecto-coincidencias',
  '15 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/prospecto-coincidencias',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key'),
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'agenda_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
