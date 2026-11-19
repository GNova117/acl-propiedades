
-- ─────────────────────────────────────────────
-- Aviso al asesor cuando el cliente llena su registro (2026-11-19)
-- Cuando el cliente envía su registro (migración 0116) el equipo se entera:
-- · client_intake_links.advisor_id: el asesor que generó el enlace (lo manda el panel). Sin asesor (lo generó la oficina) el aviso
--   va a la oficina. También sirve para que, al terminar, el cliente pueda escribirle por WhatsApp a ese asesor.
-- · client_intake_links.seen_at: se llena cuando el equipo abre «Enlace de registro» en Clientes; mientras esté vacío, el registro
--   cuenta como pendiente en la campana y en «Pendientes de hoy».
-- · client_intake_status también regresa advisor_id (dato que ya es público: los asesores se ven en el sitio).
-- · Aviso push (Edge Function enviar-push, igual que los mensajes de contacto): al asesor del enlace, o a la oficina si no tiene.
--   Quien no haya activado las notificaciones en su dispositivo lo ve solo dentro del panel. Un fallo del aviso NUNCA impide que el
--   cliente quede registrado.
-- · client_intake_links entra a la publicación de tiempo real: la campana se actualiza sola, sin recargar.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

alter table client_intake_links add column if not exists advisor_id uuid references advisors(id) on delete set null;
alter table client_intake_links add column if not exists seen_at timestamptz;

-- Los registros que ya estaban llenos antes de este bloque no se vuelven «pendientes».
update client_intake_links set seen_at = now() where submitted_at is not null and seen_at is null;

create or replace function client_intake_status(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  l client_intake_links;
begin
  select * into l from client_intake_links where token = p_token;
  if not found then return jsonb_build_object('status', 'invalido'); end if;
  if l.revoked_at is not null then return jsonb_build_object('status', 'revocado'); end if;
  if l.submitted_at is not null then return jsonb_build_object('status', 'usado'); end if;
  if now() > l.expires_at then return jsonb_build_object('status', 'expirado'); end if;
  return jsonb_build_object('status', 'activo', 'type', l.type, 'advisor_id', l.advisor_id);
end;
$$;

revoke all on function client_intake_status(text) from public;
grant execute on function client_intake_status(text) to anon, authenticated;

-- Push al asesor (o a la oficina) cuando un enlace pasa a «ya lo llenó».
create or replace function notify_client_intake_submitted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  who text;
  body jsonb;
begin
  if old.submitted_at is not null or new.submitted_at is null then
    return new;
  end if;

  begin
    select name into who from clients where id = new.client_id;
    body := jsonb_build_object(
      'title', 'Cliente nuevo: ' || coalesce(who, 'sin nombre'),
      'body', 'Llenó su registro como ' || case new.type when 'comprador' then 'comprador' when 'vendedor' then 'vendedor' else 'comprador y vendedor' end || '.',
      'url', '/admin/clientes?registros=1'
    );
    if new.advisor_id is not null then
      body := body || jsonb_build_object('advisorId', new.advisor_id);
    else
      body := body || jsonb_build_object('section', 'clientes', 'office', true);
    end if;

    perform net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/enviar-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key'),
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'agenda_cron_secret')
      ),
      body := body
    );
  exception when others then
    -- Sin push (secretos sin configurar, pg_net apagado…) el cliente queda registrado igual; el aviso sale en el panel.
    null;
  end;
  return new;
end;
$$;

drop trigger if exists trg_notify_client_intake_submitted on client_intake_links;
create trigger trg_notify_client_intake_submitted
after update of submitted_at on client_intake_links
for each row execute function notify_client_intake_submitted();

-- Tiempo real: la campana del panel se entera al instante.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    return; -- fuera de Supabase (o con Realtime apagado): nada que hacer
  end if;
  if to_regclass('public.client_intake_links') is not null
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'client_intake_links') then
    alter publication supabase_realtime add table public.client_intake_links;
  end if;
end $$;
