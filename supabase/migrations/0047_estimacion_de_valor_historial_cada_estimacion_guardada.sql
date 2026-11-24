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

