-- ─────────────────────────────────────────────
-- Bitácora de progreso de remodelación: fotos de avance de obra y de
-- recibos, "tipo notas" — botón "Progreso" en /admin/remodelaciones.
-- Mismo patrón que client_documents (una fila por foto, sin límite por
-- tipo), pero con nota de texto opcional y sin el flujo de validación de
-- calidad de cámara (son fotos de sitio/recibos, no documentos de
-- identidad). Mismo nivel de seguridad que remodel_projects
-- (authenticated, no has_admin_section) — remodelaciones no está entre los
-- apartados con enforcement real en DB, y esta tabla es hija de esa.
-- ─────────────────────────────────────────────

create table if not exists remodel_progress_entries (
  id uuid primary key default gen_random_uuid(),
  remodel_project_id uuid not null references remodel_projects(id) on delete cascade,
  entry_type text not null check (entry_type in ('avance', 'recibo')),
  file_path text not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_remodel_progress_project on remodel_progress_entries(remodel_project_id);

alter table remodel_progress_entries enable row level security;

drop policy if exists "Authenticated manage remodel_progress_entries" on remodel_progress_entries;
create policy "Authenticated manage remodel_progress_entries" on remodel_progress_entries for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Bucket PRIVADO (a diferencia de property-images/advisor-photos)
insert into storage.buckets (id, name, public)
values ('remodel-progress', 'remodel-progress', false)
on conflict (id) do nothing;

drop policy if exists "Authenticated can view remodel progress photos" on storage.objects;
create policy "Authenticated can view remodel progress photos" on storage.objects
  for select using (bucket_id = 'remodel-progress' and auth.role() = 'authenticated');

drop policy if exists "Authenticated can upload remodel progress photos" on storage.objects;
create policy "Authenticated can upload remodel progress photos" on storage.objects
  for insert with check (bucket_id = 'remodel-progress' and auth.role() = 'authenticated');

drop policy if exists "Authenticated can delete remodel progress photos" on storage.objects;
create policy "Authenticated can delete remodel progress photos" on storage.objects
  for delete using (bucket_id = 'remodel-progress' and auth.role() = 'authenticated');

-- Naves Industriales pasa a tener su propio apartado ("naves_industriales")
-- en el sistema de roles, separado de "propiedades" — hasta ahora
-- compartían la misma llave, así que no se podían otorgar por separado
-- (el checkbox de Naves Industriales no aparecía en /admin/roles). No hay
-- cambio de RLS: la tabla properties sigue en auth.role() = 'authenticated'
-- para ambos apartados, igual que antes — esto es solo gating de UI/rutas.
-- Para no dejar a nadie sin el acceso que ya tenía, cualquier rol que hoy
-- incluya "propiedades" recibe también "naves_industriales" automáticamente;
-- de ahí en adelante se pueden otorgar por separado desde /admin/roles.
update admin_roles
set sections = array_append(sections, 'naves_industriales')
where 'propiedades' = any(sections) and not ('naves_industriales' = any(sections));

