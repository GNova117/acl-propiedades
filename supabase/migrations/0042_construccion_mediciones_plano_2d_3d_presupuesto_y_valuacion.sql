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

