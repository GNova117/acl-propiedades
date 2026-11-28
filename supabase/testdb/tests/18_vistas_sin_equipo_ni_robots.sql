-- Las vistas de una ficha no cuentan al equipo (sesión del panel) ni a los robots, pero la ficha igual recibe el conteo.
begin;

insert into properties (id, title, type, operation_type, price, status, active, description, zone, address, area_m2, code, lat, lng)
values ('00000000-0000-0000-0000-0000000000e1', 'Casa', 'casa', 'compra', 900000, 'disponible', true, 'x', 'Centro', 'Calle 1', 100, 'ACL-9101', 25.5, -103.4);

set local role anon;
select set_config('request.jwt.claim.role', 'anon', true);
do $$
declare n int;
begin
  -- Una persona normal cuenta.
  perform set_config('request.headers', '{"x-forwarded-for":"1.1.1.1","user-agent":"Mozilla/5.0 (iPhone) Safari"}', true);
  n := record_property_view('00000000-0000-0000-0000-0000000000e1', gen_random_uuid(), 3);
  assert n = 1, 'una persona cuenta: ' || n;

  -- Robots: no suman, pero reciben el conteo.
  perform set_config('request.headers', '{"x-forwarded-for":"2.2.2.2","user-agent":"Mozilla/5.0 (compatible; Googlebot/2.1)"}', true);
  n := record_property_view('00000000-0000-0000-0000-0000000000e1', gen_random_uuid(), 3);
  assert n = 1, 'Googlebot no suma: ' || n;
  perform set_config('request.headers', '{"x-forwarded-for":"3.3.3.3","user-agent":"WhatsApp/2.23"}', true);
  n := record_property_view('00000000-0000-0000-0000-0000000000e1', gen_random_uuid(), 3);
  assert n = 1, 'la vista previa de WhatsApp no suma: ' || n;
  perform set_config('request.headers', '{"x-forwarded-for":"4.4.4.4","user-agent":"HeadlessChrome/120"}', true);
  n := record_property_view('00000000-0000-0000-0000-0000000000e1', gen_random_uuid(), 3);
  assert n = 1, 'Chrome sin cabeza no suma: ' || n;

  -- Sin User-Agent (cliente de API) cuenta como persona (el tope por IP lo limita).
  perform set_config('request.headers', '{"x-forwarded-for":"5.5.5.5"}', true);
  n := record_property_view('00000000-0000-0000-0000-0000000000e1', gen_random_uuid(), 3);
  assert n = 2, 'sin User-Agent cuenta: ' || n;
end $$;
reset role;

-- El equipo con sesión no suma.
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true), set_config('request.headers', '{"x-forwarded-for":"6.6.6.6","user-agent":"Mozilla/5.0 Safari"}', true);
do $$
declare n int;
begin
  n := record_property_view('00000000-0000-0000-0000-0000000000e1', gen_random_uuid(), 3);
  assert n = 2, 'un asesor con sesión no suma: ' || n;
end $$;
reset role;

rollback;
