-- ─────────────────────────────────────────────
-- Construcción · fondo por nivel (2026-10-02) — imagen de fondo (plano
-- escaneado, foto de un croquis…) para calcar encima en "Plano completo", a
-- escala real. Una fila por nivel (unique en nivel_id, upsert desde la
-- pantalla). `nivel_id` NO lleva llave foránea a propósito, mismo motivo que
-- construccion_fotos.habitacion_id: pushConstruccionProyecto borra y
-- reinserta los niveles en cada guardado del plano (conservan el mismo id,
-- pero la fila física es otra), y si cascadeara por ahí se perdería el fondo
-- con solo mover un muro. La única cascada real es por proyecto_id. Bucket
-- privado (construccion-fondos, 20 MB, solo imágenes); mismo acceso que el
-- resto de construccion_*.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────
create table if not exists construccion_fondos (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references construccion_proyectos(id) on delete cascade,
  nivel_id uuid not null unique,
  file_path text not null,
  x_m numeric not null default 0,
  z_m numeric not null default 0,
  width_m numeric not null,
  height_m numeric not null,
  opacidad numeric not null default 0.5,
  created_at timestamptz not null default now()
);
create index if not exists idx_construccion_fondos_proyecto on construccion_fondos(proyecto_id);

alter table construccion_fondos enable row level security;

drop policy if exists "Authenticated manage construccion_fondos" on construccion_fondos;
create policy "Authenticated manage construccion_fondos" on construccion_fondos for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('construccion-fondos', 'construccion-fondos', false, 20971520, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = 20971520,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "Authenticated view construccion fondos" on storage.objects;
create policy "Authenticated view construccion fondos" on storage.objects
  for select using (bucket_id = 'construccion-fondos' and auth.role() = 'authenticated');

drop policy if exists "Authenticated upload construccion fondos" on storage.objects;
create policy "Authenticated upload construccion fondos" on storage.objects
  for insert with check (bucket_id = 'construccion-fondos' and auth.role() = 'authenticated');

drop policy if exists "Authenticated update construccion fondos" on storage.objects;
create policy "Authenticated update construccion fondos" on storage.objects
  for update using (bucket_id = 'construccion-fondos' and auth.role() = 'authenticated');

drop policy if exists "Authenticated delete construccion fondos" on storage.objects;
create policy "Authenticated delete construccion fondos" on storage.objects
  for delete using (bucket_id = 'construccion-fondos' and auth.role() = 'authenticated');

