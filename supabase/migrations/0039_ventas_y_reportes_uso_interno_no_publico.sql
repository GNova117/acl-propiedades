-- ─────────────────────────────────────────────
-- Ventas y reportes (2026-09-18) — uso interno, NO público
-- `ventas` registra quién vendió cada propiedad y en qué fecha (una por
-- propiedad). Vive en su propia tabla y NO como columnas de `properties` a
-- propósito: `properties` es legible por cualquiera con la anon key (el sitio
-- público la consulta directo), y quién vendió/cuándo es dato interno del
-- negocio. Se protege igual que Clientes/Liquidaciones: RLS con
-- has_admin_section('reportes'), no solo ocultando el menú.
-- Las ganancias NO se guardan aquí: se calculan al vuelo con las
-- liquidaciones existentes (mismo cálculo que la pantalla de Utilidad).
-- La casa que ya estaba marcada "vendida" antes de esto no trae registro:
-- aparece en "Pendientes de registrar" dentro de /admin/reportes.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

create table if not exists ventas (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  advisor_id uuid references advisors(id) on delete set null,
  fecha_venta date not null,
  usuario_registro text,
  created_at timestamptz not null default now(),
  unique (property_id) -- una venta por propiedad
);

create index if not exists idx_ventas_advisor on ventas(advisor_id);
create index if not exists idx_ventas_fecha on ventas(fecha_venta);

alter table ventas enable row level security;

drop policy if exists "Rol con apartado reportes maneja ventas" on ventas;
create policy "Rol con apartado reportes maneja ventas" on ventas for all
  using (has_admin_section('reportes'))
  with check (has_admin_section('reportes'));

update admin_roles
set sections = array_append(sections, 'reportes')
where slug = 'admin' and not ('reportes' = any(sections));

