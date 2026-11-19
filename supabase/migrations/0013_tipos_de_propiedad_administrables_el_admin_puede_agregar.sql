-- ─────────────────────────────────────────────
-- Tipos de propiedad administrables (como zonas): el admin puede agregar
-- nuevos tipos desde /admin/zonas ("Tipos de propiedad") sin tocar código.
-- `properties.type` deja de estar limitado a un enum fijo — pasa a ser
-- texto libre, igual que `properties.zone` ya lo era respecto a `zones`.
--
-- También se corrige la operación: ya no es "venta" (agencia vende) vs.
-- "compra" (solicitud de comprador) — ahora es "compra" (disponible para
-- comprar) vs. "renta" (disponible para rentar). Solo aplica en el
-- apartado general "/propiedades"; Naves Industriales y Terrenos no
-- muestran este filtro por ahora.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

create table if not exists property_types (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  label text not null,
  created_at timestamptz not null default now()
);

alter table property_types enable row level security;

drop policy if exists "Public can read property_types" on property_types;
create policy "Public can read property_types" on property_types for select using (true);

drop policy if exists "Authenticated manage property_types" on property_types;
create policy "Authenticated manage property_types" on property_types for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

insert into property_types (key, label) values
  ('casa', 'Casa'),
  ('departamento', 'Departamento'),
  ('nave_industrial', 'Nave Industrial'),
  ('terreno', 'Terreno')
on conflict (key) do nothing;

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

update properties set operation_type = 'compra' where operation_type = 'venta';

alter table properties drop constraint if exists properties_operation_type_check;
alter table properties add constraint properties_operation_type_check
  check (operation_type in ('compra', 'renta'));

alter table properties alter column operation_type set default 'compra';

