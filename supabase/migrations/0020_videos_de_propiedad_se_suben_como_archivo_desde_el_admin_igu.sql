-- ─────────────────────────────────────────────
-- Videos de propiedad: se suben como archivo desde el admin (igual que las
-- fotos), varios por propiedad. Bucket separado de property-images porque
-- los videos pesan mucho más — aquí sí se fija un límite de tamaño y de
-- tipo de archivo a nivel de bucket, algo que property-images/advisor-photos
-- nunca tuvieron.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

alter table properties add column if not exists videos text[] not null default '{}';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('property-videos', 'property-videos', true, 104857600, array['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'])
on conflict (id) do update set file_size_limit = 104857600, allowed_mime_types = array['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];

drop policy if exists "Public can view property videos" on storage.objects;
create policy "Public can view property videos" on storage.objects
  for select using (bucket_id = 'property-videos');

drop policy if exists "Authenticated can upload property videos" on storage.objects;
create policy "Authenticated can upload property videos" on storage.objects
  for insert with check (bucket_id = 'property-videos' and auth.role() = 'authenticated');

drop policy if exists "Authenticated can delete property videos" on storage.objects;
create policy "Authenticated can delete property videos" on storage.objects
  for delete using (bucket_id = 'property-videos' and auth.role() = 'authenticated');

