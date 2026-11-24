-- ─────────────────────────────────────────────
-- Notificaciones push del navegador/SO para el equipo del panel admin. Un
-- dispositivo (navegador logueado en /admin) se suscribe desde la campana
-- de notificaciones ("Activar notificaciones en este dispositivo"),
-- guardando su endpoint + llaves de cifrado en push_subscriptions — cada
-- quien solo puede leer/crear/borrar sus propias filas (auth.email() =
-- email), no hace falta has_admin_section aquí porque es una preferencia
-- personal del dispositivo, no un dato del negocio.
--
-- Cuando llega un mensaje de contacto nuevo, un trigger after insert en
-- contact_messages llama a la Edge Function enviar-push (mismo patrón que
-- ya usa notify_new_contact_message() para el aviso por WhatsApp, mismo
-- secreto compartido — vault 'agenda_cron_secret' ↔ función CRON_SECRET),
-- que manda un Web Push firmado con VAPID a cada dispositivo de quien
-- tenga el apartado 'mensajes'.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table push_subscriptions enable row level security;

drop policy if exists "Cada quien ve sus propias suscripciones push" on push_subscriptions;
create policy "Cada quien ve sus propias suscripciones push" on push_subscriptions for select
  using (auth.email() = email);

drop policy if exists "Cada quien crea sus propias suscripciones push" on push_subscriptions;
create policy "Cada quien crea sus propias suscripciones push" on push_subscriptions for insert
  with check (auth.email() = email);

drop policy if exists "Cada quien actualiza sus propias suscripciones push" on push_subscriptions;
create policy "Cada quien actualiza sus propias suscripciones push" on push_subscriptions for update
  using (auth.email() = email) with check (auth.email() = email);

drop policy if exists "Cada quien borra sus propias suscripciones push" on push_subscriptions;
create policy "Cada quien borra sus propias suscripciones push" on push_subscriptions for delete
  using (auth.email() = email);

create or replace function notify_new_contact_message_push() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/enviar-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key'),
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'agenda_cron_secret')
    ),
    body := jsonb_build_object(
      'section', 'mensajes',
      'title', 'Nuevo mensaje: ' || new.name,
      'body', left(coalesce(new.message, ''), 150),
      'url', '/admin/mensajes'
    )
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_new_contact_message_push on contact_messages;
create trigger trg_notify_new_contact_message_push
after insert on contact_messages
for each row execute function notify_new_contact_message_push();

