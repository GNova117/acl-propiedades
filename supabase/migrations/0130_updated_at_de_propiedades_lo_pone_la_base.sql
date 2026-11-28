-- ─────────────────────────────────────────────
-- `updated_at` de propiedades lo pone la base (2026-11-26)
-- Antes lo llenaba el navegador del asesor: cambios hechos por otro camino (marcar vendida, edición en lote, una función) no lo
-- actualizaban y «Actualizada el…», los informes y el orden por fecha quedaban viejos. Ahora un disparador lo fija a la hora de la base
-- en cada UPDATE (solo si la fila cambió de verdad).
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

create or replace function properties_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  if to_jsonb(new) - 'updated_at' is distinct from to_jsonb(old) - 'updated_at' then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_properties_touch_updated_at on properties;
create trigger trg_properties_touch_updated_at
  before update on properties
  for each row execute function properties_touch_updated_at();
