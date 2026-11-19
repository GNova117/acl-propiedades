-- ─────────────────────────────────────────────
-- Novedades del sitio (2026-10-08): bitácora interna donde queda cada
-- cambio o mejora que se hace al sitio como una entrada aparte, para que
-- quien tenga el apartado 'novedades' pueda darle seguimiento — es como el
-- blog público, pero 100% interno: nunca se expone fuera del panel. Solo
-- se le da el apartado al rol 'admin' por default; si se quiere mostrar a
-- otros roles, se asigna desde /admin/roles igual que cualquier otro
-- apartado.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

create table if not exists site_updates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_site_updates_created_at on site_updates(created_at desc);

alter table site_updates enable row level security;

drop policy if exists "Rol con apartado novedades administra site_updates" on site_updates;
create policy "Rol con apartado novedades administra site_updates" on site_updates for all
  using (has_admin_section('novedades')) with check (has_admin_section('novedades'));

update admin_roles
set sections = array_append(sections, 'novedades')
where slug = 'admin' and not ('novedades' = any(sections));

