-- ─────────────────────────────────────────────
-- Verificación en dos pasos y dispositivos del panel (2026-11-18)
-- 1) mfa_ok(): verdadero si la sesión ya confirmó su código (aal2) o si la persona NO tiene la verificación activada.
--    Así nadie queda fuera por no haberla activado todavía, pero quien SÍ la activó ya no puede leer los datos sensibles con
--    una sesión que solo tenga la contraseña (aal1). Se aplica como política «restrictive» (se suma a las que ya existen) a:
--      · clients (INE/CURP/contraseña del portal), client_documents y perfilamientos_comprador
--      · el bucket privado de archivos de clientes (client-documents)
--    Alcance: acceso directo a tablas y archivos. Las funciones del servidor (security definer) no pasan por aquí.
-- 2) admin_devices: dispositivos que han entrado al panel (el navegador se registra solo al iniciar sesión).
--    Supabase no deja a la app listar las sesiones reales, así que esta lista es de «dispositivos vistos»; cerrar las demás
--    sesiones sí es real (signOut con scope «others») y además borra de la lista a los otros dispositivos.
-- Requiere activar MFA (TOTP) en Supabase: Authentication → Sign In / Providers → Multi-Factor.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

create or replace function mfa_ok()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
    or not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified');
$$;

revoke all on function mfa_ok() from public;
grant execute on function mfa_ok() to authenticated;

drop policy if exists "Dos pasos para datos sensibles" on clients;
create policy "Dos pasos para datos sensibles" on clients as restrictive for all to authenticated
  using (mfa_ok()) with check (mfa_ok());

drop policy if exists "Dos pasos para datos sensibles" on client_documents;
create policy "Dos pasos para datos sensibles" on client_documents as restrictive for all to authenticated
  using (mfa_ok()) with check (mfa_ok());

do $$
begin
  if to_regclass('public.perfilamientos_comprador') is not null then
    execute 'drop policy if exists "Dos pasos para datos sensibles" on perfilamientos_comprador';
    execute 'create policy "Dos pasos para datos sensibles" on perfilamientos_comprador as restrictive for all to authenticated using (mfa_ok()) with check (mfa_ok())';
  end if;
end $$;

drop policy if exists "Dos pasos para archivos de clientes" on storage.objects;
create policy "Dos pasos para archivos de clientes" on storage.objects as restrictive for all to authenticated
  using (bucket_id <> 'client-documents' or mfa_ok())
  with check (bucket_id <> 'client-documents' or mfa_ok());

create table if not exists admin_devices (
  user_id uuid not null,
  device_id text not null check (length(device_id) between 8 and 80),
  label text not null default '' check (length(label) <= 120),
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  primary key (user_id, device_id)
);

alter table admin_devices enable row level security;

drop policy if exists "Cada quien ve sus dispositivos" on admin_devices;
create policy "Cada quien ve sus dispositivos" on admin_devices for select to authenticated
  using (user_id = auth.uid());

create or replace function touch_admin_device(p_device_id text, p_label text default '')
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or p_device_id is null or length(p_device_id) not between 8 and 80 then
    return;
  end if;
  insert into admin_devices (user_id, device_id, label)
  values (auth.uid(), p_device_id, left(coalesce(p_label, ''), 120))
  on conflict (user_id, device_id) do update set last_seen = now(), label = excluded.label;
  -- Sin acumular: solo los 20 más recientes de cada persona.
  delete from admin_devices d
  where d.user_id = auth.uid()
    and d.device_id in (select device_id from admin_devices where user_id = auth.uid() order by last_seen desc offset 20);
end;
$$;

create or replace function forget_other_admin_devices(p_device_id text)
returns int
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  removed int;
begin
  if auth.uid() is null then return 0; end if;
  delete from admin_devices where user_id = auth.uid() and device_id <> coalesce(p_device_id, '');
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function touch_admin_device(text, text) from public, anon;
revoke all on function forget_other_admin_devices(text) from public, anon;
grant execute on function touch_admin_device(text, text) to authenticated;
grant execute on function forget_other_admin_devices(text) to authenticated;

