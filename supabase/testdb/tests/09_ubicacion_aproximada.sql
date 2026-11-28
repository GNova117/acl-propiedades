-- Ubicación aproximada: con la casilla, el público solo ve una coordenada difuminada y estable; las exactas solo las leen los
-- roles con Propiedades; apagar la casilla recupera las exactas; una propiedad sin casilla no cambia.
begin;

insert into admin_roles (slug, name, sections) values ('t-prop', 'Prueba propiedades', array['propiedades']), ('t-otro', 'Prueba otro', array['agenda']);
insert into admin_access (email, role_id)
select 'prop@acl.mx', id from admin_roles where slug = 't-prop';
insert into admin_access (email, role_id)
select 'otro@acl.mx', id from admin_roles where slug = 't-otro';

insert into properties (id, title, type, price, area_m2, zone, address, lat, lng, active, location_approximate)
values ('00000000-0000-0000-0000-0000000000a1', 'Casa exacta', 'casa', 1000000, 100, 'Torreón', 'Calle 1', 25.5400, -103.4000, true, false),
       ('00000000-0000-0000-0000-0000000000a2', 'Casa aproximada', 'casa', 1000000, 100, 'Torreón', 'Colonia Centro', 25.5400, -103.4000, true, true);

do $$
declare
  a record;
  d_m double precision;
  ex record;
begin
  -- Sin la casilla no cambia nada.
  select lat, lng into a from properties where id = '00000000-0000-0000-0000-0000000000a1';
  assert a.lat = 25.5400 and a.lng = -103.4000, 'sin casilla las coordenadas quedan tal cual';
  assert not exists (select 1 from property_exact_location where property_id = '00000000-0000-0000-0000-0000000000a1'), 'sin casilla no hay fila privada';

  -- Con la casilla: lo público está difuminado (a menos de ~400 m, pero no es el punto exacto)...
  select lat, lng into a from properties where id = '00000000-0000-0000-0000-0000000000a2';
  assert (a.lat, a.lng) is distinct from (25.5400::double precision, -103.4000::double precision), 'la coordenada pública no es la exacta';
  d_m := sqrt(power((a.lat - 25.5400) * 111000, 2) + power((a.lng + 103.4000) * 111000 * cos(radians(25.54)), 2));
  assert d_m < 400, 'la coordenada difuminada queda a menos de 400 m: ' || d_m::text;
  -- ...y la exacta quedó aparte.
  select lat, lng into ex from property_exact_location where property_id = '00000000-0000-0000-0000-0000000000a2';
  assert ex.lat = 25.5400 and ex.lng = -103.4000, 'las coordenadas exactas se guardan en la tabla privada';

  -- Es estable: volver a guardar con las mismas coordenadas exactas da el mismo punto público.
  update properties set lat = 25.5400, lng = -103.4000 where id = '00000000-0000-0000-0000-0000000000a2';
  assert (select lat from properties where id = '00000000-0000-0000-0000-0000000000a2') = a.lat, 'el punto difuminado es estable';

  -- Guardar otros campos no toca nada (las coordenadas no cambian).
  update properties set title = 'Casa aproximada 2', status = 'apartada' where id = '00000000-0000-0000-0000-0000000000a2';
  assert (select lat from properties where id = '00000000-0000-0000-0000-0000000000a2') = a.lat, 'otros cambios no mueven el punto';
  assert (select lat from property_exact_location where property_id = '00000000-0000-0000-0000-0000000000a2') = 25.5400, 'ni las exactas';

  -- Mover la propiedad (el formulario manda coordenadas exactas nuevas).
  update properties set lat = 25.6000, lng = -103.5000 where id = '00000000-0000-0000-0000-0000000000a2';
  assert (select lat from property_exact_location where property_id = '00000000-0000-0000-0000-0000000000a2') = 25.6000, 'las exactas se actualizan';
  assert abs((select lat from properties where id = '00000000-0000-0000-0000-0000000000a2') - 25.6000) < 0.0025, 'el punto público se mueve con ellas, siempre difuminado';
  assert (select lat from properties where id = '00000000-0000-0000-0000-0000000000a2') <> 25.6000, 'y nunca es la exacta';

  -- Activar la casilla en una propiedad que ya existía.
  update properties set location_approximate = true where id = '00000000-0000-0000-0000-0000000000a1';
  assert (select lat from properties where id = '00000000-0000-0000-0000-0000000000a1') <> 25.5400, 'al activar la casilla el punto público se difumina';
  assert (select lat from property_exact_location where property_id = '00000000-0000-0000-0000-0000000000a1') = 25.5400, 'y la exacta se guarda aparte';

  -- Apagar la casilla recupera las exactas y borra la fila privada.
  update properties set location_approximate = false where id = '00000000-0000-0000-0000-0000000000a1';
  select lat, lng into a from properties where id = '00000000-0000-0000-0000-0000000000a1';
  assert a.lat = 25.5400 and a.lng = -103.4000, 'al apagar la casilla vuelven las coordenadas exactas';
  assert not exists (select 1 from property_exact_location where property_id = '00000000-0000-0000-0000-0000000000a1'), 'y no queda fila privada';
end $$;

-- Quién lee las exactas: un rol con Propiedades sí; uno sin ese apartado y el público, no.
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true), set_config('request.jwt.claim.email', 'prop@acl.mx', true);
do $$ begin
  assert (select count(*) from property_exact_location) = 1, 'quien tiene Propiedades lee las coordenadas exactas';
end $$;
select set_config('request.jwt.claim.email', 'otro@acl.mx', true);
do $$ begin
  assert (select count(*) from property_exact_location) = 0, 'un rol sin Propiedades no las ve';
end $$;
set local role anon;
select set_config('request.jwt.claim.role', 'anon', true), set_config('request.jwt.claim.email', '', true);
do $$ begin
  assert (select count(*) from property_exact_location) = 0, 'el público no ve la tabla privada';
  assert (select lat from properties where id = '00000000-0000-0000-0000-0000000000a2') <> 25.6000, 'y la coordenada pública de una aproximada no es la exacta';
end $$;

rollback;
