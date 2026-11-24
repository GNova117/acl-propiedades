-- ─────────────────────────────────────────────
-- Prospectos por etapas (2026-09-25) — embudo de ventas: nuevo → contactado →
-- interesado → negociación → cerrado / perdido, con asesor, último contacto y
-- próximo seguimiento. Mismo patrón de acceso que las visitas: apartado
-- 'prospectos' y cada asesor con login vinculado ve/edita solo SUS prospectos;
-- un correo sin asesor vinculado ve los de todos (my_advisor_id()).
-- visit_id (único) evita importar dos veces la misma visita.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────
create table if not exists prospectos (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  source text not null default 'manual',
  stage text not null default 'nuevo'
    check (stage in ('nuevo', 'contactado', 'interesado', 'negociacion', 'cerrado', 'perdido')),
  advisor_id uuid references advisors(id) on delete set null,
  property_id uuid references properties(id) on delete set null,
  visit_id uuid unique references property_visits(id) on delete set null,
  looking_for text,
  notes text,
  last_contact_at timestamptz,
  next_followup_at date,
  lost_reason text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_prospectos_stage on prospectos(stage);
create index if not exists idx_prospectos_advisor on prospectos(advisor_id);

alter table prospectos enable row level security;

drop policy if exists "Ver prospectos propios o todos" on prospectos;
create policy "Ver prospectos propios o todos" on prospectos for select
  using (has_admin_section('prospectos') and (my_advisor_id() is null or my_advisor_id() = advisor_id));

drop policy if exists "Crear prospectos propios o todos" on prospectos;
create policy "Crear prospectos propios o todos" on prospectos for insert
  with check (has_admin_section('prospectos') and (my_advisor_id() is null or my_advisor_id() = advisor_id));

drop policy if exists "Editar prospectos propios o todos" on prospectos;
create policy "Editar prospectos propios o todos" on prospectos for update
  using (has_admin_section('prospectos') and (my_advisor_id() is null or my_advisor_id() = advisor_id))
  with check (has_admin_section('prospectos') and (my_advisor_id() is null or my_advisor_id() = advisor_id));

drop policy if exists "Borrar prospectos propios o todos" on prospectos;
create policy "Borrar prospectos propios o todos" on prospectos for delete
  using (has_admin_section('prospectos') and (my_advisor_id() is null or my_advisor_id() = advisor_id));

update admin_roles
set sections = array_append(sections, 'prospectos')
where slug = 'admin' and not ('prospectos' = any(sections));

