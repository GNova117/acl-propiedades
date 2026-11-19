-- ─────────────────────────────────────────────
-- Desglose de gastos por municipio y perfil (2026-09-30, apartado 'gastos')
-- Una fila por rubro: municipio + perfil (comprador/vendedor) + nombre + forma de
-- cobro (porcentaje sobre el precio o sobre el crédito, o monto fijo). Las cifras
-- las captura el equipo desde /admin/gastos: cambian por plaza y con el tiempo.
-- No guarda ni calcula el margen de utilidad de la oficina.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

create table if not exists expense_concepts (
  id uuid primary key default gen_random_uuid(),
  municipality text not null,
  profile text not null check (profile in ('comprador', 'vendedor')),
  name text not null,
  kind text not null check (kind in ('percent', 'fixed')),
  base text not null default 'price' check (base in ('price', 'credit')),
  value numeric not null default 0 check (value >= 0 and (kind <> 'percent' or value <= 100)),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_expense_concepts_lookup on expense_concepts(municipality, profile);

alter table expense_concepts enable row level security;

drop policy if exists "Rol con apartado gastos maneja expense_concepts" on expense_concepts;
create policy "Rol con apartado gastos maneja expense_concepts" on expense_concepts for all
  using (has_admin_section('gastos')) with check (has_admin_section('gastos'));

update admin_roles
set sections = array_append(sections, 'gastos')
where slug in ('admin', 'asesores') and not ('gastos' = any(sections));

