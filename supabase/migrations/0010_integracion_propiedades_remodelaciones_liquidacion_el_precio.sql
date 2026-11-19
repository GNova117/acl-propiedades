-- ─────────────────────────────────────────────
-- Integración Propiedades → Remodelaciones → Liquidación: el precio de la
-- propiedad y el total de materiales del proyecto de remodelación vinculado
-- dejan de capturarse a mano en Liquidación; se leen en vivo desde su
-- módulo de origen. Esta sección liga cada propiedad a un único proyecto de
-- remodelación (creado automáticamente al dar de alta la casa) y retira las
-- dos columnas de liquidaciones que ahora son siempre derivadas, nunca
-- capturadas ni guardadas.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

alter table remodel_projects add column if not exists property_id uuid references properties(id) on delete cascade;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'remodel_projects'::regclass and conname = 'remodel_projects_property_id_key'
  ) then
    alter table remodel_projects add constraint remodel_projects_property_id_key unique (property_id);
  end if;
end $$;

create index if not exists idx_remodel_projects_property on remodel_projects(property_id);

-- Backfill: liga cada propiedad que todavía no tenga proyecto de
-- remodelación (todas las creadas antes de esta integración) con uno nuevo.
-- Idempotente: no vuelve a insertar para propiedades que ya quedaron ligadas.
insert into remodel_projects (name, property_id, area_m2)
select p.title, p.id, p.area_m2
from properties p
where not exists (select 1 from remodel_projects r where r.property_id = p.id);

-- costo_total e inversion_remodelacion ya no se capturan ni se guardan: se
-- calculan en vivo desde properties.price y desde el proyecto de
-- remodelación vinculado (ver src/lib/liquidacion.js).
alter table liquidaciones drop column if exists costo_total;
alter table liquidaciones drop column if exists inversion_remodelacion;

