-- `updated_at` de propiedades lo fija la base cuando la fila cambia de verdad (y solo entonces).
begin;

insert into properties (id, title, type, operation_type, price, status, active, description, zone, address, area_m2, code, lat, lng, updated_at)
values ('00000000-0000-0000-0000-0000000000e1', 'Casa', 'casa', 'compra', 900000, 'disponible', true, 'x', 'Centro', 'Calle 1', 100, 'ACL-9201', 25.5, -103.4, now() - interval '30 days');

do $$
declare before_ts timestamptz;
begin
  -- Un UPDATE que no cambia nada no toca la fecha.
  update properties set title = 'Casa' where id = '00000000-0000-0000-0000-0000000000e1';
  select updated_at into before_ts from properties where id = '00000000-0000-0000-0000-0000000000e1';
  assert before_ts < now() - interval '29 days', 'sin cambios no se mueve updated_at';

  -- Un cambio real (aunque no mande updated_at, como una venta o un lote) lo actualiza.
  update properties set status = 'vendida' where id = '00000000-0000-0000-0000-0000000000e1';
  select updated_at into before_ts from properties where id = '00000000-0000-0000-0000-0000000000e1';
  assert before_ts > now() - interval '1 minute', 'un cambio real fija updated_at a la hora de la base';

  -- Aunque el navegador mande una fecha vieja, manda la base.
  update properties set price = 950000, updated_at = now() - interval '5 days' where id = '00000000-0000-0000-0000-0000000000e1';
  select updated_at into before_ts from properties where id = '00000000-0000-0000-0000-0000000000e1';
  assert before_ts > now() - interval '1 minute', 'la hora del navegador no manda';
end $$;

rollback;
