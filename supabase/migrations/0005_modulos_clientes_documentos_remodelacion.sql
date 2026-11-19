-- ─────────────────────────────────────────────
-- Módulos: clientes, documentos, remodelación
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL
-- Editor de un proyecto Supabase que ya corrió el resto de este archivo)
-- ─────────────────────────────────────────────

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('comprador', 'vendedor', 'ambos')),
  email text,
  phone text,
  notes text,
  profile jsonb not null default '{}',  -- { buyer: {...}, seller: {...} }
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists client_documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  doc_type text not null check (doc_type in ('ine', 'curp', 'cedula_fiscal', 'acta_nacimiento')),
  file_path text not null,                       -- ruta en el bucket privado, no URL pública
  quality_metrics jsonb not null default '{}',    -- {sharpness, brightness, edgeDensity}
  captured_at timestamptz not null default now()
);

create table if not exists remodel_projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  client_id uuid references clients(id) on delete set null,  -- opcional
  area_m2 numeric not null,
  notes text,
  materials jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_client_documents_client on client_documents(client_id);
create index if not exists idx_remodel_projects_client on remodel_projects(client_id);

alter table clients enable row level security;
alter table client_documents enable row level security;
alter table remodel_projects enable row level security;

-- 100% interno: sin política de lectura pública (a diferencia de properties/advisors/zones)
drop policy if exists "Authenticated manage clients" on clients;
create policy "Authenticated manage clients" on clients for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated manage client_documents" on client_documents;
create policy "Authenticated manage client_documents" on client_documents for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated manage remodel_projects" on remodel_projects;
create policy "Authenticated manage remodel_projects" on remodel_projects for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Bucket PRIVADO (a diferencia de property-images/advisor-photos): documentos de identidad
insert into storage.buckets (id, name, public)
values ('client-documents', 'client-documents', false)
on conflict (id) do nothing;

drop policy if exists "Authenticated can view client documents" on storage.objects;
create policy "Authenticated can view client documents" on storage.objects
  for select using (bucket_id = 'client-documents' and auth.role() = 'authenticated');

drop policy if exists "Authenticated can upload client documents" on storage.objects;
create policy "Authenticated can upload client documents" on storage.objects
  for insert with check (bucket_id = 'client-documents' and auth.role() = 'authenticated');

drop policy if exists "Authenticated can delete client documents" on storage.objects;
create policy "Authenticated can delete client documents" on storage.objects
  for delete using (bucket_id = 'client-documents' and auth.role() = 'authenticated');

