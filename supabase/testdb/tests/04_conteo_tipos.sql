-- public_type_counts: cuenta solo propiedades activas, por tipo.
begin;
insert into properties (title, type, price, area_m2, zone, address, lat, lng, code, active) values
  ('A', 'casa', 1, 1, 'Torreón', 'x', 25, -103, 'ACL-9001', true),
  ('B', 'casa', 1, 1, 'Torreón', 'x', 25, -103, 'ACL-9002', true),
  ('C', 'casa', 1, 1, 'Torreón', 'x', 25, -103, 'ACL-9003', false),
  ('D', 'terreno', 1, 1, 'Torreón', 'x', 25, -103, 'ACL-9004', true);
do $$
declare counts jsonb;
begin
  select public_type_counts() into counts;
  assert (counts ->> 'casa')::int >= 2 and (counts ->> 'terreno')::int >= 1, 'conteos por tipo: ' || counts::text;
end $$;
set local role anon;
select public_type_counts();
reset role;
rollback;
