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
  show_in_team boolean not null default true,
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

-- ─────────────────────────────────────────────
-- Liquidaciones (finanzas internas por vivienda: costo, devolución,
-- inversión, comisiones y utilidad de la sociedad). Módulo 100%
-- confidencial: a diferencia de TODAS las demás tablas de este archivo
-- (restringidas a "cualquier autenticado"), esta se restringe por RLS a
-- solo los dos correos de los socios — ni siquiera un futuro login de
-- asesor podría leerla, aunque tuviera sesión válida.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

create table if not exists liquidaciones (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,

  costo_total numeric not null default 0,
  devolucion_vendedor numeric not null default 0,
  inversion_remodelacion numeric not null default 0,
  inversion_servicios numeric not null default 0,
  captador_id uuid references advisors(id) on delete set null,
  vendedor_id uuid references advisors(id) on delete set null,

  -- Tasas capturables por liquidación (no fijas en el código): el negocio
  -- pidió poder ir ajustando el modelo mientras lo validan.
  tasa_comision_captacion numeric not null default 40,
  tasa_comision_venta numeric not null default 30,
  tasa_gastos_admin numeric not null default 10,

  usuario_actualizo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (property_id) -- una liquidación por vivienda
);

create index if not exists idx_liquidaciones_property on liquidaciones(property_id);

alter table liquidaciones enable row level security;

drop policy if exists "Solo socios manejan liquidaciones" on liquidaciones;
create policy "Solo socios manejan liquidaciones" on liquidaciones for all
  using (auth.email() in ('inmobiliaria@aclpropiedades.com', 'mh@aclpropiedades.com'))
  with check (auth.email() in ('inmobiliaria@aclpropiedades.com', 'mh@aclpropiedades.com'));

-- ─────────────────────────────────────────────
-- Integración Propiedades → Remodelaciones → Liquidación: el precio de la
-- propiedad y el total de materiales del proyecto de remodelación vinculado
-- dejan de capturarse a mano en Liquidación; se leen en vivo desde su
-- módulo de origen. Esta sección liga cada propiedad a un único proyecto de
-- remodelación (creado automáticamente al dar de alta la casa) y retira las
-- dos columnas de liquidaciones que ahora son siempre derivadas, nunca
-- capturadas ni guardadas.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

alter table remodel_projects add column if not exists property_id uuid references properties(id) on delete cascade;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'remodel_projects'::regclass and conname = 'remodel_projects_property_id_key'
  ) then
    alter table remodel_projects add constraint remodel_projects_property_id_key unique (property_id);
  end if;
end $$;

create index if not exists idx_remodel_projects_property on remodel_projects(property_id);

-- Backfill: liga cada propiedad que todavía no tenga proyecto de
-- remodelación (todas las creadas antes de esta integración) con uno nuevo.
-- Idempotente: no vuelve a insertar para propiedades que ya quedaron ligadas.
insert into remodel_projects (name, property_id, area_m2)
select p.title, p.id, p.area_m2
from properties p
where not exists (select 1 from remodel_projects r where r.property_id = p.id);

-- costo_total e inversion_remodelacion ya no se capturan ni se guardan: se
-- calculan en vivo desde properties.price y desde el proyecto de
-- remodelación vinculado (ver src/lib/liquidacion.js).
alter table liquidaciones drop column if exists costo_total;
alter table liquidaciones drop column if exists inversion_remodelacion;

-- ─────────────────────────────────────────────
-- Nuevo documento capturable para el expediente del cliente: contrato.
-- Mismo patrón que pago_avaluo — se busca y reemplaza el constraint
-- existente por su definición real, no por nombre adivinado.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

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
  check (doc_type in ('ine', 'curp', 'cedula_fiscal', 'acta_nacimiento', 'pago_avaluo', 'contrato'));

-- ─────────────────────────────────────────────
-- Nuevo tipo de propiedad (terreno) y tipo de operación (venta/compra).
-- Casas y departamentos siguen en el listado general "/propiedades";
-- naves industriales y terrenos pasan a tener su propio apartado en el
-- sitio público (ver src/lib/format.js propertyListPath). El tipo de
-- operación es un filtro nuevo: "venta" (lo normal) vs "compra" (solicitud
-- de un comprador).
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

do $$
declare
  con record;
begin
  for con in
    select conname from pg_constraint
    where conrelid = 'properties'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%type%'
      and pg_get_constraintdef(oid) ilike '%casa%'
  loop
    execute format('alter table properties drop constraint %I', con.conname);
  end loop;
end $$;

alter table properties add constraint properties_type_check
  check (type in ('casa', 'departamento', 'nave_industrial', 'terreno'));

alter table properties add column if not exists operation_type text not null default 'venta';

alter table properties drop constraint if exists properties_operation_type_check;
alter table properties add constraint properties_operation_type_check
  check (operation_type in ('venta', 'compra'));

-- ─────────────────────────────────────────────
-- Tipos de propiedad administrables (como zonas): el admin puede agregar
-- nuevos tipos desde /admin/zonas ("Tipos de propiedad") sin tocar código.
-- `properties.type` deja de estar limitado a un enum fijo — pasa a ser
-- texto libre, igual que `properties.zone` ya lo era respecto a `zones`.
--
-- También se corrige la operación: ya no es "venta" (agencia vende) vs.
-- "compra" (solicitud de comprador) — ahora es "compra" (disponible para
-- comprar) vs. "renta" (disponible para rentar). Solo aplica en el
-- apartado general "/propiedades"; Naves Industriales y Terrenos no
-- muestran este filtro por ahora.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

create table if not exists property_types (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  label text not null,
  created_at timestamptz not null default now()
);

alter table property_types enable row level security;

drop policy if exists "Public can read property_types" on property_types;
create policy "Public can read property_types" on property_types for select using (true);

drop policy if exists "Authenticated manage property_types" on property_types;
create policy "Authenticated manage property_types" on property_types for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

insert into property_types (key, label) values
  ('casa', 'Casa'),
  ('departamento', 'Departamento'),
  ('nave_industrial', 'Nave Industrial'),
  ('terreno', 'Terreno')
on conflict (key) do nothing;

do $$
declare
  con record;
begin
  for con in
    select conname from pg_constraint
    where conrelid = 'properties'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%type%'
      and pg_get_constraintdef(oid) ilike '%casa%'
  loop
    execute format('alter table properties drop constraint %I', con.conname);
  end loop;
end $$;

update properties set operation_type = 'compra' where operation_type = 'venta';

alter table properties drop constraint if exists properties_operation_type_check;
alter table properties add constraint properties_operation_type_check
  check (operation_type in ('compra', 'renta'));

alter table properties alter column operation_type set default 'compra';

-- ─────────────────────────────────────────────
-- Liquidaciones: "Costo total de liquidación" deja de tomarse en automático
-- del precio de la propiedad y vuelve a ser captura manual (el precio de
-- Propiedades ahora solo se muestra como referencia informativa aparte,
-- "Precio de la propiedad", que no alimenta el cálculo). "Inversión — pago
-- de servicios" deja de capturarse como monto — ahora es un porcentaje
-- (tasa_pago_servicios) sobre la inversión en remodelación, calculado en
-- vivo (no se guarda el monto derivado, mismo criterio que las demás tasas
-- de esta tabla).
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

alter table liquidaciones add column if not exists costo_total numeric not null default 0;
alter table liquidaciones add column if not exists tasa_pago_servicios numeric not null default 10;
alter table liquidaciones drop column if exists inversion_servicios;

-- ─────────────────────────────────────────────
-- Liquidaciones: "Costo total de liquidación" deja de capturarse a mano de
-- nuevo — el usuario probó el campo manual en producción y pidió revertirlo:
-- el Resumen debe calcular siempre directo desde el precio vigente de la
-- propiedad (properties.price), sin un número aparte que se pueda
-- desincronizar. Se quita la columna por completo; el campo "Precio de la
-- propiedad" (solo lectura) es ahora la única fuente.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

alter table liquidaciones drop column if exists costo_total;

-- ─────────────────────────────────────────────
-- Liquidaciones: "Costo total de liquidación" e "Inversión — pago de
-- servicios" vuelven a ser captura manual — se quita la interpolación
-- automática de ambos. "Precio de la propiedad" se conserva como campo de
-- solo lectura aparte, ahora también visible como línea de referencia en
-- el RESUMEN, sin alimentar el cálculo.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

alter table liquidaciones add column if not exists costo_total numeric not null default 0;
alter table liquidaciones add column if not exists inversion_servicios numeric not null default 0;

-- ─────────────────────────────────────────────
-- Tres apartados nuevos capturables en el expediente de documentos del
-- cliente: carta de deslindamiento, aviso de privacidad, carta de derechos.
-- Mismo patrón que pago_avaluo/contrato — se busca y reemplaza el
-- constraint existente por su definición real, no por nombre adivinado.
-- Sin límite de imágenes por tipo, igual que los 6 tipos ya existentes:
-- client_documents ya es una fila por imagen, así que varias capturas del
-- mismo doc_type para el mismo cliente ya funcionan sin cambios adicionales.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

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
  check (doc_type in ('ine', 'curp', 'cedula_fiscal', 'acta_nacimiento', 'pago_avaluo', 'contrato', 'carta_deslindamiento', 'aviso_privacidad', 'carta_derechos'));
alter table liquidaciones drop column if exists tasa_pago_servicios;

-- ─────────────────────────────────────────────
-- Sistema de roles y accesos del panel admin. Reemplaza la lista fija de 2
-- correos en src/lib/partners.js + la política RLS hardcodeada de
-- liquidaciones por un sistema general: `admin_roles` define nombre + qué
-- apartados otorga cada rol (editable desde /admin/roles sin tocar código
-- ni volver a correr SQL); `admin_access` asigna un rol a cada correo.
--
-- Solo quien tenga el apartado 'roles' puede crear/editar/borrar roles y
-- accesos — el mismo has_admin_section('roles') que oculta el menú también
-- es lo único que la base de datos exige para escribir aquí, así que un
-- rol nuevo al que se le dé 'roles' funciona de verdad, no solo se le
-- muestra el botón. `security definer` permite consultar admin_access/
-- admin_roles desde las políticas de esas mismas tablas sin recursión.
--
-- Nivel de protección elegido: Liquidaciones (ya era así) y Clientes (PII
-- real: INE/CURP/contraseña de portal) pasan a bloqueo real por rol a nivel
-- de base de datos. El resto de apartados (Propiedades, Asesores, Zonas,
-- Remodelaciones, Materiales, Crédito Infonavit) se siguen leyendo con
-- "cualquier autenticado" en RLS — el bloqueo por rol para esos vive solo en
-- el menú y las rutas del front, igual que ya funcionaba para casi todo el
-- sitio antes de este cambio.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

create table if not exists admin_roles (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  sections text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists admin_access (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  role_id uuid not null references admin_roles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create or replace function has_admin_section(section text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from admin_access aa
    join admin_roles ar on ar.id = aa.role_id
    where aa.email = auth.email()
      and section = any(ar.sections)
  );
$$;

alter table admin_roles enable row level security;
alter table admin_access enable row level security;

drop policy if exists "Authenticated read admin_roles" on admin_roles;
create policy "Authenticated read admin_roles" on admin_roles for select
  using (auth.role() = 'authenticated');

drop policy if exists "Solo admin crea admin_roles" on admin_roles;
create policy "Solo admin crea admin_roles" on admin_roles for insert
  with check (has_admin_section('roles'));

drop policy if exists "Solo admin actualiza admin_roles" on admin_roles;
create policy "Solo admin actualiza admin_roles" on admin_roles for update
  using (has_admin_section('roles')) with check (has_admin_section('roles'));

drop policy if exists "Solo admin borra admin_roles" on admin_roles;
create policy "Solo admin borra admin_roles" on admin_roles for delete
  using (has_admin_section('roles'));

drop policy if exists "Authenticated read admin_access" on admin_access;
create policy "Authenticated read admin_access" on admin_access for select
  using (auth.role() = 'authenticated');

drop policy if exists "Solo admin crea admin_access" on admin_access;
create policy "Solo admin crea admin_access" on admin_access for insert
  with check (has_admin_section('roles'));

drop policy if exists "Solo admin actualiza admin_access" on admin_access;
create policy "Solo admin actualiza admin_access" on admin_access for update
  using (has_admin_section('roles')) with check (has_admin_section('roles'));

drop policy if exists "Solo admin borra admin_access" on admin_access;
create policy "Solo admin borra admin_access" on admin_access for delete
  using (has_admin_section('roles'));

-- Roles iniciales pedidos por el negocio. sections usa las mismas claves que
-- SECTION_KEYS en src/lib/accessControl.js — un apartado nuevo se agrega ahí
-- y se le da a los roles que corresponda desde /admin/roles, no hace falta
-- volver a tocar este bloque.
insert into admin_roles (slug, name, sections)
values
  ('admin', 'Administrador', array['propiedades','asesores','zonas','clientes','remodelaciones','materiales','credito_infonavit','liquidaciones','roles']),
  ('asesores', 'Asesores', array['propiedades','clientes']),
  ('remodelaciones', 'Remodelaciones', array['remodelaciones','propiedades'])
on conflict (slug) do nothing;

insert into admin_access (email, role_id)
select seed.email, (select id from admin_roles where slug = 'admin')
from (values ('inmobiliaria@aclpropiedades.com'), ('mh@aclpropiedades.com')) as seed(email)
on conflict (email) do nothing;

-- Liquidaciones deja de depender de la lista fija de 2 correos en el código
-- — ahora es un apartado más del sistema de roles (solo 'admin' lo incluye
-- por ahora, pero se le puede dar a otro rol desde /admin/roles).
drop policy if exists "Solo socios manejan liquidaciones" on liquidaciones;
create policy "Rol con apartado liquidaciones maneja liquidaciones" on liquidaciones for all
  using (has_admin_section('liquidaciones'))
  with check (has_admin_section('liquidaciones'));

-- Clientes contiene PII real — pasa de "cualquier autenticado" a bloqueo
-- real por rol, igual que Liquidaciones.
drop policy if exists "Authenticated manage clients" on clients;
create policy "Rol con apartado clientes maneja clients" on clients for all
  using (has_admin_section('clientes')) with check (has_admin_section('clientes'));

drop policy if exists "Authenticated manage client_documents" on client_documents;
create policy "Rol con apartado clientes maneja client_documents" on client_documents for all
  using (has_admin_section('clientes')) with check (has_admin_section('clientes'));

drop policy if exists "Authenticated manage perfilamientos" on perfilamientos;
create policy "Rol con apartado clientes maneja perfilamientos" on perfilamientos for all
  using (has_admin_section('clientes')) with check (has_admin_section('clientes'));

drop policy if exists "Authenticated manage perfilamientos_comprador" on perfilamientos_comprador;
create policy "Rol con apartado clientes maneja perfilamientos_comprador" on perfilamientos_comprador for all
  using (has_admin_section('clientes')) with check (has_admin_section('clientes'));

drop policy if exists "Authenticated can view client documents" on storage.objects;
create policy "Rol con apartado clientes ve documentos" on storage.objects
  for select using (bucket_id = 'client-documents' and has_admin_section('clientes'));

drop policy if exists "Authenticated can upload client documents" on storage.objects;
create policy "Rol con apartado clientes sube documentos" on storage.objects
  for insert with check (bucket_id = 'client-documents' and has_admin_section('clientes'));

-- Especificaciones mínimas de publicidad inmobiliaria (NOM-247-SE-2021,
-- numeral 5): colindancias, instalaciones de servicios, acabados y
-- sistema constructivo. Opcionales — se capturan desde el formulario de
-- Propiedades y solo se muestran en la ficha pública si están llenas.
alter table properties add column if not exists colindancias text;
alter table properties add column if not exists servicios text;
alter table properties add column if not exists acabados text;
alter table properties add column if not exists sistema_constructivo text;

-- Especificaciones propias de Naves Industriales — Naves Industriales pasa
-- a tener su propio apartado en el admin (separado de Propiedades), con
-- estos campos extra además de los genéricos (área, precio, estacionamientos,
-- etc.) que ya comparte con casa/departamento/terreno. Todo opcional.
alter table properties add column if not exists techumbre text;
alter table properties add column if not exists condicion_propiedad text;
alter table properties add column if not exists estatus_construccion text;
alter table properties add column if not exists altura_libre numeric;
alter table properties add column if not exists anio_construccion int;
alter table properties add column if not exists area_minima_divisible numeric;
alter table properties add column if not exists area_oficina numeric;
alter table properties add column if not exists luz_natural_pct numeric;
alter table properties add column if not exists sistema_contra_incendios text;
alter table properties add column if not exists tipo_seguridad text;
alter table properties add column if not exists andenes_carga int;
alter table properties add column if not exists rampas_vehiculares int;
alter table properties add column if not exists mantenimiento_pct numeric;

drop policy if exists "Authenticated can delete client documents" on storage.objects;
create policy "Rol con apartado clientes borra documentos" on storage.objects
  for delete using (bucket_id = 'client-documents' and has_admin_section('clientes'));

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

-- ─────────────────────────────────────────────
-- Tipo de nave industrial (A / B) — solo aplica a properties.type =
-- 'nave_industrial', pero se deja como columna libre (sin check
-- constraint contra el tipo) para no tener que tocar SQL otra vez si el
-- negocio agrega una clasificación C/D más adelante; la UI ya solo
-- ofrece A/B por ahora.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

alter table properties add column if not exists tipo_nave text;

-- ─────────────────────────────────────────────
-- Catálogo de mano de obra: apartado nuevo dentro de Materiales, separado
-- de materials_catalog porque no es un material físico con doble precio
-- (propio/externo) — es un concepto de trabajo con un solo precio por
-- unidad (m², ml, pieza, etc., capturado libremente en `unidad`).
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

create table if not exists labor_catalog (
  id uuid primary key default gen_random_uuid(),
  concepto text not null,
  unidad text,
  precio_unitario numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table labor_catalog enable row level security;

drop policy if exists "Authenticated manage labor_catalog" on labor_catalog;
create policy "Authenticated manage labor_catalog" on labor_catalog for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────
-- Nuevo apartado "documentos_legales" (descargar Aviso de Privacidad y
-- Carta de Derechos en PDF membretado). No hay tabla nueva ni cambio de
-- RLS que hacer — el contenido sale de i18n, no de la base de datos — así
-- que aquí solo se le da el apartado al rol 'admin' por default; el
-- negocio puede dárselo a otro rol desde /admin/roles si hace falta.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

update admin_roles
set sections = array_append(sections, 'documentos_legales')
where slug = 'admin' and not ('documentos_legales' = any(sections));

-- ─────────────────────────────────────────────
-- Los tipos de propiedad (property_types) ahora se pueden activar/
-- desactivar desde /admin/zonas — un tipo inactivo se oculta del menú
-- (si tiene apartado propio, como Naves Industriales/Terrenos), se
-- muestra como "Próximamente" en el inicio, y su página dedicada
-- muestra el mismo aviso en vez del listado vacío. También se le puede
-- poner una imagen propia (se usa en las tarjetas de categoría del
-- inicio y, para Naves Industriales, en el panel del selector de arriba
-- del todo) — se sube al bucket property-images que ya existe, no hace
-- falta un bucket nuevo.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

alter table property_types add column if not exists active boolean not null default true;
alter table property_types add column if not exists image_url text;

-- ─────────────────────────────────────────────
-- Agenda por asesor: cada asesor ve solo sus propias citas; un correo con
-- el apartado 'agenda' pero SIN asesor vinculado (admin_access.advisor_id
-- null) ve las de todos — así "administración" no es un rol especial, es
-- simplemente un acceso al que no se le vinculó ningún asesor. Vincular un
-- correo a un asesor se hace desde /admin/roles (nueva columna "Asesor" en
-- la tabla de accesos).
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

alter table admin_access add column if not exists advisor_id uuid references advisors(id) on delete set null;

create table if not exists agenda_citas (
  id uuid primary key default gen_random_uuid(),
  advisor_id uuid not null references advisors(id) on delete cascade,
  client_id uuid references clients(id) on delete set null,
  titulo text not null,
  fecha date not null,
  hora time,
  actividades text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists agenda_expedientes (
  id uuid primary key default gen_random_uuid(),
  cita_id uuid not null references agenda_citas(id) on delete cascade,
  file_path text not null,
  file_name text,
  created_at timestamptz not null default now()
);

create index if not exists idx_agenda_citas_advisor on agenda_citas(advisor_id);
create index if not exists idx_agenda_citas_fecha on agenda_citas(fecha);
create index if not exists idx_agenda_expedientes_cita on agenda_expedientes(cita_id);

alter table agenda_citas enable row level security;
alter table agenda_expedientes enable row level security;

-- security definer, mismo motivo que has_admin_section: consultar
-- admin_access desde las políticas de agenda_citas sin recursión.
create or replace function my_advisor_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select advisor_id from admin_access where email = auth.email();
$$;

drop policy if exists "Ver citas propias o todas con agenda" on agenda_citas;
create policy "Ver citas propias o todas con agenda" on agenda_citas for select
  using (has_admin_section('agenda') and (my_advisor_id() is null or my_advisor_id() = advisor_id));

drop policy if exists "Crear citas propias o todas con agenda" on agenda_citas;
create policy "Crear citas propias o todas con agenda" on agenda_citas for insert
  with check (has_admin_section('agenda') and (my_advisor_id() is null or my_advisor_id() = advisor_id));

drop policy if exists "Editar citas propias o todas con agenda" on agenda_citas;
create policy "Editar citas propias o todas con agenda" on agenda_citas for update
  using (has_admin_section('agenda') and (my_advisor_id() is null or my_advisor_id() = advisor_id))
  with check (has_admin_section('agenda') and (my_advisor_id() is null or my_advisor_id() = advisor_id));

drop policy if exists "Borrar citas propias o todas con agenda" on agenda_citas;
create policy "Borrar citas propias o todas con agenda" on agenda_citas for delete
  using (has_admin_section('agenda') and (my_advisor_id() is null or my_advisor_id() = advisor_id));

drop policy if exists "Gestionar expedientes de citas propias o todas" on agenda_expedientes;
create policy "Gestionar expedientes de citas propias o todas" on agenda_expedientes for all
  using (
    has_admin_section('agenda') and exists (
      select 1 from agenda_citas c
      where c.id = agenda_expedientes.cita_id
        and (my_advisor_id() is null or my_advisor_id() = c.advisor_id)
    )
  )
  with check (
    has_admin_section('agenda') and exists (
      select 1 from agenda_citas c
      where c.id = agenda_expedientes.cita_id
        and (my_advisor_id() is null or my_advisor_id() = c.advisor_id)
    )
  );

-- Bucket PRIVADO, mismo patrón que client-documents/remodel-progress. Sin
-- aislamiento por asesor a nivel de Storage (igual que client-documents):
-- cualquier correo con el apartado 'agenda' puede leer/subir cualquier
-- objeto del bucket — el aislamiento real de "solo mis citas" vive en las
-- políticas de agenda_citas/agenda_expedientes de arriba, no aquí.
insert into storage.buckets (id, name, public)
values ('agenda-expedientes', 'agenda-expedientes', false)
on conflict (id) do nothing;

drop policy if exists "Rol con apartado agenda ve expedientes" on storage.objects;
create policy "Rol con apartado agenda ve expedientes" on storage.objects
  for select using (bucket_id = 'agenda-expedientes' and has_admin_section('agenda'));

drop policy if exists "Rol con apartado agenda sube expedientes" on storage.objects;
create policy "Rol con apartado agenda sube expedientes" on storage.objects
  for insert with check (bucket_id = 'agenda-expedientes' and has_admin_section('agenda'));

drop policy if exists "Rol con apartado agenda borra expedientes" on storage.objects;
create policy "Rol con apartado agenda borra expedientes" on storage.objects
  for delete using (bucket_id = 'agenda-expedientes' and has_admin_section('agenda'));

update admin_roles
set sections = array_append(sections, 'agenda')
where slug in ('admin', 'asesores') and not ('agenda' = any(sections));

-- ─────────────────────────────────────────────
-- Buscador de propiedades: amenidades administrables, filtro de
-- recámaras/baños/estacionamiento (las columnas ya existían, solo faltaba
-- conectarlas), orden de resultados, y código corto de referencia
-- (ACL-1001, ACL-1002, ...) para compartir/buscar sin exponer el UUID.
-- amenities_catalog usa el mismo shape que property_types (id/key/label/
-- active) — se administra desde /admin/zonas, apartado "zonas" (no se
-- crea un apartado nuevo solo para esto).
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

create table if not exists amenities_catalog (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  label text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table amenities_catalog enable row level security;

drop policy if exists "Public can read amenities_catalog" on amenities_catalog;
create policy "Public can read amenities_catalog" on amenities_catalog for select using (true);

-- Mismo nivel que property_types/zones (authenticated, no has_admin_section):
-- "zonas" nunca pasó al bloqueo real por rol, solo property_types y agenda
-- lo tienen — amenidades vive en esa misma página, mismo criterio.
drop policy if exists "Authenticated manage amenities_catalog" on amenities_catalog;
create policy "Authenticated manage amenities_catalog" on amenities_catalog for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

insert into amenities_catalog (key, label) values
  ('alberca', 'Alberca'),
  ('seguridad_24h', 'Seguridad 24h'),
  ('acepta_mascotas', 'Acepta mascotas'),
  ('amueblado', 'Amueblado'),
  ('estacionamiento_techado', 'Estacionamiento techado'),
  ('area_comun', 'Área común / jardín'),
  ('aire_acondicionado', 'Aire acondicionado'),
  ('bodega', 'Bodega')
on conflict (key) do nothing;

alter table properties add column if not exists amenities text[] not null default '{}';
create index if not exists idx_properties_amenities on properties using gin(amenities);

alter table properties add column if not exists updated_at timestamptz not null default now();

create sequence if not exists properties_code_seq start 1001;

alter table properties add column if not exists code text;

create or replace function set_property_code()
returns trigger
language plpgsql
as $$
begin
  if new.code is null then
    new.code := 'ACL-' || nextval('properties_code_seq');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_property_code on properties;
create trigger trg_set_property_code
before insert on properties
for each row execute function set_property_code();

-- Backfill de filas existentes sin código (no-op en una base ya migrada).
update properties set code = 'ACL-' || nextval('properties_code_seq') where code is null;

alter table properties alter column code set not null;
create unique index if not exists idx_properties_code on properties(code);

-- ─────────────────────────────────────────────
-- Avisos de agenda por WhatsApp: resumen matutino (7am hora de México) y
-- recordatorio 30 min antes de cada cita, vía dos Edge Functions
-- (supabase/functions/agenda-resumen-diario, agenda-recordatorio-30min)
-- disparadas por pg_cron. Las credenciales reales (URL del proyecto,
-- llave pública, y el secreto que autoriza al cron a llamar las
-- funciones) NO van en este archivo — este repo es público en GitHub. Se
-- guardan aparte en Supabase Vault con un bloque que Claude te entrega
-- fuera de este archivo, para correr una sola vez.
-- (bloque re-ejecutable: cron.schedule con un nombre que ya existe
-- actualiza ese job en vez de duplicarlo)
-- ─────────────────────────────────────────────

create extension if not exists pg_cron;
create extension if not exists pg_net;

alter table agenda_citas add column if not exists reminder_sent_at timestamptz;

create table if not exists agenda_resumenes_enviados (
  advisor_id uuid not null references advisors(id) on delete cascade,
  fecha date not null,
  created_at timestamptz not null default now(),
  primary key (advisor_id, fecha)
);

alter table agenda_resumenes_enviados enable row level security;

drop policy if exists "Rol con apartado agenda lee resumenes enviados" on agenda_resumenes_enviados;
create policy "Rol con apartado agenda lee resumenes enviados" on agenda_resumenes_enviados for select
  using (has_admin_section('agenda'));

select cron.schedule(
  'agenda-resumen-diario',
  '0 13 * * *', -- 7:00am hora de México (UTC-6 fijo, sin horario de verano)
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/agenda-resumen-diario',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key'),
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'agenda_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'agenda-recordatorio-30min',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/agenda-recordatorio-30min',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key'),
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'agenda_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ─────────────────────────────────────────────
-- Bandeja de "Mensajes de contacto" en el admin (/admin/mensajes). Hasta
-- ahora contact_messages solo se podía insertar (público) y leer
-- (cualquier autenticado) — no había forma de marcarlos como atendidos ni
-- borrarlos. Se agrega un estado simple (nuevo/atendido, no un historial)
-- y las políticas de update/delete que faltaban, al mismo nivel de
-- confianza que ya tenía el select ('authenticated', sin has_admin_section
-- — mismo criterio que Propiedades/Zonas: no hay RFC/CURP/dinero aquí,
-- solo nombre/correo/teléfono/mensaje de quien llenó el formulario público).
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

alter table contact_messages add column if not exists status text not null default 'nuevo';

drop policy if exists "Authenticated update contact messages" on contact_messages;
create policy "Authenticated update contact messages" on contact_messages for update
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated delete contact messages" on contact_messages;
create policy "Authenticated delete contact messages" on contact_messages for delete
  using (auth.role() = 'authenticated');

update admin_roles
set sections = array_append(sections, 'mensajes')
where slug = 'admin' and not ('mensajes' = any(sections));

-- ─────────────────────────────────────────────
-- Aviso por WhatsApp cuando llega un mensaje de contacto nuevo. A
-- diferencia de los avisos de Agenda (pg_cron, corren en una ventana de
-- tiempo), este es por evento: un trigger after insert en
-- contact_messages llama a la función mensaje-contacto-whatsapp una sola
-- vez por mensaje, sin necesidad de reclamo/dedup. security definer para
-- que corra con los permisos del dueño de la función (no los del rol
-- 'anon' que hizo el insert público) al leer vault.decrypted_secrets —
-- mismo motivo por el que has_admin_section()/my_advisor_id() son
-- security definer. Reusa el mismo secreto compartido que ya protege las
-- funciones de Agenda (vault 'agenda_cron_secret' ↔ función CRON_SECRET) —
-- no hace falta un secreto nuevo para esto.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

create or replace function notify_new_contact_message() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/mensaje-contacto-whatsapp',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key'),
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'agenda_cron_secret')
    ),
    body := jsonb_build_object('name', new.name, 'phone', new.phone, 'message', new.message)
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_new_contact_message on contact_messages;
create trigger trg_notify_new_contact_message
after insert on contact_messages
for each row execute function notify_new_contact_message();

-- ─────────────────────────────────────────────
-- Testimonios administrables (/admin/testimonios) + sección de confianza
-- en el inicio ("Lo que dicen nuestros clientes"). A diferencia de
-- zonas/tipos de propiedad/amenidades (que son taxonomía de propiedades y
-- comparten el apartado "zonas"), esto es contenido de marketing —
-- distinto lo suficiente como para tener su propio apartado, mismo
-- criterio que se usó para "documentos_legales". Mismo nivel de RLS que
-- amenities_catalog: público puede leer todo (el filtro de "activo" para
-- el sitio público se hace en el cliente, no en RLS), autenticado
-- administra todo.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

create table if not exists testimonials (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text,
  quote text not null,
  rating integer not null default 5 check (rating between 1 and 5),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table testimonials enable row level security;

drop policy if exists "Public can read testimonials" on testimonials;
create policy "Public can read testimonials" on testimonials for select using (true);

drop policy if exists "Authenticated manage testimonials" on testimonials;
create policy "Authenticated manage testimonials" on testimonials for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

update admin_roles
set sections = array_append(sections, 'testimonios')
where slug = 'admin' and not ('testimonios' = any(sections));

-- ─────────────────────────────────────────────
-- Historial de cambios de precio/estatus por propiedad (botón "Historial"
-- en /admin/propiedades y /admin/naves-industriales). Se registra con un
-- trigger after update en properties, no desde el código del admin — así
-- queda capturado sin importar qué pantalla hizo el cambio, y no se puede
-- omitir por accidente. security definer + auth.email() por el mismo
-- motivo que has_admin_section()/my_advisor_id(): adentro del trigger
-- necesita insertar en property_changes aunque quien hizo el update no
-- tenga permiso de insert ahí directamente (no hay política de insert
-- para 'authenticated' a propósito, así el historial no se puede editar
-- ni borrar desde la app, solo lo escribe el trigger).
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

create table if not exists property_changes (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  changed_by text,
  field text not null,
  old_value text,
  new_value text,
  created_at timestamptz not null default now()
);

create index if not exists idx_property_changes_property on property_changes(property_id);

alter table property_changes enable row level security;

drop policy if exists "Authenticated read property_changes" on property_changes;
create policy "Authenticated read property_changes" on property_changes for select
  using (auth.role() = 'authenticated');

create or replace function log_property_changes() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor text := auth.email();
begin
  if new.price is distinct from old.price then
    insert into property_changes (property_id, changed_by, field, old_value, new_value)
    values (new.id, actor, 'price', old.price::text, new.price::text);
  end if;
  if new.status is distinct from old.status then
    insert into property_changes (property_id, changed_by, field, old_value, new_value)
    values (new.id, actor, 'status', old.status, new.status);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_log_property_changes on properties;
create trigger trg_log_property_changes
after update on properties
for each row execute function log_property_changes();

-- ─────────────────────────────────────────────
-- Asesor "oculto" del listado público de /nosotros (2026-09-14)
-- Algunos registros de `advisors` (ej. "ACL Propiedades") existen solo
-- como contacto de respaldo para propiedades sin un agente asignado, no
-- como un integrante real del equipo — antes aparecían igual en la
-- tarjeta de /nosotros. `show_in_team` deja seguir usándolos como asesor
-- de una propiedad sin tocar nada más; solo controla si salen listados
-- en la página pública. Default true para no ocultar a nadie que ya
-- estaba visible.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

alter table advisors add column if not exists show_in_team boolean not null default true;

-- ─────────────────────────────────────────────
-- Expediente conjunto para 2 clientes (2026-09-14)
-- Caso real: una pareja que junta su crédito INFONAVIT y aplica como
-- 2 acreditados — cada quien sigue siendo su propio registro en
-- `clients` (su propio perfilamiento, sus propios documentos, cada uno
-- con su propia clave de portal), pero se necesita verlos juntos en
-- una sola pantalla en vez de brincar entre dos fichas separadas.
-- `client_links` es una tabla de relación simple (un par por fila, no
-- se fusiona ningún dato) — mismo nivel de RLS que `clients` porque
-- expone qué 2 personas están vinculadas, que es información sensible
-- del mismo tipo que el resto del expediente del cliente.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

create table if not exists client_links (
  id uuid primary key default gen_random_uuid(),
  client_a_id uuid not null references clients(id) on delete cascade,
  client_b_id uuid not null references clients(id) on delete cascade,
  label text,
  created_at timestamptz not null default now(),
  check (client_a_id <> client_b_id)
);

create index if not exists idx_client_links_a on client_links(client_a_id);
create index if not exists idx_client_links_b on client_links(client_b_id);

alter table client_links enable row level security;

drop policy if exists "Rol con apartado clientes maneja client_links" on client_links;
create policy "Rol con apartado clientes maneja client_links" on client_links for all
  using (has_admin_section('clientes')) with check (has_admin_section('clientes'));

-- ─────────────────────────────────────────────
-- Documentos del expediente para avalúos (2026-09-15)
-- El avalúo se entrega con un expediente armado: del comprador la
-- solicitud de avalúo + identificación, y del vendedor los documentos del
-- inmueble (escrituras, predial, agua, luz) + su identificación. Los
-- 5 tipos nuevos son: solicitud_avaluo, escrituras, predial, agua, luz.
-- El RFC NO es un tipo nuevo: es `cedula_fiscal`, que ya existía (la
-- cédula de identificación fiscal es el documento del RFC) y solo cambia
-- su etiqueta en la interfaz.
-- Mismo patrón que pago_avaluo/contrato — se busca y reemplaza el
-- constraint existente por su definición real, no por nombre adivinado.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

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
  check (doc_type in ('ine', 'curp', 'cedula_fiscal', 'acta_nacimiento', 'pago_avaluo', 'contrato', 'carta_deslindamiento', 'aviso_privacidad', 'carta_derechos', 'solicitud_avaluo', 'escrituras', 'predial', 'agua', 'luz'));

-- ─────────────────────────────────────────────
-- Cada solicitud del sitio llega al asesor de esa propiedad
-- (2026-09-17). Hasta ahora un contact_message no sabía de qué propiedad
-- venía: el título iba dentro del texto y el aviso por WhatsApp llegaba
-- siempre a los mismos números de oficina. Se agrega property_id (lo
-- llenan la tarjeta "¿Te interesa esta propiedad?" y "Agendar visita" de
-- la ficha pública; los mensajes del formulario de Contacto lo dejan en
-- null a propósito, son generales).
--
-- El asesor NO se copia en una columna: se deriva de property_advisors al
-- momento de leer/avisar. Si mañana se reasigna la propiedad, el mensaje
-- viejo apunta a quien la lleva hoy, que es a quien hay que buscar para
-- darle seguimiento. `on delete set null` conserva el mensaje aunque se
-- borre la propiedad (perder el dato de contacto de un interesado sería
-- peor que perder el vínculo).
--
-- Quién VE qué no cambia: cualquier correo con el apartado 'mensajes'
-- sigue viendo la bandeja completa (decisión explícita del negocio) — la
-- columna "Propiedad / asesor" y el filtro por asesor de /admin/mensajes
-- son de UI, no de RLS. Si algún día se quiere aislar de verdad por
-- asesor, el patrón a copiar es el de agenda_citas (my_advisor_id()).
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

alter table contact_messages add column if not exists property_id uuid references properties(id) on delete set null;

create index if not exists idx_contact_messages_property on contact_messages(property_id);

-- Mismo trigger de siempre, pero ahora resuelve los teléfonos de los
-- asesores de la propiedad y se los pasa a la función en el body. Se hace
-- aquí (y no dentro de la Edge Function) porque el trigger ya está en la
-- base con permisos para leerlo, y así la función sigue sin consultar
-- Supabase. Prefiere el WhatsApp del asesor sobre su teléfono normal,
-- ignora asesores inactivos y a los que no tienen ningún número.
create or replace function notify_new_contact_message() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  advisor_phones jsonb := '[]'::jsonb;
begin
  if new.property_id is not null then
    select coalesce(jsonb_agg(numero), '[]'::jsonb) into advisor_phones
    from (
      select coalesce(nullif(btrim(a.whatsapp), ''), nullif(btrim(a.phone), '')) as numero
      from property_advisors pa
      join advisors a on a.id = pa.advisor_id
      where pa.property_id = new.property_id
        and a.active
    ) s
    where numero is not null;
  end if;

  perform net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/mensaje-contacto-whatsapp',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key'),
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'agenda_cron_secret')
    ),
    body := jsonb_build_object(
      'name', new.name,
      'phone', new.phone,
      'message', new.message,
      'advisorPhones', advisor_phones
    )
  );
  return new;
end;
$$;

-- ─────────────────────────────────────────────
-- Datos del expediente pegados al cliente (2026-09-17)
-- Al comprador se le piden NSS, contraseña del portal de crédito y 2
-- referencias personales (nombre, teléfono, correo y dirección); al
-- vendedor, el número de crédito con el que paga el inmueble que vende.
-- Estos datos ya se capturaban en el perfilamiento y se siguen capturando
-- ahí: a petición explícita del negocio se piden en los dos lados, cada
-- pantalla con su propia copia. En `clients` viven para que el expediente
-- para avalúos pueda imprimir la hoja de datos sin depender de que exista
-- un perfilamiento. La contraseña queda en texto plano igual que en
-- perfilamientos_comprador — mismo riesgo aceptado, ver README.
-- Además se completan las referencias del perfilamiento del comprador
-- (antes solo nombre y teléfono) y se agrega el número de crédito al
-- perfilamiento del vendedor.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

alter table clients add column if not exists nss text;
alter table clients add column if not exists contrasena_portal text;
alter table clients add column if not exists numero_credito text;
alter table clients add column if not exists referencia1_nombre text;
alter table clients add column if not exists referencia1_telefono text;
alter table clients add column if not exists referencia1_correo text;
alter table clients add column if not exists referencia1_direccion text;
alter table clients add column if not exists referencia2_nombre text;
alter table clients add column if not exists referencia2_telefono text;
alter table clients add column if not exists referencia2_correo text;
alter table clients add column if not exists referencia2_direccion text;

alter table perfilamientos_comprador add column if not exists referencia1_correo text;
alter table perfilamientos_comprador add column if not exists referencia1_direccion text;
alter table perfilamientos_comprador add column if not exists referencia2_correo text;
alter table perfilamientos_comprador add column if not exists referencia2_direccion text;

alter table perfilamientos add column if not exists numero_credito text;

-- ─────────────────────────────────────────────
-- Datos de la empresa del comprador en el cliente (2026-09-17)
-- El trámite de crédito pide comprobar la relación laboral: razón social,
-- registro patronal y número de la empresa. Ya se capturaban en el
-- perfilamiento del comprador (mismas llaves) y ahora también van pegados
-- al cliente, para que la hoja de datos del expediente para avalúos los
-- imprima sin depender de que exista un perfilamiento.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

alter table clients add column if not exists razon_social text;
alter table clients add column if not exists registro_patronal text;
alter table clients add column if not exists tel_empresa text;

-- ─────────────────────────────────────────────
-- Cuenta bancaria del vendedor (2026-09-17)
-- Documento nuevo capturable solo en el expediente del vendedor: el estado
-- de cuenta/carátula donde se le deposita el pago de la operación. No entra
-- en el PDF del expediente para avalúos (ese orden lo define el valuador y
-- la cuenta es para el cobro, no para el avalúo), pero se puede ver y
-- descargar como cualquier otro documento del cliente.
-- Mismo patrón que los tipos anteriores — se busca y reemplaza el constraint
-- existente por su definición real, no por nombre adivinado.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

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
  check (doc_type in ('ine', 'curp', 'cedula_fiscal', 'acta_nacimiento', 'pago_avaluo', 'contrato', 'carta_deslindamiento', 'aviso_privacidad', 'carta_derechos', 'solicitud_avaluo', 'escrituras', 'predial', 'agua', 'luz', 'cuenta_bancaria'));

-- ─────────────────────────────────────────────
-- Ventas y reportes (2026-09-18) — uso interno, NO público
-- `ventas` registra quién vendió cada propiedad y en qué fecha (una por
-- propiedad). Vive en su propia tabla y NO como columnas de `properties` a
-- propósito: `properties` es legible por cualquiera con la anon key (el sitio
-- público la consulta directo), y quién vendió/cuándo es dato interno del
-- negocio. Se protege igual que Clientes/Liquidaciones: RLS con
-- has_admin_section('reportes'), no solo ocultando el menú.
-- Las ganancias NO se guardan aquí: se calculan al vuelo con las
-- liquidaciones existentes (mismo cálculo que la pantalla de Utilidad).
-- La casa que ya estaba marcada "vendida" antes de esto no trae registro:
-- aparece en "Pendientes de registrar" dentro de /admin/reportes.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

create table if not exists ventas (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  advisor_id uuid references advisors(id) on delete set null,
  fecha_venta date not null,
  usuario_registro text,
  created_at timestamptz not null default now(),
  unique (property_id) -- una venta por propiedad
);

create index if not exists idx_ventas_advisor on ventas(advisor_id);
create index if not exists idx_ventas_fecha on ventas(fecha_venta);

alter table ventas enable row level security;

drop policy if exists "Rol con apartado reportes maneja ventas" on ventas;
create policy "Rol con apartado reportes maneja ventas" on ventas for all
  using (has_admin_section('reportes'))
  with check (has_admin_section('reportes'));

update admin_roles
set sections = array_append(sections, 'reportes')
where slug = 'admin' and not ('reportes' = any(sections));

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

-- ─────────────────────────────────────────────
-- Valuación por zona (2026-09-21) — uso interno (/admin/valuacion)
-- Cada zona pasa a tener dos precios por m²: `price_per_m2` (que ya existía y
-- se usa como precio de CONSTRUCCIÓN) y `land_price_per_m2` (TERRENO, nuevo).
-- Arranca en 0: la pantalla avisa "esta zona no tiene precio de terreno" en
-- lugar de inventar un valor; se captura desde /admin/zonas.
-- OJO: `zones` tiene lectura pública (el sitio la consulta con la anon key), así
-- que este precio queda legible igual que `price_per_m2`, aunque ninguna página
-- pública lo muestre. Si algún día debe ser privado, va en una tabla aparte con
-- RLS has_admin_section('valuacion').
-- El apartado no tiene tabla propia (no guarda valuaciones, solo calcula): lo
-- único que requiere es darle el permiso al rol Administrador.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

alter table zones add column if not exists land_price_per_m2 numeric not null default 0;

update admin_roles
set sections = array_append(sections, 'valuacion')
where slug = 'admin' and not ('valuacion' = any(sections));

-- ─────────────────────────────────────────────
-- Construcción (2026-09-22) — mediciones, plano 2D/3D, presupuesto y valuación
-- de obra (/admin/construccion). Apartado nuevo e independiente de
-- Remodelaciones (remodel_projects/materials_catalog/labor_catalog) — no
-- comparte datos con ese módulo, a propósito (decisión explícita al migrar
-- desde el prototipo standalone app-construccion).
-- Todos los ids los genera el cliente con crypto.randomUUID() antes de
-- insertar, nunca se leen de vuelta tras un insert.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

create table if not exists construccion_proyectos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  cliente text,
  direccion text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists construccion_habitaciones (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references construccion_proyectos(id) on delete cascade,
  nombre text not null,
  tipo text,
  tipo_piso text,
  tipo_pared text,
  tipo_techo text
);

-- Polilínea de un muro: puntos = [{x, z}, {x, z}] en metros.
create table if not exists construccion_muros (
  id uuid primary key default gen_random_uuid(),
  habitacion_id uuid not null references construccion_habitaciones(id) on delete cascade,
  puntos jsonb not null,
  altura numeric not null default 2.5,
  espesor numeric not null default 0.15,
  orden int not null default 0
);

create table if not exists construccion_aberturas (
  id uuid primary key default gen_random_uuid(),
  muro_id uuid not null references construccion_muros(id) on delete cascade,
  tipo text not null check (tipo in ('puerta', 'ventana')),
  offset_m numeric not null,
  ancho numeric not null,
  alto numeric not null,
  alto_desde_piso numeric not null default 0
);

-- Catálogo global de Construcción — independiente de materials_catalog (Remodelaciones) a propósito.
-- id es texto (no uuid): el catálogo por defecto usa slugs legibles ("block", "cemento"…).
create table if not exists construccion_catalogo_materiales (
  id text primary key,
  nombre text not null,
  unidad text not null,
  fuente text not null check (fuente in ('area_muro', 'area_piso', 'perimetro')),
  factor numeric not null,
  precio_unitario numeric not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists idx_construccion_habitaciones_proyecto on construccion_habitaciones(proyecto_id);
create index if not exists idx_construccion_muros_habitacion on construccion_muros(habitacion_id);
create index if not exists idx_construccion_aberturas_muro on construccion_aberturas(muro_id);

alter table construccion_proyectos enable row level security;
alter table construccion_habitaciones enable row level security;
alter table construccion_muros enable row level security;
alter table construccion_aberturas enable row level security;
alter table construccion_catalogo_materiales enable row level security;

drop policy if exists "Authenticated manage construccion_proyectos" on construccion_proyectos;
create policy "Authenticated manage construccion_proyectos" on construccion_proyectos for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated manage construccion_habitaciones" on construccion_habitaciones;
create policy "Authenticated manage construccion_habitaciones" on construccion_habitaciones for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated manage construccion_muros" on construccion_muros;
create policy "Authenticated manage construccion_muros" on construccion_muros for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated manage construccion_aberturas" on construccion_aberturas;
create policy "Authenticated manage construccion_aberturas" on construccion_aberturas for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated manage construccion_catalogo_materiales" on construccion_catalogo_materiales;
create policy "Authenticated manage construccion_catalogo_materiales" on construccion_catalogo_materiales for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

update admin_roles
set sections = array_append(sections, 'construccion')
where slug = 'admin' and not ('construccion' = any(sections));

-- ─────────────────────────────────────────────
-- Visitas e informe para el vendedor (2026-09-23) — registro interno +
-- enlace privado de solo lectura (/informe/<token>)
-- `property_visits`: una fila por recorrido de un prospecto a una propiedad
-- (fecha y hora, asesor, interés, motivos de objeción, comentarios). Cada
-- asesor ve y edita solo SUS visitas; un correo con el apartado 'visitas' pero
-- SIN asesor vinculado (admin_access.advisor_id null) ve las de todos — el
-- mismo patrón de "propias o todas" de agenda_citas (my_advisor_id()).
-- `prospect_name` e `internal_notes` son SOLO internos: el informe del
-- vendedor nunca los recibe, y eso lo garantiza la base de datos, no el front:
-- el informe sale de visit_report() / visit_report_by_token(), que arman el
-- JSON con una lista cerrada de campos (fecha, interés, motivos, comentario)
-- y nada más — ni el nombre del prospecto, ni el asesor, ni las notas internas.
-- `property_report_links`: el enlace secreto de cada propiedad. Quien lo tenga
-- ve el informe SIN iniciar sesión (solo ese informe: las tablas siguen
-- cerradas); regenerar el token invalida el enlace anterior y borrar la fila
-- lo desactiva. El token es un uuid sin guiones (122 bits aleatorios).
-- `_visit_report_payload` es interna: se le quita EXECUTE a anon/authenticated
-- porque, sin token ni permiso, cualquiera podría pedir el informe de
-- cualquier propiedad solo con su id.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

create table if not exists property_visits (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  advisor_id uuid references advisors(id) on delete set null,
  visited_at timestamptz not null,
  prospect_name text, -- interno: nunca sale en el informe del vendedor
  interest text not null check (interest in ('muy_interesado', 'interesado', 'oferta_realizada', 'descartado')),
  reasons text[] not null default '{}', -- ubicacion, precio, espacios, conservacion, distribucion: libre a propósito (agregar una categoría no requiere SQL)
  comments text, -- lo ve el vendedor (sin nombre del prospecto)
  internal_notes text, -- interno: nunca sale en el informe del vendedor
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_property_visits_property on property_visits(property_id, visited_at desc);
create index if not exists idx_property_visits_advisor on property_visits(advisor_id);

alter table property_visits enable row level security;

drop policy if exists "Ver visitas propias o todas con visitas" on property_visits;
create policy "Ver visitas propias o todas con visitas" on property_visits for select
  using (has_admin_section('visitas') and (my_advisor_id() is null or my_advisor_id() = advisor_id));

drop policy if exists "Crear visitas propias o todas con visitas" on property_visits;
create policy "Crear visitas propias o todas con visitas" on property_visits for insert
  with check (has_admin_section('visitas') and (my_advisor_id() is null or my_advisor_id() = advisor_id));

drop policy if exists "Editar visitas propias o todas con visitas" on property_visits;
create policy "Editar visitas propias o todas con visitas" on property_visits for update
  using (has_admin_section('visitas') and (my_advisor_id() is null or my_advisor_id() = advisor_id))
  with check (has_admin_section('visitas') and (my_advisor_id() is null or my_advisor_id() = advisor_id));

drop policy if exists "Borrar visitas propias o todas con visitas" on property_visits;
create policy "Borrar visitas propias o todas con visitas" on property_visits for delete
  using (has_admin_section('visitas') and (my_advisor_id() is null or my_advisor_id() = advisor_id));

create table if not exists property_report_links (
  property_id uuid primary key references properties(id) on delete cascade,
  token text not null unique default replace(gen_random_uuid()::text, '-', '')
    check (token ~ '^[0-9a-f]{32}$'), -- nunca un token corto/adivinable, aunque el front se equivoque
  created_by text,
  created_at timestamptz not null default now()
);

alter table property_report_links enable row level security;

drop policy if exists "Rol con apartado visitas maneja property_report_links" on property_report_links;
create policy "Rol con apartado visitas maneja property_report_links" on property_report_links for all
  using (has_admin_section('visitas')) with check (has_admin_section('visitas'));

-- El informe completo de UNA propiedad, ya anonimizado. security definer: lee
-- property_visits sin importar quién llama (por eso el JSON se arma aquí, con
-- una lista cerrada de campos, y no se le da a nadie la tabla). Las visitas
-- van de la más reciente a la más antigua. `sold_on` solo cuando la propiedad
-- está vendida, para dejar de contar los días en el mercado.
create or replace function _visit_report_payload(p_property_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'property', jsonb_build_object(
      'title', p.title,
      'code', p.code,
      'zone', p.zone,
      'status', p.status,
      'created_at', p.created_at,
      'main_image', p.main_image
    ),
    'sold_on', case when p.status = 'vendida' then (select v.fecha_venta from ventas v where v.property_id = p.id) end,
    'visits', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'visited_at', pv.visited_at,
          'interest', pv.interest,
          'reasons', to_jsonb(pv.reasons),
          'comments', nullif(btrim(pv.comments), '')
        )
        order by pv.visited_at desc
      )
      from property_visits pv
      where pv.property_id = p.id
    ), '[]'::jsonb)
  )
  from properties p
  where p.id = p_property_id;
$$;

-- Vista previa para el personal: el MISMO informe que recibe el vendedor, con
-- las visitas de todos los asesores (una visita ajena no se ve en la tabla de
-- property_visits por RLS, pero sí cuenta en el informe de la propiedad).
create or replace function visit_report(p_property_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not has_admin_section('visitas') then
    raise exception 'Sin acceso al apartado Visitas' using errcode = '42501';
  end if;
  return _visit_report_payload(p_property_id);
end;
$$;

-- Lo que consulta la página pública /informe/<token>. Token inexistente,
-- regenerado o desactivado = null (la página muestra "enlace no válido").
create or replace function visit_report_by_token(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select _visit_report_payload(l.property_id)
  from property_report_links l
  where l.token = p_token;
$$;

revoke all on function _visit_report_payload(uuid) from public, anon, authenticated;
revoke all on function visit_report(uuid) from public, anon;
grant execute on function visit_report(uuid) to authenticated;
revoke all on function visit_report_by_token(text) from public;
grant execute on function visit_report_by_token(text) to anon, authenticated;

update admin_roles
set sections = array_append(sections, 'visitas')
where slug in ('admin', 'asesores') and not ('visitas' = any(sections));

-- ─────────────────────────────────────────────
-- Visitas: "posible cliente" (2026-09-23)
-- Un prospecto que conoció ACL por una casa pero quiere que le busquemos otra
-- se marca en la propia visita: `potential_client` + su teléfono y "qué busca"
-- (tipo, zona, presupuesto). Los tres son SOLO internos, igual que
-- prospect_name/internal_notes: el informe del vendedor sale de
-- _visit_report_payload(), que arma el JSON con una lista cerrada de campos y no
-- los incluye. La RLS de property_visits ya cubre las columnas nuevas (cada
-- asesor ve las suyas; oficina ve todas).
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

alter table property_visits add column if not exists potential_client boolean not null default false;
alter table property_visits add column if not exists prospect_phone text;
alter table property_visits add column if not exists looking_for text;

-- ─────────────────────────────────────────────
-- Construcción · objetos del plano (2026-09-23) — muebles/equipos colocados
-- en el mapa (cocina, sala, recámara…). Se guardan con coordenadas absolutas
-- en metros. habitacion_id es opcional (objeto suelto / exterior).
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

create table if not exists construccion_objetos (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references construccion_proyectos(id) on delete cascade,
  habitacion_id uuid references construccion_habitaciones(id) on delete set null,
  tipo text not null,
  x numeric not null,
  z numeric not null,
  ancho numeric not null,
  largo numeric not null,
  rot_deg numeric not null default 0
);

create index if not exists idx_construccion_objetos_proyecto on construccion_objetos(proyecto_id);

alter table construccion_objetos enable row level security;

drop policy if exists "Authenticated manage construccion_objetos" on construccion_objetos;
create policy "Authenticated manage construccion_objetos" on construccion_objetos for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────
-- Secretaría (2026-09-24) — bitácora de control de llaves y bitácora de
-- entradas/salidas de documentos. Solo internas: RLS con el apartado
-- 'secretaria' (asignable desde /admin/roles).
-- ─────────────────────────────────────────────
create table if not exists secretaria_llaves (
  id uuid primary key default gen_random_uuid(),
  logged_at timestamptz not null default now(), -- fecha y hora de entrega
  address text not null,                        -- dirección / casa
  key_label text not null,                      -- ID / nombre de la llave (ej. P-01)
  receiver_name text not null,
  receiver_phone text,
  signed_delivery boolean not null default false,
  returned_at timestamptz,                      -- null = la llave sigue prestada
  signed_reception boolean not null default false,
  notes text,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists idx_secretaria_llaves_fecha on secretaria_llaves(logged_at desc);

create table if not exists secretaria_documentos (
  id uuid primary key default gen_random_uuid(),
  logged_at timestamptz not null default now(),
  doc_type text not null,                       -- escrituras, contrato, etc.
  property_client text not null,                -- propiedad / cliente
  movement text not null check (movement in ('entrada', 'salida')),
  person_name text not null,                    -- quien entrega / recoge
  person_id text,                               -- identificación / contacto
  signed boolean not null default false,        -- firma de conformidad
  secretary_name text,                          -- responsable en Secretaría
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists idx_secretaria_documentos_fecha on secretaria_documentos(logged_at desc);

alter table secretaria_llaves enable row level security;
alter table secretaria_documentos enable row level security;

drop policy if exists "Rol con apartado secretaria maneja secretaria_llaves" on secretaria_llaves;
create policy "Rol con apartado secretaria maneja secretaria_llaves" on secretaria_llaves for all
  using (has_admin_section('secretaria')) with check (has_admin_section('secretaria'));

drop policy if exists "Rol con apartado secretaria maneja secretaria_documentos" on secretaria_documentos;
create policy "Rol con apartado secretaria maneja secretaria_documentos" on secretaria_documentos for all
  using (has_admin_section('secretaria')) with check (has_admin_section('secretaria'));

update admin_roles
set sections = array_append(sections, 'secretaria')
where slug = 'admin' and not ('secretaria' = any(sections));

-- ─────────────────────────────────────────────
-- Estimación de valor · historial (2026-09-25) — cada estimación guardada
-- con una copia de los precios por m² del momento (no depende de que la zona
-- cambie después). Solo internas: RLS con el apartado 'valuacion'.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────
create table if not exists valuation_estimates (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by text,
  reference text,                 -- cliente / dirección (opcional)
  zone_name text,
  land_area numeric not null default 0,
  built_area numeric not null default 0,
  land_rate numeric not null default 0,
  built_rate numeric not null default 0,
  spread_pct numeric not null default 10,
  land_value numeric not null default 0,
  built_value numeric not null default 0,
  low numeric not null default 0,
  high numeric not null default 0,
  center numeric not null default 0,
  shapes jsonb not null default '[]'::jsonb
);
create index if not exists idx_valuation_estimates_fecha on valuation_estimates(created_at desc);

alter table valuation_estimates enable row level security;

drop policy if exists "Rol con apartado valuacion maneja valuation_estimates" on valuation_estimates;
create policy "Rol con apartado valuacion maneja valuation_estimates" on valuation_estimates for all
  using (has_admin_section('valuacion')) with check (has_admin_section('valuacion'));

-- ─────────────────────────────────────────────
-- Estimación de valor · ligada a cliente y propiedad (2026-09-25).
-- Si el cliente o la propiedad se borra, la estimación se conserva (queda
-- solo con su referencia). (bloque re-ejecutable)
-- ─────────────────────────────────────────────
alter table valuation_estimates add column if not exists client_id uuid references clients(id) on delete set null;
alter table valuation_estimates add column if not exists property_id uuid references properties(id) on delete set null;
create index if not exists idx_valuation_estimates_client on valuation_estimates(client_id);

-- ─────────────────────────────────────────────
-- Prospectos por etapas (2026-09-25) — embudo de ventas: nuevo → contactado →
-- interesado → negociación → cerrado / perdido, con asesor, último contacto y
-- próximo seguimiento. Mismo patrón de acceso que las visitas: apartado
-- 'prospectos' y cada asesor con login vinculado ve/edita solo SUS prospectos;
-- un correo sin asesor vinculado ve los de todos (my_advisor_id()).
-- visit_id (único) evita importar dos veces la misma visita.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────
create table if not exists prospectos (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  source text not null default 'manual',
  stage text not null default 'nuevo'
    check (stage in ('nuevo', 'contactado', 'interesado', 'negociacion', 'cerrado', 'perdido')),
  advisor_id uuid references advisors(id) on delete set null,
  property_id uuid references properties(id) on delete set null,
  visit_id uuid unique references property_visits(id) on delete set null,
  looking_for text,
  notes text,
  last_contact_at timestamptz,
  next_followup_at date,
  lost_reason text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_prospectos_stage on prospectos(stage);
create index if not exists idx_prospectos_advisor on prospectos(advisor_id);

alter table prospectos enable row level security;

drop policy if exists "Ver prospectos propios o todos" on prospectos;
create policy "Ver prospectos propios o todos" on prospectos for select
  using (has_admin_section('prospectos') and (my_advisor_id() is null or my_advisor_id() = advisor_id));

drop policy if exists "Crear prospectos propios o todos" on prospectos;
create policy "Crear prospectos propios o todos" on prospectos for insert
  with check (has_admin_section('prospectos') and (my_advisor_id() is null or my_advisor_id() = advisor_id));

drop policy if exists "Editar prospectos propios o todos" on prospectos;
create policy "Editar prospectos propios o todos" on prospectos for update
  using (has_admin_section('prospectos') and (my_advisor_id() is null or my_advisor_id() = advisor_id))
  with check (has_admin_section('prospectos') and (my_advisor_id() is null or my_advisor_id() = advisor_id));

drop policy if exists "Borrar prospectos propios o todos" on prospectos;
create policy "Borrar prospectos propios o todos" on prospectos for delete
  using (has_admin_section('prospectos') and (my_advisor_id() is null or my_advisor_id() = advisor_id));

update admin_roles
set sections = array_append(sections, 'prospectos')
where slug = 'admin' and not ('prospectos' = any(sections));

-- ─────────────────────────────────────────────
-- Prospectos ligados a cliente y a mensaje + canal de los mensajes (2026-09-25)
-- - prospectos.client_id: el cliente en que se convirtió el prospecto.
-- - prospectos.message_id (único): mensaje del sitio del que salió, para no
--   pasarlo a prospecto dos veces.
-- - contact_messages.channel: 'formulario' (Contacto), 'solicitud' (pedir que
--   me contacten en una propiedad) o 'whatsapp' (botón de WhatsApp de la ficha).
--   El insert público sigue igual (with check (true)); los mensajes viejos
--   quedan como 'formulario'.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────
alter table prospectos add column if not exists client_id uuid references clients(id) on delete set null;
alter table prospectos add column if not exists message_id uuid unique references contact_messages(id) on delete set null;
alter table contact_messages add column if not exists channel text not null default 'formulario';

-- ─────────────────────────────────────────────
-- contact_messages.details (2026-09-25): datos estructurados de los formularios
-- públicos nuevos (simulador de crédito y "¿cuánto vale tu casa?"). El insert
-- público sigue igual (with check (true)). Nuevos valores de channel:
-- 'simulador' y 'estimacion'.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────
alter table contact_messages add column if not exists details jsonb;

-- ─────────────────────────────────────────────
-- Registro de actividad (2026-09-25) — quién creó, editó o borró qué.
-- Lo escriben TRIGGERS de la base (no el navegador), así que no se puede
-- saltar desde la app ni borrar desde ella: audit_log solo tiene política de
-- lectura, y solo para roles con el apartado 'roles' (administradores).
-- Guarda quién (correo), cuándo, en qué tabla, qué acción, una etiqueta del
-- registro (nombre/título) y, en ediciones, el NOMBRE de las columnas que
-- cambiaron — nunca los valores: así no se copian datos sensibles (RFC, CURP,
-- contraseñas de portales) a otra tabla. actor vacío = visitante del sitio o
-- proceso automático del sistema.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

create table if not exists audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor text,
  table_name text not null,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  row_id text,
  label text,
  changed text[]
);

create index if not exists idx_audit_log_at on audit_log(at desc);
create index if not exists idx_audit_log_table on audit_log(table_name, at desc);

alter table audit_log enable row level security;

drop policy if exists "Roles con apartado roles ven el registro de actividad" on audit_log;
create policy "Roles con apartado roles ven el registro de actividad" on audit_log for select
  using (has_admin_section('roles'));

-- Sin políticas de escritura: nadie desde la app puede insertar, editar ni
-- borrar el registro (solo el trigger, que corre como dueño).
revoke insert, update, delete, truncate on audit_log from anon, authenticated;

create or replace function audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  j jsonb;
  o jsonb;
  changed_cols text[];
begin
  if tg_op = 'DELETE' then
    j := to_jsonb(old);
  else
    j := to_jsonb(new);
  end if;

  if tg_op = 'UPDATE' then
    o := to_jsonb(old);
    select array_agg(k order by k) into changed_cols
    from jsonb_object_keys(j) k
    where k <> 'updated_at' and (j -> k) is distinct from (o -> k);
    -- Si lo único que cambió fue updated_at, no vale la pena registrarlo.
    if changed_cols is null then
      return new;
    end if;
  end if;

  insert into audit_log (actor, table_name, action, row_id, label, changed)
  values (
    auth.email(),
    tg_table_name,
    tg_op,
    coalesce(j ->> 'id', j ->> 'property_id'),
    left(coalesce(j ->> 'name', j ->> 'title', j ->> 'reference', j ->> 'key_label', j ->> 'address', j ->> 'email', j ->> 'doc_type', j ->> 'slug', j ->> 'id'), 120),
    changed_cols
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- El trigger no necesita que nadie pueda llamarla a mano.
revoke execute on function audit_row_change() from public, anon, authenticated;

-- Se instala en las tablas de negocio que existan (si alguna aún no existe en
-- tu base, se omite sin error).
do $$
declare
  t text;
begin
  foreach t in array array[
    'properties', 'property_advisors', 'property_types', 'zones', 'advisors', 'amenities_catalog',
    'clients', 'client_documents', 'client_links', 'perfilamientos', 'perfilamientos_comprador',
    'prospectos', 'contact_messages', 'testimonials', 'valuation_estimates', 'property_visits',
    'property_report_links', 'liquidaciones', 'ventas', 'property_budgets', 'property_log',
    'remodel_projects', 'agenda_citas', 'agenda_expedientes', 'secretaria_llaves', 'secretaria_documentos',
    'construccion_proyectos', 'materials_catalog', 'labor_catalog', 'admin_roles', 'admin_access'
  ]
  loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists trg_audit_row_change on %I', t);
      execute format('create trigger trg_audit_row_change after insert or update or delete on %I for each row execute function audit_row_change()', t);
    end if;
  end loop;
end;
$$;

-- ─────────────────────────────────────────────
-- Firma de contratos desde el sitio (2026-09-25). El personal sube un PDF (o lo
-- genera con el generador de documentos), se crea una solicitud con un enlace
-- privado /firmar/<token> y un código de 6 dígitos que el personal le da al
-- cliente por teléfono o WhatsApp. El cliente abre el enlace SIN iniciar
-- sesión, pone el código, lee el PDF y firma en pantalla.
--
-- Cómo se protege:
-- · La tabla está cerrada a todos menos al personal con el apartado
--   'documentos_legales'. El público solo llega por 3 funciones que exigen el
--   token (64 hex, 256 bits) y, para abrir o firmar, el código.
-- · El código se guarda con hash (nunca en claro) y se bloquea a los 5 intentos
--   fallidos; el personal puede regenerarlo.
-- · La solicitud caduca (7 días por omisión) y solo se puede firmar una vez.
-- · Al firmar se guardan fecha y hora del servidor, IP y navegador, y el hash
--   SHA-256 del PDF original se calcula en la base al crearlo.
-- · El personal no puede alterar la firma ni la evidencia: solo puede cambiar
--   estado, vigencia y la huella (columnas con permiso de UPDATE).
-- La huella (imagen capturada con el lector en la oficina) la agrega el personal.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

create table if not exists signing_requests (
  id uuid primary key default gen_random_uuid(),
  token text not null unique
    default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
    check (token ~ '^[0-9a-f]{64}$'),
  client_id uuid references clients(id) on delete set null,
  property_id uuid references properties(id) on delete set null,
  title text not null,
  signer_name text not null,
  document_b64 text not null,
  doc_sha256 text not null,
  code_hash text not null,
  failed_attempts int not null default 0,
  status text not null default 'pendiente' check (status in ('pendiente', 'firmado', 'cancelado')),
  expires_at timestamptz not null default now() + interval '7 days',
  created_by text,
  created_at timestamptz not null default now(),
  signed_at timestamptz,
  signed_name text,
  signature_b64 text,
  signer_ip text,
  signer_agent text,
  fingerprint_b64 text,
  fingerprint_by text,
  fingerprint_at timestamptz,
  sealed_at timestamptz,
  constraint signing_signed_has_evidence check (status <> 'firmado' or (signature_b64 is not null and signed_at is not null))
);

create index if not exists idx_signing_requests_client on signing_requests(client_id);
create index if not exists idx_signing_requests_created on signing_requests(created_at desc);

alter table signing_requests enable row level security;

drop policy if exists "Personal con documentos_legales ve solicitudes de firma" on signing_requests;
create policy "Personal con documentos_legales ve solicitudes de firma" on signing_requests for select
  using (has_admin_section('documentos_legales'));

drop policy if exists "Personal con documentos_legales edita solicitudes de firma" on signing_requests;
create policy "Personal con documentos_legales edita solicitudes de firma" on signing_requests for update
  using (has_admin_section('documentos_legales')) with check (has_admin_section('documentos_legales'));

drop policy if exists "Personal con documentos_legales borra solicitudes de firma" on signing_requests;
create policy "Personal con documentos_legales borra solicitudes de firma" on signing_requests for delete
  using (has_admin_section('documentos_legales'));

-- Sin política de insert: las solicitudes se crean solo con signing_create().
-- Y el personal solo puede actualizar estas columnas (no la firma ni la evidencia).
revoke update on signing_requests from anon, authenticated;
grant update (status, expires_at, fingerprint_b64, fingerprint_by, fingerprint_at, sealed_at) on signing_requests to authenticated;
revoke insert, truncate on signing_requests from anon, authenticated;

-- Hash del código: sha256(token:código). El token hace de "sal".
create or replace function _signing_code_hash(p_token text, p_code text)
returns text
language sql
immutable
as $$
  select encode(sha256(convert_to(p_token || ':' || coalesce(p_code, ''), 'utf8')), 'hex');
$$;

-- Código de 6 dígitos con aleatoriedad de uuid v4 (criptográfica).
create or replace function _signing_new_code()
returns text
language sql
volatile
as $$
  select lpad((('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))::bit(32)::bigint % 1000000)::text, 6, '0');
$$;

-- ── Personal: crear solicitud (devuelve el enlace y el código UNA vez) ──
create or replace function signing_create(
  p_client_id uuid,
  p_property_id uuid,
  p_title text,
  p_signer_name text,
  p_document_b64 text,
  p_expires_days int default 7
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  bytes bytea;
  new_code text := _signing_new_code();
  r signing_requests;
begin
  if not has_admin_section('documentos_legales') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if coalesce(trim(p_title), '') = '' or coalesce(trim(p_signer_name), '') = '' then
    raise exception 'title_and_signer_required';
  end if;
  if length(coalesce(p_document_b64, '')) > 14000000 then
    raise exception 'document_too_large';
  end if;
  bytes := decode(p_document_b64, 'base64');
  if substring(bytes from 1 for 4) <> '\x25504446'::bytea then
    raise exception 'not_a_pdf';
  end if;

  insert into signing_requests (client_id, property_id, title, signer_name, document_b64, doc_sha256, code_hash, expires_at, created_by)
  values (p_client_id, p_property_id, trim(p_title), trim(p_signer_name), p_document_b64,
          encode(sha256(bytes), 'hex'), 'pending', now() + make_interval(days => greatest(1, least(coalesce(p_expires_days, 7), 60))), auth.email())
  returning * into r;

  update signing_requests set code_hash = _signing_code_hash(r.token, new_code) where id = r.id;
  return jsonb_build_object('id', r.id, 'token', r.token, 'code', new_code, 'expires_at', r.expires_at);
end;
$$;

-- ── Personal: código nuevo (por si se perdió o se bloqueó) ──
create or replace function signing_regenerate_code(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  new_code text := _signing_new_code();
  r signing_requests;
begin
  if not has_admin_section('documentos_legales') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into r from signing_requests where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  if r.status <> 'pendiente' then raise exception 'not_pending'; end if;
  update signing_requests
  set code_hash = _signing_code_hash(r.token, new_code), failed_attempts = 0,
      expires_at = greatest(expires_at, now() + interval '1 day')
  where id = p_id;
  return jsonb_build_object('code', new_code);
end;
$$;

-- ── Público (con token): estado de la solicitud, sin revelar nada más ──
create or replace function signing_info(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'title', title,
    'status', case
      when status = 'pendiente' and now() > expires_at then 'expirado'
      when status = 'pendiente' and failed_attempts >= 5 then 'bloqueado'
      else status end)
  from signing_requests where token = p_token;
$$;

-- Comprueba token + código y cuenta los intentos fallidos. Devuelve NULL si todo
-- está bien, o el error como texto. (Los errores se devuelven, no se lanzan: un
-- error revertiría el conteo de intentos fallidos.)
create or replace function _signing_check(p_token text, p_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  r signing_requests;
begin
  select * into r from signing_requests where token = p_token for update;
  if not found then return 'not_found'; end if;
  if r.status <> 'pendiente' then return 'not_pending'; end if;
  if now() > r.expires_at then return 'expired'; end if;
  if r.failed_attempts >= 5 then return 'locked'; end if;
  if r.code_hash <> _signing_code_hash(p_token, p_code) then
    update signing_requests set failed_attempts = failed_attempts + 1 where id = r.id;
    return 'invalid_code';
  end if;
  return null;
end;
$$;

create or replace function signing_open(p_token text, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  err text := _signing_check(p_token, p_code);
  r signing_requests;
begin
  if err is not null then
    return jsonb_build_object('error', err);
  end if;
  select * into r from signing_requests where token = p_token;
  return jsonb_build_object('title', r.title, 'signer_name', r.signer_name, 'document_b64', r.document_b64, 'doc_sha256', r.doc_sha256);
end;
$$;

create or replace function signing_submit(p_token text, p_code text, p_signed_name text, p_signature_b64 text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  err text := _signing_check(p_token, p_code);
  headers json;
  ip text;
  agent text;
  r signing_requests;
begin
  if err is not null then
    return jsonb_build_object('error', err);
  end if;
  if coalesce(trim(p_signed_name), '') = '' or length(p_signed_name) > 200 then
    return jsonb_build_object('error', 'name_required');
  end if;
  -- Solo un PNG razonable: evita meter basura o archivos enormes.
  if p_signature_b64 is null or length(p_signature_b64) > 600000 or left(p_signature_b64, 5) <> 'iVBOR' then
    return jsonb_build_object('error', 'bad_signature');
  end if;

  headers := nullif(current_setting('request.headers', true), '')::json;
  ip := nullif(trim(split_part(coalesce(headers ->> 'x-forwarded-for', headers ->> 'cf-connecting-ip', ''), ',', 1)), '');
  agent := left(coalesce(headers ->> 'user-agent', ''), 300);

  update signing_requests
  set status = 'firmado', signed_at = now(), signed_name = trim(p_signed_name), signature_b64 = p_signature_b64,
      signer_ip = ip, signer_agent = nullif(agent, '')
  where token = p_token
  returning * into r;
  return jsonb_build_object('signed_at', r.signed_at, 'ip', r.signer_ip);
end;
$$;

-- Permisos de ejecución: las de personal solo para 'authenticated' (y ellas mismas
-- revisan el apartado); las públicas para todos, pero exigen el token.
revoke execute on function signing_create(uuid, uuid, text, text, text, int) from public, anon;
revoke execute on function signing_regenerate_code(uuid) from public, anon;
revoke execute on function _signing_check(text, text) from public, anon, authenticated;
revoke execute on function signing_info(text) from public;
revoke execute on function signing_open(text, text) from public;
revoke execute on function signing_submit(text, text, text, text) from public;
grant execute on function signing_create(uuid, uuid, text, text, text, int) to authenticated;
grant execute on function signing_regenerate_code(uuid) to authenticated;
grant execute on function signing_info(text) to anon, authenticated;
grant execute on function signing_open(text, text) to anon, authenticated;
grant execute on function signing_submit(text, text, text, text) to anon, authenticated;

-- Quedan en el registro de actividad (solo nombres de columna, nunca la firma).
do $$
begin
  if to_regclass('public.signing_requests') is not null and to_regprocedure('public.audit_row_change()') is not null then
    drop trigger if exists trg_audit_row_change on signing_requests;
    create trigger trg_audit_row_change after insert or update or delete on signing_requests
      for each row execute function audit_row_change();
  end if;
end;
$$;

-- ─────────────────────────────────────────────
-- Historial de etapas de los prospectos (2026-09-25) — alimenta las
-- estadísticas del embudo (/admin/estadisticas): cuántos llegan a cada etapa,
-- cuánto tardan en cerrar y por qué se pierden. Lo escribe un trigger cada
-- vez que se crea un prospecto o cambia su etapa; nadie lo edita desde la app.
-- Cada asesor ve solo el historial de SUS prospectos (la política pregunta a
-- prospectos, que ya aplica su propio RLS).
-- Los prospectos que ya existían quedan con una fila inicial: su etapa actual
-- (con la fecha de creación si es "nuevo", o la última edición si no).
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

create table if not exists prospecto_etapas (
  id bigint generated always as identity primary key,
  prospecto_id uuid not null references prospectos(id) on delete cascade,
  stage text not null,
  at timestamptz not null default now(),
  actor text
);

create index if not exists idx_prospecto_etapas_prospecto on prospecto_etapas(prospecto_id, at);

alter table prospecto_etapas enable row level security;

drop policy if exists "Ver historial de etapas de mis prospectos" on prospecto_etapas;
create policy "Ver historial de etapas de mis prospectos" on prospecto_etapas for select
  using (exists (select 1 from prospectos p where p.id = prospecto_etapas.prospecto_id));

revoke insert, update, delete, truncate on prospecto_etapas from anon, authenticated;

create or replace function log_prospect_stage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into prospecto_etapas (prospecto_id, stage, at, actor)
    values (new.id, new.stage, new.created_at, auth.email());
  elsif new.stage is distinct from old.stage then
    insert into prospecto_etapas (prospecto_id, stage, actor)
    values (new.id, new.stage, auth.email());
  end if;
  return new;
end;
$$;

revoke execute on function log_prospect_stage() from public, anon, authenticated;

drop trigger if exists trg_log_prospect_stage on prospectos;
create trigger trg_log_prospect_stage
after insert or update of stage on prospectos
for each row execute function log_prospect_stage();

insert into prospecto_etapas (prospecto_id, stage, at)
select p.id, p.stage, case when p.stage = 'nuevo' then p.created_at else p.updated_at end
from prospectos p
where not exists (select 1 from prospecto_etapas e where e.prospecto_id = p.id);

-- ─────────────────────────────────────────────
-- Aviso diario de seguimientos por WhatsApp (2026-09-25): cada mañana (7:05 am
-- hora de México) cada asesor con seguimientos de prospectos vencidos o para hoy
-- recibe UN resumen por WhatsApp. Lo manda la Edge Function
-- supabase/functions/seguimientos-resumen-diario, disparada por pg_cron, con las
-- mismas credenciales (Vault) y los mismos secretos que los avisos de Agenda.
-- Requiere crear y aprobar en Meta Business Manager la plantilla de WhatsApp
-- "resumen_seguimientos_dia" (idioma es_MX, categoría Utilidad), con 3 variables
-- con nombre: nombre_asesor, num_seguimientos y lista_seguimientos. Texto sugerido:
--   Hola {{nombre_asesor}}, hoy tienes {{num_seguimientos}} seguimientos de
--   prospectos pendientes: {{lista_seguimientos}}. Revísalos en el panel de ACL Propiedades.
-- seguimientos_resumenes_enviados evita mandar dos veces el mismo día al mismo asesor.
-- (bloque re-ejecutable: cron.schedule con un nombre que ya existe actualiza ese job)
-- ─────────────────────────────────────────────

create table if not exists seguimientos_resumenes_enviados (
  advisor_id uuid not null references advisors(id) on delete cascade,
  fecha date not null,
  created_at timestamptz not null default now(),
  primary key (advisor_id, fecha)
);

alter table seguimientos_resumenes_enviados enable row level security;

drop policy if exists "Rol con apartado prospectos lee resumenes de seguimientos enviados" on seguimientos_resumenes_enviados;
create policy "Rol con apartado prospectos lee resumenes de seguimientos enviados" on seguimientos_resumenes_enviados for select
  using (has_admin_section('prospectos'));

select cron.schedule(
  'seguimientos-resumen-diario',
  '5 13 * * *', -- 7:05am hora de México (UTC-6 fijo, sin horario de verano)
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/seguimientos-resumen-diario',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key'),
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'agenda_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
