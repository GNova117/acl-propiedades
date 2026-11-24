-- ─────────────────────────────────────────────
-- Conteo de propiedades por tipo, sin bajar el catálogo (2026-11-18)
-- El encabezado y el inicio del sitio bajaban TODAS las propiedades activas solo para contar cuántas hay de cada tipo (y el
-- inicio, además, para elegir las destacadas). Ahora piden este número ya contado. Cuenta las propiedades activas (con
-- cualquier estatus), igual que antes. Función de solo lectura que respeta las políticas de la tabla.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

create or replace function public_type_counts()
returns jsonb
language sql
stable
as $$
  select coalesce(jsonb_object_agg(type, n), '{}'::jsonb)
  from (select type, count(*)::int as n from properties where active group by type) t;
$$;

revoke all on function public_type_counts() from public;
grant execute on function public_type_counts() to anon, authenticated;
