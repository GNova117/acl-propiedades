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

