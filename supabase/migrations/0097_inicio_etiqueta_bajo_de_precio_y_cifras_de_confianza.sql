-- ─────────────────────────────────────────────
-- Inicio: etiqueta "Bajó de precio" y cifras de confianza (2026-10)
-- ─────────────────────────────────────────────
-- 1) properties guarda el precio anterior y cuándo cambió, para la etiqueta
--    "Bajó de precio" de las tarjetas y la ficha. Lo escribe un trigger (no el
--    código del admin), igual que property_changes, así queda capturado sin
--    importar qué pantalla cambió el precio: al bajar guarda el precio de
--    antes; al subir lo borra. El sitio solo muestra la etiqueta 30 días.
--    properties ya es legible con la anon key, y estas dos columnas son
--    justo lo que se quiere publicar.
-- 2) public_sales_stats() da al inicio el total de ventas, las del último año,
--    el promedio de días de venta y los ids de las vendidas más recientes.
--    `ventas` es interna (RLS por apartado reportes), por eso va en una
--    función security definer que solo devuelve agregados y ids de casas que
--    ya se ven como "Vendida" en el sitio — nunca asesor, fecha exacta ni
--    quién la registró. El promedio ignora ventas sin días entre alta y venta
--    (las casas ya vendidas antes de usar el sistema se registraron el mismo
--    día). Espejo en JS: computeSalesStats() en src/lib/trustStats.js.
-- Re-ejecutable. Sin correrlo todo sigue funcionando: sin las columnas no
-- sale la etiqueta, y sin la función el inicio no muestra el bloque de cifras.
alter table properties add column if not exists previous_price numeric;
alter table properties add column if not exists price_changed_at timestamptz;

create or replace function set_price_drop() returns trigger
language plpgsql
as $$
begin
  if new.price is distinct from old.price then
    if new.price < old.price then
      new.previous_price := old.price;
    else
      new.previous_price := null;
    end if;
    new.price_changed_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_price_drop on properties;
create trigger trg_set_price_drop
before update on properties
for each row execute function set_price_drop();

create or replace function public_sales_stats() returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'total', count(*),
    'last_12_months', count(*) filter (where v.fecha_venta >= current_date - 365),
    'avg_days_to_sell', round(avg(v.fecha_venta - p.created_at::date) filter (where v.fecha_venta - p.created_at::date > 0)),
    'recent_property_ids', coalesce((
      select jsonb_agg(r.property_id)
      from (
        select v2.property_id
        from ventas v2
        join properties p2 on p2.id = v2.property_id
        where p2.active
        order by v2.fecha_venta desc
        limit 6
      ) r
    ), '[]'::jsonb)
  )
  from ventas v
  join properties p on p.id = v.property_id;
$$;

revoke all on function public_sales_stats() from public;
grant execute on function public_sales_stats() to anon, authenticated;

