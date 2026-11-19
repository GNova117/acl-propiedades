-- ─────────────────────────────────────────────
-- Desarrollos / torres (2026-10-29): un edificio con muchos departamentos que
-- se vende como un solo proyecto (/desarrollos/:slug). Las fotos viven en la
-- torre y en cada modelo (tipología), no en cada departamento; un depto solo
-- trae número, piso, modelo, precio, estatus y vista. Por eso `models` y
-- `units` son jsonb dentro de la fila (se editan juntos, desde un solo
-- formulario, y una torre rara vez pasa de unos cientos de deptos) en vez de
-- tablas aparte. Las fotos suben al bucket público property-images, bajo el
-- prefijo desarrollos/. Hereda el apartado `propiedades` — no hace falta
-- tocar roles. La lectura pública es solo de desarrollos publicados.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

create table if not exists developments (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  tagline text,
  description text,
  zone text not null,
  address text,
  lat double precision,
  lng double precision,
  stage text not null default 'preventa' check (stage in ('preventa', 'construccion', 'entrega_inmediata')),
  delivery_date text,
  developer_name text not null,
  developer_logo text,
  hero_image text,
  images text[] not null default '{}',
  amenities text[] not null default '{}',
  models jsonb not null default '[]'::jsonb,
  units jsonb not null default '[]'::jsonb,
  disclaimer text,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_developments_published on developments(published, created_at desc);

alter table developments enable row level security;

drop policy if exists "Public lee desarrollos publicados" on developments;
create policy "Public lee desarrollos publicados" on developments for select using (published = true);

drop policy if exists "Rol con apartado propiedades lee todos los desarrollos" on developments;
create policy "Rol con apartado propiedades lee todos los desarrollos" on developments for select
  using (has_admin_section('propiedades'));

drop policy if exists "Rol con apartado propiedades administra desarrollos" on developments;
create policy "Rol con apartado propiedades administra desarrollos" on developments for all
  using (has_admin_section('propiedades')) with check (has_admin_section('propiedades'));

