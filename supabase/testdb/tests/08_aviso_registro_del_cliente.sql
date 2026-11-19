-- Aviso cuando el cliente llena su registro: push al asesor del enlace (o a la oficina si no tiene), una sola vez, solo cuando el
-- enlace pasa a «llenado»; el estado público dice a qué asesor escribirle; y los registros ya llenos antes no quedan «pendientes».
begin;

insert into advisors (id, name, phone, whatsapp) values ('11111111-1111-1111-1111-111111111111', 'Laura Asesora', '8711112222', '8711112222');
insert into client_intake_links (token, type, label, advisor_id) values (repeat('a', 32), 'comprador', 'Ana', '11111111-1111-1111-1111-111111111111');
insert into client_intake_links (token, type) values (repeat('b', 32), 'vendedor');

delete from net.http_calls;

set local role anon;
select set_config('request.jwt.claim.role', 'anon', true), set_config('request.headers', '{"x-forwarded-for":"5.5.5.5"}', true);
do $$
begin
  assert client_intake_status(repeat('a', 32)) ->> 'advisor_id' = '11111111-1111-1111-1111-111111111111', 'el estado público dice a qué asesor escribirle';
  assert (client_intake_status(repeat('b', 32)) -> 'advisor_id') = 'null'::jsonb, 'un enlace de la oficina no trae asesor';
  assert (client_intake_submit(repeat('a', 32), '{"name":"Ana López","phone":"6181234567"}', 'v1') ->> 'ok')::boolean, 'registro de Ana';
  assert (client_intake_submit(repeat('b', 32), '{"name":"Beto Ruiz","phone":"6189999999"}', 'v1') ->> 'ok')::boolean, 'registro de Beto';
end $$;
reset role;

do $$
declare c record;
begin
  assert (select count(*) from net.http_calls where url like '%/functions/v1/enviar-push') = 2, 'un push por registro';

  select * into c from net.http_calls where body ->> 'title' = 'Cliente nuevo: Ana López';
  assert c.id is not null, 'el título lleva el nombre del cliente';
  assert c.body ->> 'advisorId' = '11111111-1111-1111-1111-111111111111', 'va al asesor del enlace';
  assert c.body ->> 'body' = 'Llenó su registro como comprador.', 'dice el tipo';
  assert c.body ->> 'url' = '/admin/clientes?registros=1', 'abre Clientes con el panel';
  assert c.body -> 'section' is null, 'no se manda a toda la oficina';
  assert c.headers ->> 'x-cron-secret' = 'secreto-de-prueba', 'lleva el secreto de las funciones';

  select * into c from net.http_calls where body ->> 'title' = 'Cliente nuevo: Beto Ruiz';
  assert c.body ->> 'section' = 'clientes' and (c.body ->> 'office')::boolean, 'sin asesor va a la oficina con el apartado clientes';
  assert c.body -> 'advisorId' is null, 'sin asesor no hay advisorId';

  assert (select count(*) from client_intake_links where submitted_at is not null and seen_at is null) = 2, 'los registros nuevos quedan pendientes (sin ver)';

  -- Marcarlos como vistos o cambiar otra cosa NO vuelve a avisar.
  update client_intake_links set seen_at = now() where submitted_at is not null;
  update client_intake_links set label = 'otra cosa' where token = repeat('a', 32);
  assert (select count(*) from net.http_calls where url like '%/functions/v1/enviar-push') = 2, 'ni ver ni editar el enlace vuelven a avisar';
end $$;

-- Si el aviso falla (aquí: pg_net sin la función) el cliente se registra igual.
create or replace function net.http_post(url text, body jsonb default '{}'::jsonb, params jsonb default '{}'::jsonb, headers jsonb default '{}'::jsonb, timeout_milliseconds int default 5000)
returns bigint language plpgsql as $$ begin raise exception 'pg_net caído'; end $$;
insert into client_intake_links (token, type) values (repeat('c', 32), 'ambos');
set local role anon;
select set_config('request.jwt.claim.role', 'anon', true), set_config('request.headers', '{"x-forwarded-for":"6.6.6.6"}', true);
do $$
begin
  assert (client_intake_submit(repeat('c', 32), '{"name":"Carla Mora","phone":"6188888888"}', 'v1') ->> 'ok')::boolean, 'el registro funciona aunque el aviso falle';
end $$;
reset role;
do $$
begin
  assert exists (select 1 from clients where name = 'Carla Mora'), 'Carla quedó registrada pese al fallo del push';
end $$;

rollback;
