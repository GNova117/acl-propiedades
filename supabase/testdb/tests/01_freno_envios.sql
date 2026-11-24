-- Freno de envíos públicos: el 11.º envío de una IP se rechaza (54429), otra IP pasa, el personal no se frena y lo anónimo
-- no puede leer ni llamar lo interno.
begin;
set local role anon;
select set_config('request.jwt.claim.role', 'anon', true), set_config('request.headers', '{"x-forwarded-for":"1.1.1.1, 10.0.0.1"}', true);

do $$
declare i int; blocked boolean := false;
begin
  for i in 1..10 loop
    insert into contact_messages (name, email, message) values ('Prueba', 'prueba@correo.com', 'mensaje ' || i);
  end loop;
  begin
    insert into contact_messages (name, email, message) values ('Prueba', 'prueba@correo.com', 'el 11');
  exception when sqlstate '54429' then
    blocked := true;
  end;
  assert blocked, 'el envío 11 de la misma IP debía rechazarse con 54429';
end $$;

select set_config('request.headers', '{"x-forwarded-for":"9.9.9.9"}', true);
insert into contact_messages (name, email, message) values ('Otra IP', 'otra@correo.com', 'pasa');

do $$
declare denied boolean := false;
begin
  -- Sin políticas de lectura, la RLS la deja VACÍA para anon (aunque Supabase le dé el privilegio base).
  assert (select count(*) from public_rate_hits) = 0, 'anon no debe ver public_rate_hits';
  begin
    perform enforce_public_rate_limit('x', 1, 1);
  exception when insufficient_privilege then
    denied := true;
  end;
  assert denied, 'anon no debe poder llamar enforce_public_rate_limit directo';
end $$;
reset role;

-- El personal con sesión no se frena.
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
do $$
declare i int;
begin
  for i in 1..15 loop
    insert into contact_messages (name, email, message) values ('Personal', 'personal@correo.com', 'mensaje ' || i);
  end loop;
end $$;
reset role;
rollback;
