-- ─────────────────────────────────────────────
-- Cotejo de inspección previo a avalúo: checklist en campo (estructura,
-- servicios, habitabilidad, exteriores), con foto opcional por criterio y
-- firma en pantalla. El estatus (verde/amarillo/rojo) se guarda tal como lo
-- calculó el cliente al guardar (regla vive en src/lib/propertyInspection.js)
-- para no tener que duplicar esa lógica en SQL, pero es 100% derivable del
-- propio checklist si algún día hace falta recalcularlo en la base.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

create table if not exists property_inspections (
  id uuid primary key default gen_random_uuid(),
  folio text not null,
  property_id uuid references properties(id) on delete set null,
  direccion text not null,
  inspector text not null,
  visited_at timestamptz not null default now(),
  checklist jsonb not null default '[]',
  estatus text not null check (estatus in ('verde', 'amarillo', 'rojo')),
  observaciones text,
  signature_data text,
  signed_by text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_property_inspections_property on property_inspections(property_id);

alter table property_inspections enable row level security;

drop policy if exists "Rol con apartado inspecciones maneja property_inspections" on property_inspections;
create policy "Rol con apartado inspecciones maneja property_inspections" on property_inspections for all
  using (has_admin_section('inspecciones')) with check (has_admin_section('inspecciones'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('inspection-photos', 'inspection-photos', false, 20971520, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = 20971520,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "Rol con apartado inspecciones ve fotos" on storage.objects;
create policy "Rol con apartado inspecciones ve fotos" on storage.objects
  for select using (bucket_id = 'inspection-photos' and has_admin_section('inspecciones'));

drop policy if exists "Rol con apartado inspecciones sube fotos" on storage.objects;
create policy "Rol con apartado inspecciones sube fotos" on storage.objects
  for insert with check (bucket_id = 'inspection-photos' and has_admin_section('inspecciones'));

drop policy if exists "Rol con apartado inspecciones borra fotos" on storage.objects;
create policy "Rol con apartado inspecciones borra fotos" on storage.objects
  for delete using (bucket_id = 'inspection-photos' and has_admin_section('inspecciones'));

update admin_roles
set sections = array_append(sections, 'inspecciones')
where slug = 'admin' and not ('inspecciones' = any(sections));

