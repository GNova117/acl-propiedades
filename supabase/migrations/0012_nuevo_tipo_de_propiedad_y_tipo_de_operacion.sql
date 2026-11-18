-- ─────────────────────────────────────────────
-- Nuevo tipo de propiedad (terreno) y tipo de operación (venta/compra).
-- Casas y departamentos siguen en el listado general "/propiedades";
-- naves industriales y terrenos pasan a tener su propio apartado en el
-- sitio público (ver src/lib/format.js propertyListPath). El tipo de
-- operación es un filtro nuevo: "venta" (lo normal) vs "compra" (solicitud
-- de un comprador).
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

do $$
declare
  con record;
begin
  for con in
    select conname from pg_constraint
    where conrelid = 'properties'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%type%'
      and pg_get_constraintdef(oid) ilike '%casa%'
  loop
    execute format('alter table properties drop constraint %I', con.conname);
  end loop;
end $$;

alter table properties add constraint properties_type_check
  check (type in ('casa', 'departamento', 'nave_industrial', 'terreno'));

alter table properties add column if not exists operation_type text not null default 'venta';

alter table properties drop constraint if exists properties_operation_type_check;
alter table properties add constraint properties_operation_type_check
  check (operation_type in ('venta', 'compra'));

