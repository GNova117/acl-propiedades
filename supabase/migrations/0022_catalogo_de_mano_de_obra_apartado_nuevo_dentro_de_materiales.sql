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

