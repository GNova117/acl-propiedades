
-- ─────────────────────────────────────────────
-- Seguridad: lectura pública mínima, correo del staff y límites por IP
-- (auditoría, puntos 101–104 y 112; bloque re-ejecutable)
-- ─────────────────────────────────────────────
-- ORDEN DE DESPLIEGUE: primero publicar el sitio (ya pide solo columnas públicas de asesores y lee el
-- contacto del equipo / de una selección por función) y después correr este bloque. Al revés, el sitio
-- viejo pide `advisors(*)` y la base le negaría las columnas privadas.

-- 102: la API pública ya no devuelve propiedades desactivadas (borradores). El personal con sesión sigue
-- viéndolas todas, igual que antes: su vista previa de un borrador y las pantallas del panel no cambian.
drop policy if exists "Public can read active properties" on properties;
create policy "Public can read active properties" on properties for select
  using (active = true or auth.role() = 'authenticated');

drop policy if exists "Public can read property_advisors" on property_advisors;
create policy "Public can read property_advisors" on property_advisors for select
  using (
    auth.role() = 'authenticated'
    or exists (select 1 from properties p where p.id = property_advisors.property_id and p.active = true)
  );

-- 103: de los asesores, el público solo lee los activos y solo nombre, foto y puesto. Teléfono, correo y
-- WhatsApp salen únicamente por las funciones de abajo: los del equipo publicado en /nosotros
-- (show_in_team) y el del asesor que mandó una selección, a quien tenga el enlace.
drop policy if exists "Public can read active advisors" on advisors;
create policy "Public can read active advisors" on advisors for select
  using (active = true or auth.role() = 'authenticated');

revoke select on advisors from anon;
grant select (id, name, photo_url, bio, active, show_in_team, created_at) on advisors to anon;

create or replace function team_advisors()
returns table (id uuid, name text, photo_url text, bio text, phone text, email text, whatsapp text)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, a.name, a.photo_url, a.bio, a.phone, a.email, a.whatsapp
  from advisors a
  where a.active = true and a.show_in_team = true
  order by a.name;
$$;

revoke all on function team_advisors() from public;
grant execute on function team_advisors() to anon, authenticated;

-- Responde también con la selección vencida o retirada: la página pública le muestra al cliente a quién escribirle
-- para pedir otra (igual que antes, cuando leía la fila del asesor directo). Lo único que da acceso es el token.
create or replace function selection_advisor(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select to_jsonb(x)
  from (
    select a.id, a.name, a.photo_url, a.phone, a.whatsapp
    from property_selections s
    join advisors a on a.id = s.advisor_id
    where p_token ~ '^[0-9a-f]{32}$'
      and s.token = p_token
      and a.active = true
  ) x;
$$;

revoke all on function selection_advisor(text) from public;
grant execute on function selection_advisor(text) to anon, authenticated;

-- 104: el tope del chat también por IP (guardada como huella, no en claro), para que rotar el id de sesión
-- del navegador no baste para agotar el cupo diario de todos.
alter table chat_rate_limits add column if not exists ip_hash text;
create index if not exists idx_chat_rate_limits_ip on chat_rate_limits(ip_hash, created_at desc);

-- 101: registro de correos mandados desde el panel (Edge Function enviar-correo), para limitar por hora y
-- poder auditar. Sin políticas: solo la service role (la función) la lee y escribe.
create table if not exists email_send_log (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  to_email text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_email_send_log_user on email_send_log(user_email, created_at desc);
alter table email_send_log enable row level security;

-- 112: las cubetas públicas aceptan solo imágenes y con tope de tamaño (las privadas ya lo tenían). Solo
-- aplica a subidas nuevas; lo ya guardado no se toca.
update storage.buckets
set file_size_limit = 15728640,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
where id in ('property-images', 'advisor-photos', 'blog-images');

update storage.buckets
set file_size_limit = 31457280,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'property-360';
