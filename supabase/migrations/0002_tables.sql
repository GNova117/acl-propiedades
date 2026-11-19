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

