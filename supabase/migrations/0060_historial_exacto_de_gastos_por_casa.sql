-- ─────────────────────────────────────────────
-- Historial exacto de gastos por casa (2026-09-30)
-- Cada vez que el equipo guarda el desglose de una casa desde /admin/gastos, se
-- congela una copia: los rubros con el nombre, tipo, tarifa y MONTO exactos que
-- tenían en ese momento. Si después se actualiza la tarifa de un rubro en
-- expense_concepts (por ejemplo, sube el % de escrituración), los registros ya
-- guardados no cambian — es justo el punto: lo que se le mostró a esa casa en
-- su momento queda fijo, aunque el catálogo general se siga actualizando.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

create table if not exists expense_reports (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references properties(id) on delete set null,
  house_name text not null, -- copia del nombre al guardar: sigue legible aunque la propiedad cambie de título o se borre
  municipality text not null,
  profile text not null check (profile in ('comprador', 'vendedor')),
  price numeric,
  credit numeric,
  total numeric not null default 0,
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists idx_expense_reports_property on expense_reports(property_id);
create index if not exists idx_expense_reports_house on expense_reports(house_name);

alter table expense_reports enable row level security;

drop policy if exists "Rol con apartado gastos maneja expense_reports" on expense_reports;
create policy "Rol con apartado gastos maneja expense_reports" on expense_reports for all
  using (has_admin_section('gastos')) with check (has_admin_section('gastos'));

create table if not exists expense_report_items (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references expense_reports(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('percent', 'fixed')),
  base text not null default 'price' check (base in ('price', 'credit')),
  rate_value numeric not null default 0,
  amount numeric not null default 0,
  sort_order integer not null default 0
);

create index if not exists idx_expense_report_items_report on expense_report_items(report_id);

alter table expense_report_items enable row level security;

drop policy if exists "Rol con apartado gastos maneja expense_report_items" on expense_report_items;
create policy "Rol con apartado gastos maneja expense_report_items" on expense_report_items for all
  using (has_admin_section('gastos')) with check (has_admin_section('gastos'));

