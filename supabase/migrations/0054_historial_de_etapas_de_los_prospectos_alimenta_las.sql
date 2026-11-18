-- ─────────────────────────────────────────────
-- Historial de etapas de los prospectos (2026-09-25) — alimenta las
-- estadísticas del embudo (/admin/estadisticas): cuántos llegan a cada etapa,
-- cuánto tardan en cerrar y por qué se pierden. Lo escribe un trigger cada
-- vez que se crea un prospecto o cambia su etapa; nadie lo edita desde la app.
-- Cada asesor ve solo el historial de SUS prospectos (la política pregunta a
-- prospectos, que ya aplica su propio RLS).
-- Los prospectos que ya existían quedan con una fila inicial: su etapa actual
-- (con la fecha de creación si es "nuevo", o la última edición si no).
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

create table if not exists prospecto_etapas (
  id bigint generated always as identity primary key,
  prospecto_id uuid not null references prospectos(id) on delete cascade,
  stage text not null,
  at timestamptz not null default now(),
  actor text
);

create index if not exists idx_prospecto_etapas_prospecto on prospecto_etapas(prospecto_id, at);

alter table prospecto_etapas enable row level security;

drop policy if exists "Ver historial de etapas de mis prospectos" on prospecto_etapas;
create policy "Ver historial de etapas de mis prospectos" on prospecto_etapas for select
  using (exists (select 1 from prospectos p where p.id = prospecto_etapas.prospecto_id));

revoke insert, update, delete, truncate on prospecto_etapas from anon, authenticated;

create or replace function log_prospect_stage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into prospecto_etapas (prospecto_id, stage, at, actor)
    values (new.id, new.stage, new.created_at, auth.email());
  elsif new.stage is distinct from old.stage then
    insert into prospecto_etapas (prospecto_id, stage, actor)
    values (new.id, new.stage, auth.email());
  end if;
  return new;
end;
$$;

revoke execute on function log_prospect_stage() from public, anon, authenticated;

drop trigger if exists trg_log_prospect_stage on prospectos;
create trigger trg_log_prospect_stage
after insert or update of stage on prospectos
for each row execute function log_prospect_stage();

insert into prospecto_etapas (prospecto_id, stage, at)
select p.id, p.stage, case when p.stage = 'nuevo' then p.created_at else p.updated_at end
from prospectos p
where not exists (select 1 from prospecto_etapas e where e.prospecto_id = p.id);

