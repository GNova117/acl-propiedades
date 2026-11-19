-- ─────────────────────────────────────────────
-- Bitácora y gastos por propiedad (2026-09-18) — uso interno, NO público
-- `property_log`: una fila por entrada de la bitácora de una casa — una
-- `nota` (evento, sin dinero) o un `gasto` (fecha, categoría, concepto,
-- monto y, idealmente, un comprobante adjunto: foto o PDF de un ticket,
-- recibo o factura). Solo los gastos suman.
-- `property_budgets`: presupuesto propio de cada casa (un monto), contra el
-- que se compara TODO lo gastado. Va en su tabla y no como columna de
-- `properties` porque `properties` es legible con la anon key (el sitio
-- público la consulta directo) y el presupuesto es dato interno.
-- Los comprobantes van a un bucket PRIVADO (`property-log-files`): traen
-- números de cuenta y domicilio; se ven solo con URL firmada.
-- Todo se protege con has_admin_section('bitacora') — RLS en las tablas y en
-- el bucket, no solo ocultando el menú. Los gastos también los lee la
-- pantalla de Utilidad (línea "Gastos con comprobante"): quien tenga
-- 'liquidaciones' pero no 'bitacora' recibe 0 filas y su Utilidad simplemente
-- no los resta.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

create table if not exists property_log (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  kind text not null check (kind in ('nota', 'gasto')),
  entry_date date not null,
  categoria text, -- libre a propósito (predial, agua, luz, gas, mantenimiento, remodelacion, tramites, otro...): agregar una no requiere SQL
  concepto text,
  descripcion text,
  monto numeric check (monto is null or monto >= 0),
  file_path text,
  file_name text,
  file_type text,
  created_by text,
  created_at timestamptz not null default now(),
  -- un gasto siempre trae monto > 0, categoría y concepto; una nota, su texto
  check (kind <> 'gasto' or (monto is not null and monto > 0 and concepto is not null and categoria is not null)),
  check (kind <> 'nota' or descripcion is not null)
);

create index if not exists idx_property_log_property on property_log(property_id, entry_date);

alter table property_log enable row level security;

drop policy if exists "Rol con apartado bitacora maneja property_log" on property_log;
create policy "Rol con apartado bitacora maneja property_log" on property_log for all
  using (has_admin_section('bitacora'))
  with check (has_admin_section('bitacora'));

create table if not exists property_budgets (
  property_id uuid primary key references properties(id) on delete cascade,
  monto numeric not null default 0 check (monto >= 0),
  usuario_actualizo text,
  updated_at timestamptz not null default now()
);

alter table property_budgets enable row level security;

drop policy if exists "Rol con apartado bitacora maneja property_budgets" on property_budgets;
create policy "Rol con apartado bitacora maneja property_budgets" on property_budgets for all
  using (has_admin_section('bitacora'))
  with check (has_admin_section('bitacora'));

-- 20 MB por archivo (Storage en plan Free aplica hasta 50 MB de verdad; un
-- ticket o recibo no necesita más) y solo fotos o PDF.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'property-log-files', 'property-log-files', false, 20971520,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 20971520,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'];

drop policy if exists "Rol con apartado bitacora ve comprobantes" on storage.objects;
create policy "Rol con apartado bitacora ve comprobantes" on storage.objects
  for select using (bucket_id = 'property-log-files' and has_admin_section('bitacora'));

drop policy if exists "Rol con apartado bitacora sube comprobantes" on storage.objects;
create policy "Rol con apartado bitacora sube comprobantes" on storage.objects
  for insert with check (bucket_id = 'property-log-files' and has_admin_section('bitacora'));

drop policy if exists "Rol con apartado bitacora borra comprobantes" on storage.objects;
create policy "Rol con apartado bitacora borra comprobantes" on storage.objects
  for delete using (bucket_id = 'property-log-files' and has_admin_section('bitacora'));

update admin_roles
set sections = array_append(sections, 'bitacora')
where slug = 'admin' and not ('bitacora' = any(sections));

