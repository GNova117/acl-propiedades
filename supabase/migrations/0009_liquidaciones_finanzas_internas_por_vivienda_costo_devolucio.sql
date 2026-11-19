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

