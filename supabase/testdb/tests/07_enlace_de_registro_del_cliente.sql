-- Enlace de registro del cliente: el asesor lo crea (con el tipo ya elegido), el cliente anónimo lo usa UNA vez, el cliente
-- nace con el tipo del enlace (no con lo que mande el navegador), solo se guardan campos de la lista, el consentimiento queda
-- con evidencia y las tablas no se leen directo.
begin;


-- Cada llamada sale de una IP distinta (así el freno por IP no estorba a las pruebas de validación; se prueba aparte, al final).
create function t_submit(p_token text, p_data text, p_consent text) returns jsonb language plpgsql as $$
begin
  perform set_config('request.headers', json_build_object('x-forwarded-for', '10.0.' || (random() * 250)::int || '.' || (random() * 250)::int, 'user-agent', 'UA prueba')::text, true);
  return client_intake_submit(p_token, p_data::jsonb, p_consent);
end $$;
grant execute on function t_submit(text, text, text) to anon;

insert into client_intake_links (token, type, label, created_by)
values (repeat('a', 32), 'comprador', 'Pareja de Juan', 'asesor@acl.mx'),
       (repeat('b', 32), 'vendedor', null, 'asesor@acl.mx'),
       (repeat('c', 32), 'ambos', null, 'asesor@acl.mx');
insert into client_intake_links (token, type, expires_at) values (repeat('d', 32), 'comprador', now() - interval '1 minute');
insert into client_intake_links (token, type, revoked_at) values (repeat('e', 32), 'comprador', now());

set local role anon;
select set_config('request.jwt.claim.role', 'anon', true), set_config('request.headers', '{"x-forwarded-for":"9.9.9.9","user-agent":"UA prueba"}', true);

do $$
declare r jsonb;
begin
  -- Estados del enlace
  assert client_intake_status(repeat('a', 32)) = '{"status":"activo","type":"comprador"}'::jsonb, 'un enlace vigente dice su tipo';
  assert client_intake_status(repeat('f', 32)) ->> 'status' = 'invalido', 'un token que no existe es inválido';
  assert client_intake_status(repeat('d', 32)) ->> 'status' = 'expirado', 'uno vencido está expirado';
  assert client_intake_status(repeat('e', 32)) ->> 'status' = 'revocado', 'uno desactivado está revocado';

  -- Validaciones (no consumen el enlace)
  assert t_submit(repeat('a', 32), '{"name":"Ana López","phone":"6181234567"}', '') ->> 'error' = 'consent_required', 'sin aviso de privacidad no se guarda';
  assert t_submit(repeat('a', 32), '{"name":"A","phone":"6181234567"}', 'v1') ->> 'error' = 'name_required', 'nombre muy corto';
  assert t_submit(repeat('a', 32), '{"name":"Ana López","phone":"123"}', 'v1') ->> 'error' = 'phone_invalid', 'teléfono con menos de 10 dígitos';
  assert t_submit(repeat('a', 32), '{"name":"Ana López","phone":"6181234567","email":"no-es-correo"}', 'v1') ->> 'error' = 'email_invalid', 'correo inválido';
  assert t_submit(repeat('a', 32), '{"name":"Ana López","phone":"6181234567","rfc":"XYZ"}', 'v1') ->> 'error' = 'rfc_invalid', 'RFC inválido';
  assert t_submit(repeat('a', 32), '{"name":"Ana López","phone":"6181234567","curp":"XYZ"}', 'v1') ->> 'error' = 'curp_invalid', 'CURP inválida';
  assert t_submit(repeat('a', 32), '{"name":"Ana López","phone":"6181234567","fecha_nacimiento":"2999-01-01"}', 'v1') ->> 'error' = 'date_invalid', 'fecha futura';
  assert t_submit(repeat('a', 32), '{"name":"Ana López","phone":"6181234567","fecha_nacimiento":"no"}', 'v1') ->> 'error' = 'date_invalid', 'fecha que no es fecha';
  assert t_submit(repeat('a', 32), '{"name":"Ana López","phone":"6181234567","estado_civil":"Otro"}', 'v1') ->> 'error' = 'civil_invalid', 'estado civil fuera de la lista';
  assert t_submit(repeat('d', 32), '{"name":"Ana López","phone":"6181234567"}', 'v1') ->> 'error' = 'expirado', 'enlace vencido';
  assert t_submit(repeat('e', 32), '{"name":"Ana López","phone":"6181234567"}', 'v1') ->> 'error' = 'revocado', 'enlace desactivado';
  assert t_submit(repeat('f', 32), '{"name":"Ana López","phone":"6181234567"}', 'v1') ->> 'error' = 'invalido', 'enlace inexistente';
  assert client_intake_status(repeat('a', 32)) ->> 'status' = 'activo', 'los intentos con error no consumen el enlace';

  -- Comprador: trae todo, incluso lo que NO está en la lista (type, active, contrasena_portal) para comprobar que se ignora.
  r := t_submit(repeat('a', 32), $j${
    "name":"  Ana López  ","phone":"618 123 4567","email":"ANA@Correo.MX","type":"vendedor","active":false,
    "contrasena_portal":"secreta","fecha_nacimiento":"1990-05-20","estado_civil":"Casado","domicilio":"Calle 1 #2",
    "rfc":"lopa900520ab1","curp":"LOPA900520MDGPNN01","identificacion_oficial":"INE123","nss":"12345678901",
    "razon_social":"Empresa SA","referencia1_nombre":"Luis","referencia1_telefono":"6180000000","numero_credito":"NO-DEBE-GUARDARSE"
  }$j$, 'v1');
  assert r = '{"ok":true}'::jsonb, 'el envío válido responde ok: ' || r::text;

  -- Segundo intento con el mismo enlace
  assert t_submit(repeat('a', 32), '{"name":"Otra Persona","phone":"6181234567"}', 'v1') ->> 'error' = 'usado', 'un enlace sirve una sola vez';
  assert client_intake_status(repeat('a', 32)) ->> 'status' = 'usado', 'el estado pasa a usado';

  -- Vendedor: sin campos de comprador
  r := t_submit(repeat('b', 32), '{"name":"Beto Ruiz","phone":"6189999999","nss":"999","numero_credito":"C-77","razon_social":"No va"}', 'v1');
  assert (r ->> 'ok')::boolean, 'vendedor ok';
  r := t_submit(repeat('c', 32), '{"name":"Carla Mora","phone":"6188888888","nss":"111","numero_credito":"C-88"}', 'v1');
  assert (r ->> 'ok')::boolean, 'ambos ok';
end $$;

-- El visitante anónimo no ve las tablas (RLS sin política para él: regresan 0 filas aunque haya datos)
do $$
begin
  assert (select count(*) from client_intake_links) = 0, 'anon no debe leer client_intake_links';
  assert (select count(*) from clients) = 0, 'anon no debe leer clients';
  assert (select count(*) from privacy_consents) = 0, 'anon no debe leer privacy_consents';
end $$;

reset role;

do $$
declare c clients; v clients;
begin
  select * into c from clients where phone = '618 123 4567';
  assert c.id is not null, 'el cliente se creó';
  assert c.type = 'comprador', 'el tipo lo pone el enlace (el asesor), no el navegador: ' || c.type;
  assert c.active, 'queda activo aunque el navegador mande active=false';
  assert c.name = 'Ana López', 'el nombre se recorta';
  assert c.email = 'ana@correo.mx', 'el correo se guarda en minúsculas';
  assert c.rfc = 'LOPA900520AB1', 'el RFC se guarda en mayúsculas';
  assert c.curp = 'LOPA900520MDGPNN01' and c.fecha_nacimiento = date '1990-05-20' and c.estado_civil = 'Casado', 'datos personales';
  assert c.nss = '12345678901' and c.razon_social = 'Empresa SA' and c.referencia1_nombre = 'Luis', 'datos de comprador';
  assert c.numero_credito is null, 'un comprador no guarda número de crédito';
  assert c.contrasena_portal is null, 'la contraseña del portal NUNCA se pide ni se guarda por el enlace';
  assert c.notes like '%Pareja de Juan%', 'la nota interna del enlace queda en las notas del cliente';
  assert (select client_id from client_intake_links where token = repeat('a', 32)) = c.id, 'el enlace queda ligado al cliente';
  assert (select submitted_at from client_intake_links where token = repeat('a', 32)) is not null, 'queda la fecha de envío';

  select * into v from clients where name = 'Beto Ruiz';
  assert v.type = 'vendedor' and v.numero_credito = 'C-77', 'vendedor guarda su número de crédito';
  assert v.nss is null and v.razon_social is null, 'un vendedor no guarda datos de comprador';

  select * into v from clients where name = 'Carla Mora';
  assert v.type = 'ambos' and v.nss = '111' and v.numero_credito = 'C-88', 'ambos guarda las dos partes';

  assert (select count(*) from privacy_consents where intake_link_id is not null) = 3, 'un consentimiento por cliente';
  assert (select accepted_ip from privacy_consents where client_id = c.id) like '10.0.%', 'el consentimiento guarda la IP';
  assert (select accepted_agent from privacy_consents where client_id = c.id) = 'UA prueba', 'el consentimiento guarda el navegador';
  assert (select consent_version from privacy_consents where client_id = c.id) = 'v1', 'el consentimiento guarda la versión del aviso';
end $$;

-- Freno por IP: el envío 11 desde la misma conexión se rechaza (cuenta también los intentos con error: 13+3 ya pasaron de 10).
set local role anon;
select set_config('request.jwt.claim.role', 'anon', true), set_config('request.headers', '{"x-forwarded-for":"7.7.7.7"}', true);
do $$
declare i int; blocked boolean := false;
begin
  for i in 1..10 loop
    perform client_intake_status(repeat('f', 32));
    perform client_intake_submit(repeat('f', 32), '{}', 'v1');
  end loop;
  begin
    perform client_intake_submit(repeat('f', 32), '{}', 'v1');
  exception when sqlstate '54429' then
    blocked := true;
  end;
  assert blocked, 'el envío 11 desde la misma IP debía frenarse (54429)';
end $$;
reset role;

-- Sin sesión de personal con el apartado clientes nadie lee los enlaces: authenticated sin rol de admin no ve filas.
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true), set_config('request.jwt.claim.email', 'nadie@correo.mx', true);
do $$
begin
  assert (select count(*) from client_intake_links) = 0, 'un usuario con sesión pero sin el apartado clientes no ve los enlaces';
end $$;
reset role;

rollback;
