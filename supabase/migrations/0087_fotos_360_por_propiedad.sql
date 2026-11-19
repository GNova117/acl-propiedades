-- ─────────────────────────────────────────────
-- Fotos 360° por propiedad (2026-10-15)
-- Fotos panorámicas equirectangulares (no un recorrido 3D del plano, eso ya
-- existe en Construcción): el visor público las proyecta dentro de una
-- esfera y se arrastra para mirar alrededor. Mismo patrón de bucket público
-- que property-images/property-videos.
-- ─────────────────────────────────────────────

alter table properties add column if not exists tour_360_images text[] not null default '{}';

insert into storage.buckets (id, name, public)
values ('property-360', 'property-360', true)
on conflict (id) do nothing;

create policy "Public can view property 360 photos" on storage.objects
  for select using (bucket_id = 'property-360');

create policy "Authenticated can upload property 360 photos" on storage.objects
  for insert with check (bucket_id = 'property-360' and auth.role() = 'authenticated');

create policy "Authenticated can delete property 360 photos" on storage.objects
  for delete using (bucket_id = 'property-360' and auth.role() = 'authenticated');

