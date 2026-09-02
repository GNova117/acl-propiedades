-- ACL Propiedades — Supabase schema
-- Run this in the Supabase SQL editor (Project > SQL Editor > New query).

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────

create table if not exists zones (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  price_per_m2 numeric not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists advisors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  photo_url text,
  phone text,
  email text,
  whatsapp text,
  bio text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists properties (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  type text not null check (type in ('casa', 'departamento', 'nave_industrial')),
  description text,
  price numeric not null,
  area_m2 numeric not null,
  bedrooms int,
  bathrooms numeric,
  parking int,
  zone text not null,
  address text not null,
  lat double precision not null,
  lng double precision not null,
  status text not null default 'disponible' check (status in ('disponible', 'apartada', 'vendida')),
  images text[] not null default '{}',
  main_image text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists property_advisors (
  property_id uuid references properties(id) on delete cascade,
  advisor_id uuid references advisors(id) on delete cascade,
  primary key (property_id, advisor_id)
);

create table if not exists contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_properties_type on properties(type);
create index if not exists idx_properties_zone on properties(zone);
create index if not exists idx_properties_active on properties(active);

-- ─────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────

alter table zones enable row level security;
alter table advisors enable row level security;
alter table properties enable row level security;
alter table property_advisors enable row level security;
alter table contact_messages enable row level security;

-- Public (anon) read access
create policy "Public can read zones" on zones for select using (true);
create policy "Public can read active advisors" on advisors for select using (true);
create policy "Public can read active properties" on properties for select using (true);
create policy "Public can read property_advisors" on property_advisors for select using (true);

-- Public can submit contact messages, but not read them back
create policy "Public can insert contact messages" on contact_messages for insert with check (true);

-- Authenticated admin: full read/write on everything
create policy "Authenticated manage zones" on zones for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated manage advisors" on advisors for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated manage properties" on properties for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated manage property_advisors" on property_advisors for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated read contact messages" on contact_messages for select using (auth.role() = 'authenticated');

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

-- ─────────────────────────────────────────────
-- Catálogo de materiales (lista de precios reutilizable)
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

create table if not exists materials_catalog (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  unit text,
  unit_price_internal numeric,
  unit_price_external numeric,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table materials_catalog enable row level security;

drop policy if exists "Authenticated manage materials_catalog" on materials_catalog;
create policy "Authenticated manage materials_catalog" on materials_catalog for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Estándar de consumo por material (opcional): cuánto material se necesita
-- por m² de piso, m² de muro, o m³ de volumen de un espacio. Vacío hasta que
-- el negocio defina sus propias referencias — no se inventan cifras aquí.
alter table materials_catalog add column if not exists consumption_rate numeric;
alter table materials_catalog add column if not exists consumption_basis text;

-- Espacios (cuartos/paredes) de un proyecto de remodelación: largo/ancho/alto
-- por espacio, usados para el mini render y las sugerencias de consumo.
alter table remodel_projects add column if not exists spaces jsonb not null default '[]';

-- ─────────────────────────────────────────────
-- Perfilamiento del vendedor (uno por inmueble; un cliente puede tener varios)
-- Contiene datos personales sensibles (RFC, CURP, identificación): tabla
-- 100% interna, sin lectura pública.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

create table if not exists perfilamientos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clients(id) on delete cascade,

  -- Sección 1: datos generales del vendedor
  nombre_completo text not null,
  fecha_nacimiento date not null,
  estado_civil text check (estado_civil in ('Soltero', 'Casado', 'Divorciado', 'Viudo', 'Unión libre')),
  domicilio text not null,
  correo text check (correo is null or correo ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  telefono text check (telefono is null or telefono ~ '^[0-9]{10}$'),
  rfc text check (rfc is null or rfc ~ '^[A-ZÑ&]{4}[0-9]{6}[A-Z0-9]{3}$'),
  curp text check (curp is null or curp ~ '^[A-Z]{4}[0-9]{6}[HM][A-Z]{5}[A-Z0-9]{2}$'),
  identificacion_oficial text,

  -- Sección 2: datos generales del inmueble
  ubicacion text not null,
  tipo_inmueble text check (tipo_inmueble in ('Casa habitación', 'Departamento', 'Terreno', 'Local comercial', 'Bodega', 'Otro')),
  caracteristicas text,
  superficie_terreno numeric,
  superficie_construccion numeric,
  uso_suelo text,
  antiguedad integer,
  forma_adquisicion text check (forma_adquisicion in ('Infonavit', 'Fovissste', 'Crédito bancario', 'Compraventa', 'Herencia', 'Donación', 'Otro')),
  gravamenes text check (gravamenes in ('Libre de gravamen', 'Con gravamen')),
  gravamenes_detalle text,
  registro_partida text,
  registro_libro text,
  registro_seccion text,
  registro_fecha_inscripcion date,

  usuario_creo text,
  fecha_creacion timestamptz not null default now(),
  fecha_modificacion timestamptz not null default now()
);

create index if not exists idx_perfilamientos_cliente on perfilamientos(cliente_id);

alter table perfilamientos enable row level security;

drop policy if exists "Authenticated manage perfilamientos" on perfilamientos;
create policy "Authenticated manage perfilamientos" on perfilamientos for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────
-- Perfilamiento del comprador (uno o varios por cliente)
-- Contiene datos personales sensibles (NSS, CURP, RFC) y, a petición
-- explícita del negocio, la contraseña del portal de crédito del comprador
-- (INFONAVIT/FOVISSSTE/banco) en texto plano — riesgo aceptado, ver README.
-- Tabla 100% interna, sin lectura pública.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

create table if not exists perfilamientos_comprador (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clients(id) on delete cascade,

  nombre text not null,
  nss text check (nss is null or nss ~ '^[0-9]{11}$'),
  telefono text check (telefono is null or telefono ~ '^[0-9]{10}$'),
  contrasena_portal text,
  fecha_nacimiento date not null,
  estado_civil text check (estado_civil in ('Soltero', 'Casado', 'Divorciado', 'Viudo', 'Unión libre')),
  domicilio text not null,
  correo text check (correo is null or correo ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  curp text check (curp is null or curp ~ '^[A-Z]{4}[0-9]{6}[HM][A-Z]{5}[A-Z0-9]{2}$'),
  rfc text check (rfc is null or rfc ~ '^[A-ZÑ&]{4}[0-9]{6}[A-Z0-9]{3}$'),
  registro_patronal text,
  tel_empresa text,
  razon_social text,
  referencia1_nombre text,
  referencia1_telefono text,
  referencia2_nombre text,
  referencia2_telefono text,

  usuario_creo text,
  fecha_creacion timestamptz not null default now(),
  fecha_modificacion timestamptz not null default now()
);

create index if not exists idx_perfilamientos_comprador_cliente on perfilamientos_comprador(cliente_id);

alter table perfilamientos_comprador enable row level security;

drop policy if exists "Authenticated manage perfilamientos_comprador" on perfilamientos_comprador;
create policy "Authenticated manage perfilamientos_comprador" on perfilamientos_comprador for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Nuevo documento capturable para el expediente del comprador: pago de
-- avalúo. Se busca y reemplaza el constraint existente por su definición
-- real (no por nombre adivinado), para no fallar si Postgres le puso un
-- nombre distinto al esperado.
do $$
declare
  con record;
begin
  for con in
    select conname from pg_constraint
    where conrelid = 'client_documents'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%doc_type%'
  loop
    execute format('alter table client_documents drop constraint %I', con.conname);
  end loop;
end $$;

alter table client_documents add constraint client_documents_doc_type_check
  check (doc_type in ('ine', 'curp', 'cedula_fiscal', 'acta_nacimiento', 'pago_avaluo'));
