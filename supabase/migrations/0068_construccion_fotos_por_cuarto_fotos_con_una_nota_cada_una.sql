-- ─────────────────────────────────────────────
-- Construcción · fotos por cuarto (2026-10-02) — fotos con una nota cada una,
-- para el reporte con membrete (ficha PDF). `proyecto_id` SÍ cascada al borrar
-- el proyecto; `habitacion_id` NO lleva llave foránea a propósito:
-- pushConstruccionProyecto borra y reinserta las habitaciones en cada
-- guardado (conservan el mismo id, pero la fila física es otra) y si esta
-- tabla cascadeara por ahí se perderían las fotos con solo mover un muro. La
-- pantalla borra las fotos de una habitación a mano cuando se elimina ese
-- cuarto (deleteConstruccionFotosDeHabitacion). Bucket privado
-- (construccion-fotos, 20 MB, solo imágenes); mismo acceso que el resto de
-- construccion_*.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────
create table if not exists construccion_fotos (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references construccion_proyectos(id) on delete cascade,
  habitacion_id uuid not null,
  file_path text not null,
  nota text,
  orden int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_construccion_fotos_proyecto on construccion_fotos(proyecto_id);
create index if not exists idx_construccion_fotos_habitacion on construccion_fotos(habitacion_id);

alter table construccion_fotos enable row level security;

drop policy if exists "Authenticated manage construccion_fotos" on construccion_fotos;
create policy "Authenticated manage construccion_fotos" on construccion_fotos for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('construccion-fotos', 'construccion-fotos', false, 20971520, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = 20971520,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "Authenticated view construccion fotos" on storage.objects;
create policy "Authenticated view construccion fotos" on storage.objects
  for select using (bucket_id = 'construccion-fotos' and auth.role() = 'authenticated');

drop policy if exists "Authenticated upload construccion fotos" on storage.objects;
create policy "Authenticated upload construccion fotos" on storage.objects
  for insert with check (bucket_id = 'construccion-fotos' and auth.role() = 'authenticated');

drop policy if exists "Authenticated delete construccion fotos" on storage.objects;
create policy "Authenticated delete construccion fotos" on storage.objects
  for delete using (bucket_id = 'construccion-fotos' and auth.role() = 'authenticated');

