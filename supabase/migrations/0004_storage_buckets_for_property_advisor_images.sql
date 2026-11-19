-- ─────────────────────────────────────────────
-- Storage buckets for property & advisor images
-- ─────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('property-images', 'property-images', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('advisor-photos', 'advisor-photos', true)
on conflict (id) do nothing;

create policy "Public can view property images" on storage.objects
  for select using (bucket_id = 'property-images');

create policy "Authenticated can upload property images" on storage.objects
  for insert with check (bucket_id = 'property-images' and auth.role() = 'authenticated');

create policy "Authenticated can delete property images" on storage.objects
  for delete using (bucket_id = 'property-images' and auth.role() = 'authenticated');

create policy "Public can view advisor photos" on storage.objects
  for select using (bucket_id = 'advisor-photos');

create policy "Authenticated can upload advisor photos" on storage.objects
  for insert with check (bucket_id = 'advisor-photos' and auth.role() = 'authenticated');

create policy "Authenticated can delete advisor photos" on storage.objects
  for delete using (bucket_id = 'advisor-photos' and auth.role() = 'authenticated');

insert into storage.buckets (id, name, public)
values ('blog-images', 'blog-images', true)
on conflict (id) do nothing;

create policy "Public can view blog images" on storage.objects
  for select using (bucket_id = 'blog-images');

create policy "Authenticated can upload blog images" on storage.objects
  for insert with check (bucket_id = 'blog-images' and auth.role() = 'authenticated');

create policy "Authenticated can delete blog images" on storage.objects
  for delete using (bucket_id = 'blog-images' and auth.role() = 'authenticated');

