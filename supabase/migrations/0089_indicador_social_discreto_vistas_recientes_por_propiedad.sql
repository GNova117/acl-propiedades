-- ─────────────────────────────────────────────
-- Indicador social discreto: vistas recientes por propiedad (2026-10-15)
-- "N personas vieron esta propiedad en los últimos 3 días" en la ficha
-- pública — con datos reales, nunca un número inventado. Un visitante no
-- tiene sesión; visitor_id es un id aleatorio que genera y guarda el propio
-- navegador (localStorage), no identifica a la persona. El unique index
-- evita que recargar la página una y otra vez infle el conteo: cuenta una
-- vez por visitante por propiedad por día.
-- RLS sin políticas = nadie con anon/authenticated lee ni escribe la tabla
-- directo; solo la función security definer de abajo puede, validando y
-- agregando sin exponer las filas crudas (quién vio qué y cuándo).
-- ─────────────────────────────────────────────

create table if not exists property_views (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  visitor_id uuid not null,
  viewed_on date not null default current_date,
  created_at timestamptz not null default now(),
  unique (property_id, visitor_id, viewed_on)
);

create index if not exists idx_property_views_property_date on property_views(property_id, viewed_on desc);

alter table property_views enable row level security;

-- Registra la vista (si no existía ya hoy para este visitante+propiedad) y
-- devuelve, en la misma llamada, cuántos visitantes distintos la vieron en
-- los últimos p_days días — evita una segunda ida y vuelta al servidor solo
-- para leer el conteo que se acaba de escribir.
create or replace function record_property_view(p_property_id uuid, p_visitor_id uuid, p_days int default 3)
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into property_views (property_id, visitor_id)
  values (p_property_id, p_visitor_id)
  on conflict (property_id, visitor_id, viewed_on) do nothing;

  return (
    select count(distinct visitor_id)
    from property_views
    where property_id = p_property_id
      and viewed_on > current_date - p_days
  );
end;
$$;

revoke all on function record_property_view(uuid, uuid, int) from public;
grant execute on function record_property_view(uuid, uuid, int) to anon, authenticated;

