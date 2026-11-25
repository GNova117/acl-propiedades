-- Estatus «rentada»: se puede guardar, no es una venta, no cuenta como disponible en el inicio y no admite visitas.
begin;

insert into properties (id, title, type, operation_type, price, status, active, description, zone, address, area_m2, code, lat, lng)
values
  ('00000000-0000-0000-0000-0000000000e1', 'Casa en renta ocupada', 'casa', 'renta', 9000, 'rentada', true, 'x', 'Centro', 'Calle 1', 100, 'ACL-9001', 25.5, -103.4),
  ('00000000-0000-0000-0000-0000000000e2', 'Casa disponible', 'casa', 'compra', 900000, 'disponible', true, 'x', 'Centro', 'Calle 2', 100, 'ACL-9002', 25.5, -103.4),
  ('00000000-0000-0000-0000-0000000000e3', 'Casa apartada', 'casa', 'compra', 900000, 'apartada', true, 'x', 'Centro', 'Calle 3', 100, 'ACL-9003', 25.5, -103.4),
  ('00000000-0000-0000-0000-0000000000e4', 'Casa vendida', 'casa', 'compra', 900000, 'vendida', true, 'x', 'Centro', 'Calle 4', 100, 'ACL-9004', 25.5, -103.4);

do $$
begin
  assert (select status from properties where id = '00000000-0000-0000-0000-0000000000e1') = 'rentada', 'rentada se guarda';
  begin
    update properties set status = 'rara' where id = '00000000-0000-0000-0000-0000000000e1';
    assert false, 'un estatus inventado no se permite';
  exception when check_violation then null;
  end;
end $$;

set local role anon;
select set_config('request.jwt.claim.role', 'anon', true), set_config('request.headers', '{"x-forwarded-for":"7.7.7.7"}', true);
do $$
declare r jsonb;
begin
  -- Solo la disponible y la apartada cuentan en el inicio y el menú.
  assert (public_type_counts() ->> 'casa')::int = 2, 'conteo: ' || public_type_counts()::text;

  -- No se puede pedir visita de una rentada (ni de una vendida).
  r := request_visit('00000000-0000-0000-0000-0000000000e1', current_date + 2, '11:00', 'Ana', 'ana@correo.mx', '8711234567', null);
  assert r ->> 'error' = 'property_unavailable', 'rentada no admite visita: ' || r::text;
  r := request_visit('00000000-0000-0000-0000-0000000000e4', current_date + 2, '11:00', 'Ana', 'ana@correo.mx', '8711234567', null);
  assert r ->> 'error' = 'property_unavailable', 'vendida tampoco: ' || r::text;
  assert get_visit_slots('00000000-0000-0000-0000-0000000000e1', current_date + 2, 30) -> 'slots' = '[]'::jsonb, 'sin horarios para una rentada';
end $$;
reset role;

rollback;
