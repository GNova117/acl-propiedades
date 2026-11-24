-- ─────────────────────────────────────────────
-- Textos de anuncio con IA (2026-10)
-- ─────────────────────────────────────────────
-- Cada vez que un asesor pide textos de anuncio a Claude (api/ad-copy.js) queda
-- una fila aquí; sirve solo para los topes diarios (por persona y del equipo) y
-- no guarda el texto generado. Lo ven y escriben quienes tienen el apartado
-- 'propiedades' o 'naves_industriales'. Re-ejecutable. Sin correrlo, la función
-- contesta "falta la tabla" en vez de gastar una consulta que no podría contar.
create table if not exists ad_copy_usage (
  id uuid primary key default gen_random_uuid(),
  created_by text,
  property_id uuid references properties(id) on delete set null,
  channel text,
  created_at timestamptz not null default now()
);
create index if not exists idx_ad_copy_usage_created on ad_copy_usage(created_at desc);

alter table ad_copy_usage enable row level security;

drop policy if exists "Rol con propiedades usa ad_copy_usage" on ad_copy_usage;
create policy "Rol con propiedades usa ad_copy_usage" on ad_copy_usage for all
  using (has_admin_section('propiedades') or has_admin_section('naves_industriales'))
  with check (has_admin_section('propiedades') or has_admin_section('naves_industriales'));

