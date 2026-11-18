-- ─────────────────────────────────────────────
-- Estimación de valor · mercado en internet (2026-10-02) — cada consulta de
-- precios que hace api/market-comps.js (Claude con búsqueda web) se guarda como
-- una "foto" del mercado de la zona: los anuncios encontrados (comps), el
-- resumen y lo que costó. Sirve de historial y de caché de 24 h (no se paga dos
-- veces por la misma zona). Solo internas: RLS con el apartado 'valuacion'.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────
create table if not exists market_snapshots (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by text,
  zone_name text not null,
  municipality text not null default '',
  property_type text not null default 'casa' check (property_type in ('casa', 'departamento', 'terreno')),
  basis text not null default 'built' check (basis in ('built', 'land')),
  comps jsonb not null default '[]'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  notes text,
  usage jsonb not null default '{}'::jsonb
);
create index if not exists idx_market_snapshots_zona on market_snapshots(lower(zone_name), created_at desc);

alter table market_snapshots enable row level security;

drop policy if exists "Rol con apartado valuacion maneja market_snapshots" on market_snapshots;
create policy "Rol con apartado valuacion maneja market_snapshots" on market_snapshots for all
  using (has_admin_section('valuacion')) with check (has_admin_section('valuacion'));

