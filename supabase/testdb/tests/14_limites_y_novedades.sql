-- Vistas por IP (tope de 40 por hora), límites de tamaño en contact_messages, registrar_novedad (solo con el token de Vault) y
-- conteos por tipo sin las vendidas.
begin;

insert into properties (id, title, type, price, area_m2, zone, address, lat, lng, active, status) values
  ('00000000-0000-0000-0000-0000000000a1', 'Disponible', 'casa', 1000000, 100, 'Torreón', 'Calle 1', 25.5, -103.4, true, 'disponible'),
  ('00000000-0000-0000-0000-0000000000a2', 'Vendida', 'casa', 1000000, 100, 'Torreón', 'Calle 2', 25.5, -103.4, true, 'vendida'),
  ('00000000-0000-0000-0000-0000000000a3', 'Apartada', 'terreno', 1000000, 100, 'Torreón', 'Calle 3', 25.5, -103.4, true, 'apartada'),
  ('00000000-0000-0000-0000-0000000000a4', 'Borrador', 'nave_industrial', 1000000, 100, 'Torreón', 'Calle 4', 25.5, -103.4, false, 'disponible');

set local role anon;
select set_config('request.jwt.claim.role', 'anon', true), set_config('request.headers', '{"x-forwarded-for":"9.9.9.9"}', true);

do $$
declare
  n int;
  i int;
  r jsonb;
begin
  -- Conteos: casa 1 (la vendida no cuenta), terreno 1 (apartada sí), nave 0 (borrador).
  r := public_type_counts();
  assert (r ->> 'casa')::int = 1 and (r ->> 'terreno')::int = 1 and r -> 'nave_industrial' is null, 'conteos sin vendidas ni borradores: ' || r::text;

  -- Vistas: una misma IP anota hasta 40 vistas nuevas por hora; después ya no suma, pero la función sigue respondiendo.
  for i in 1..45 loop
    perform record_property_view('00000000-0000-0000-0000-0000000000a1', gen_random_uuid(), 3);
  end loop;
  assert record_property_view('00000000-0000-0000-0000-0000000000a1', gen_random_uuid(), 3) = 40, 'sigue devolviendo el conteo (40 distintos, sin pasarse)';

  -- Otra IP sí puede anotar.
  perform set_config('request.headers', '{"x-forwarded-for":"8.8.8.8"}', true);
  perform record_property_view('00000000-0000-0000-0000-0000000000a1', gen_random_uuid(), 3);
  assert record_property_view('00000000-0000-0000-0000-0000000000a1', gen_random_uuid(), 3) = 42, 'otra IP sí anota: 40 de la primera + 2 de la segunda';

  -- contact_messages: tamaños y channel.
  perform set_config('request.headers', '{"x-forwarded-for":"7.7.7.7"}', true);
  insert into contact_messages (name, email, message, channel) values ('Ana', 'ana@correo.com', 'Hola', 'formulario');
  begin
    insert into contact_messages (name, email, message) values (repeat('x', 201), 'ana@correo.com', 'Hola');
    assert false, 'nombre de más de 200';
  exception when check_violation then null;
  end;
  begin
    insert into contact_messages (name, email, message) values ('Ana', 'ana@correo.com', repeat('x', 5001));
    assert false, 'mensaje de más de 5000';
  exception when check_violation then null;
  end;
  begin
    insert into contact_messages (name, email, message, details) values ('Ana', 'ana@correo.com', 'Hola', jsonb_build_object('relleno', repeat('x', 20000)));
    assert false, 'details de más de 16 KB';
  exception when check_violation then null;
  end;
  begin
    insert into contact_messages (name, email, message, channel) values ('Ana', 'ana@correo.com', 'Hola', 'DROP TABLE; --');
    assert false, 'channel con basura';
  exception when check_violation then null;
  end;
end $$;

reset role;

do $$ declare n int; begin
  select count(*) into n from property_views where property_id = '00000000-0000-0000-0000-0000000000a1';
  assert n = 42, 'en la tabla: 40 de una IP (tope) y 2 de la otra: ' || n;
  assert (select count(distinct ip_hash) from property_views) = 2 and not exists (select 1 from property_views where ip_hash in ('9.9.9.9', '8.8.8.8')), 'guarda una huella, no la IP';
end $$;

-- registrar_novedad: solo con el token de Vault.
insert into vault.secrets (name, secret) values ('novedades_token', 'token-de-prueba-largo-y-aleatorio-123') on conflict (name) do update set secret = excluded.secret;
set local role anon;
select set_config('request.jwt.claim.role', 'anon', true);
do $$
begin
  assert registrar_novedad('token-equivocado', 'Título', 'Cuerpo') ->> 'error' = 'unauthorized', 'con otro token no inserta';
  assert registrar_novedad(null, 'Título', 'Cuerpo') ->> 'error' = 'unauthorized', 'sin token tampoco';
  assert registrar_novedad('token-de-prueba-largo-y-aleatorio-123', '  ', 'Cuerpo') ->> 'error' = 'invalid', 'título vacío';
  assert registrar_novedad('token-de-prueba-largo-y-aleatorio-123', 'Cambio de prueba', 'Detalle', 'octocat') ->> 'ok' = 'true', 'con el token inserta';
  assert (select count(*) from site_updates) = 0, 'el público no lee site_updates (RLS sin políticas)';
end $$;
reset role;
do $$ begin
  assert (select count(*) from site_updates where title = 'Cambio de prueba' and created_by = 'octocat') = 1, 'la novedad quedó registrada';
  assert (select count(*) from site_updates) = 1, 'y solo esa';
end $$;

-- Sin secreto configurado, nadie inserta.
delete from vault.secrets where name = 'novedades_token';
do $$ begin
  assert registrar_novedad('token-de-prueba-largo-y-aleatorio-123', 'x', 'y') ->> 'error' = 'unauthorized', 'sin secreto en Vault no se acepta nada';
end $$;

rollback;
