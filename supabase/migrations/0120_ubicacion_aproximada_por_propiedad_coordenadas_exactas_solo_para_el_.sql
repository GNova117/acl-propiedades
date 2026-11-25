
-- ─────────────────────────────────────────────
-- Ubicación aproximada por propiedad (2026-11-25)
-- Para una casa vacía o de un vendedor que no quiere que su dirección exacta circule, el mapa público muestra solo una zona
-- (círculo de 500 m) en vez del punto. Ocultarlo en la pantalla no bastaría: la API pública devolvería las coordenadas exactas.
-- Por eso, con `location_approximate`:
-- · `properties.lat/lng` (lo único que lee el público) guardan una coordenada DIFUMINADA, desplazada hasta ~350 m de forma estable
--   (depende del id de la propiedad, así que guardar de nuevo no cambia el punto y no se puede promediar volviendo a pedirla);
-- · las coordenadas EXACTAS viven en `property_exact_location`, que solo leen y escriben los roles con Propiedades o Naves.
-- El formulario del panel sigue mostrando y guardando las exactas: un disparador las separa. Una propiedad sin la casilla se
-- queda igual que siempre. El texto de «Dirección» sí se publica tal cual: en estas propiedades conviene capturar solo la colonia.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

alter table properties add column if not exists location_approximate boolean not null default false;

create table if not exists property_exact_location (
  property_id uuid primary key references properties(id) on delete cascade deferrable initially deferred,
  lat double precision not null,
  lng double precision not null,
  updated_at timestamptz not null default now()
);

alter table property_exact_location enable row level security;

drop policy if exists "Rol con apartado propiedades o naves_industriales maneja property_exact_location" on property_exact_location;
create policy "Rol con apartado propiedades o naves_industriales maneja property_exact_location" on property_exact_location for all
  using (has_admin_section('propiedades') or has_admin_section('naves_industriales'))
  with check (has_admin_section('propiedades') or has_admin_section('naves_industriales'));

-- Coordenada difuminada, estable por propiedad: hasta ±250 m en latitud y en longitud (≈ 350 m en diagonal).
create or replace function blur_coordinates(p_id uuid, p_lat double precision, p_lng double precision)
returns double precision[]
language sql
immutable
set search_path = public
as $$
  select array[
    p_lat + ((('x' || substr(md5(p_id::text || 'lat'), 1, 8))::bit(32)::bigint)::double precision / 4294967295.0 - 0.5) * 2 * 0.00225,
    p_lng + ((('x' || substr(md5(p_id::text || 'lng'), 1, 8))::bit(32)::bigint)::double precision / 4294967295.0 - 0.5) * 2 * 0.00225
      / greatest(cos(radians(p_lat)), 0.2)
  ];
$$;

create or replace function properties_split_location()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  coords_changed boolean;
  was_approximate boolean := tg_op = 'UPDATE' and old.location_approximate;
  blurred double precision[];
  exact_row property_exact_location%rowtype;
begin
  coords_changed := tg_op = 'INSERT' or new.lat is distinct from old.lat or new.lng is distinct from old.lng;

  if new.location_approximate then
    -- Se parte de las coordenadas exactas cuando son nuevas (alta, cambio en el formulario) o cuando recién se activa la casilla.
    -- Si ya era aproximada y las coordenadas no cambiaron, lo guardado es el punto difuminado: no se toca nada.
    if coords_changed or not was_approximate then
      insert into property_exact_location (property_id, lat, lng) values (new.id, new.lat, new.lng)
      on conflict (property_id) do update set lat = excluded.lat, lng = excluded.lng, updated_at = now();
      blurred := blur_coordinates(new.id, new.lat, new.lng);
      new.lat := blurred[1];
      new.lng := blurred[2];
    end if;
  elsif was_approximate then
    -- Se apaga la casilla: si no mandaron coordenadas nuevas, se recuperan las exactas guardadas.
    if not coords_changed then
      select * into exact_row from property_exact_location where property_id = new.id;
      if found then
        new.lat := exact_row.lat;
        new.lng := exact_row.lng;
      end if;
    end if;
    delete from property_exact_location where property_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_properties_split_location on properties;
create trigger trg_properties_split_location
before insert or update of lat, lng, location_approximate on properties
for each row execute function properties_split_location();
