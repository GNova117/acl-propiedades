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

drop policy if exists "Authenticated can delete client documents" on storage.objects;
create policy "Rol con apartado clientes borra documentos" on storage.objects
  for delete using (bucket_id = 'client-documents' and has_admin_section('clientes'));
