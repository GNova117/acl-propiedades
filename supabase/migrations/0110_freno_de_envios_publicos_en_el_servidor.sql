-- ─────────────────────────────────────────────
-- Freno de envíos públicos en el servidor (2026-11-18)
-- Hasta ahora el freno del formulario de contacto (campo trampa y espera de 60 s) vivía solo en el navegador: quien
-- llamara a la API directo podía mandar mensajes sin límite (cada uno dispara un aviso por WhatsApp). Ahora la base
-- cuenta los envíos anónimos por conexión (IP) y en total, y rechaza el exceso. Aplica a:
--   · contact_messages (formulario de Contacto, solicitudes de visita y de información) — 10 por hora por IP, 200 por hora en total
--   · property_alerts  (suscripción a avisos, que manda correos/WhatsApp a terceros)    — 10 por hora por IP, 100 por hora en total
-- Solo cuenta a quien entra como anónimo (rol «anon»): el personal con sesión, el SQL Editor y las funciones del
-- servidor (service role) no se frenan. Las reservas de visita ya tenían su propio freno (visit_booking_attempts).
-- Limitaciones (a propósito): quien rote de IP puede seguir mandando hasta el tope global; y detrás de una misma red
-- (oficina, datos móviles compartidos) varias personas comparten el cupo. Para frenar bots de verdad (no solo exceso)
-- el siguiente paso sería Cloudflare Turnstile, que necesita una cuenta y llaves propias.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

create table if not exists public_rate_hits (
  id bigserial primary key,
  bucket text not null,
  ip text,
  created_at timestamptz not null default now()
);
create index if not exists idx_public_rate_hits_bucket_ip on public_rate_hits(bucket, ip, created_at desc);
create index if not exists idx_public_rate_hits_bucket_time on public_rate_hits(bucket, created_at desc);

-- Sin políticas: solo las funciones de abajo (security definer) leen y escriben.
alter table public_rate_hits enable row level security;

-- IP de quien llama, tal como la reporta el proxy de Supabase (primer valor de x-forwarded-for). null si no hay.
create or replace function request_client_ip()
returns text
language plpgsql
stable
as $$
declare
  headers json;
begin
  begin
    headers := nullif(current_setting('request.headers', true), '')::json;
  exception when others then
    return null;
  end;
  if headers is null then return null; end if;
  return nullif(trim(split_part(coalesce(headers ->> 'x-forwarded-for', headers ->> 'cf-connecting-ip', ''), ',', 1)), '');
end;
$$;

-- Cuenta un envío anónimo en `p_bucket` y lo rechaza (error 54429) si esa IP ya llegó a su tope o si el total pasó el suyo.
create or replace function enforce_public_rate_limit(p_bucket text, p_ip_limit int, p_global_limit int, p_window interval default interval '1 hour')
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  caller_ip text;
begin
  -- Solo se frena a quien entra como anónimo.
  if coalesce(auth.role(), '') <> 'anon' then
    return;
  end if;

  caller_ip := request_client_ip();

  if caller_ip is not null
     and (select count(*) from public_rate_hits h where h.bucket = p_bucket and h.ip = caller_ip and h.created_at > now() - p_window) >= p_ip_limit then
    raise exception 'Demasiados envíos desde tu conexión. Inténtalo de nuevo más tarde.' using errcode = '54429';
  end if;

  if (select count(*) from public_rate_hits h where h.bucket = p_bucket and h.created_at > now() - p_window) >= p_global_limit then
    raise exception 'Estamos recibiendo demasiados envíos. Inténtalo de nuevo más tarde.' using errcode = '54429';
  end if;

  insert into public_rate_hits (bucket, ip) values (p_bucket, caller_ip);

  -- Limpieza de pasada: casi nunca, y solo lo viejo.
  if random() < 0.02 then
    delete from public_rate_hits where created_at < now() - interval '2 days';
  end if;
end;
$$;

revoke all on function enforce_public_rate_limit(text, int, int, interval) from public, anon, authenticated;
revoke all on function request_client_ip() from public;
grant execute on function request_client_ip() to anon, authenticated;

create or replace function trg_limit_contact_messages()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform enforce_public_rate_limit('contact_messages', 10, 200);
  return new;
end;
$$;

drop trigger if exists trg_limit_contact_messages on contact_messages;
create trigger trg_limit_contact_messages
before insert on contact_messages
for each row execute function trg_limit_contact_messages();

create or replace function trg_limit_property_alerts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform enforce_public_rate_limit('property_alerts', 10, 100);
  return new;
end;
$$;

drop trigger if exists trg_limit_property_alerts on property_alerts;
create trigger trg_limit_property_alerts
before insert on property_alerts
for each row execute function trg_limit_property_alerts();

