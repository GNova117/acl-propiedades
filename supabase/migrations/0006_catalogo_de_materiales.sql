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

