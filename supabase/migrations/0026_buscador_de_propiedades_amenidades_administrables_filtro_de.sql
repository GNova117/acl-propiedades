-- ─────────────────────────────────────────────
-- Buscador de propiedades: amenidades administrables, filtro de
-- recámaras/baños/estacionamiento (las columnas ya existían, solo faltaba
-- conectarlas), orden de resultados, y código corto de referencia
-- (ACL-1001, ACL-1002, ...) para compartir/buscar sin exponer el UUID.
-- amenities_catalog usa el mismo shape que property_types (id/key/label/
-- active) — se administra desde /admin/zonas, apartado "zonas" (no se
-- crea un apartado nuevo solo para esto).
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

create table if not exists amenities_catalog (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  label text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table amenities_catalog enable row level security;

drop policy if exists "Public can read amenities_catalog" on amenities_catalog;
create policy "Public can read amenities_catalog" on amenities_catalog for select using (true);

-- Mismo nivel que property_types/zones (authenticated, no has_admin_section):
-- "zonas" nunca pasó al bloqueo real por rol, solo property_types y agenda
-- lo tienen — amenidades vive en esa misma página, mismo criterio.
drop policy if exists "Authenticated manage amenities_catalog" on amenities_catalog;
create policy "Authenticated manage amenities_catalog" on amenities_catalog for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

insert into amenities_catalog (key, label) values
  ('alberca', 'Alberca'),
  ('seguridad_24h', 'Seguridad 24h'),
  ('acepta_mascotas', 'Acepta mascotas'),
  ('amueblado', 'Amueblado'),
  ('estacionamiento_techado', 'Estacionamiento techado'),
  ('area_comun', 'Área común / jardín'),
  ('aire_acondicionado', 'Aire acondicionado'),
  ('bodega', 'Bodega')
on conflict (key) do nothing;

alter table properties add column if not exists amenities text[] not null default '{}';
create index if not exists idx_properties_amenities on properties using gin(amenities);

alter table properties add column if not exists updated_at timestamptz not null default now();

create sequence if not exists properties_code_seq start 1001;

alter table properties add column if not exists code text;

create or replace function set_property_code()
returns trigger
language plpgsql
as $$
begin
  if new.code is null then
    new.code := 'ACL-' || nextval('properties_code_seq');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_property_code on properties;
create trigger trg_set_property_code
before insert on properties
for each row execute function set_property_code();

-- Backfill de filas existentes sin código (no-op en una base ya migrada).
update properties set code = 'ACL-' || nextval('properties_code_seq') where code is null;

alter table properties alter column code set not null;
create unique index if not exists idx_properties_code on properties(code);

