-- Depuración: chats y mensajes 1 semana, prospectos 1 mes (desde su última actividad, sin tocar los que tienen seguimiento a futuro),
-- contratos 6 meses. Solo los chats se borran de entrada; el resto es simulacro hasta activarlo. Solo la service role corre la depuración.
begin;

insert into chat_rate_limits (session_id, created_at, ip_hash) values
  (gen_random_uuid(), now() - interval '8 days', 'a'), (gen_random_uuid(), now() - interval '2 days', 'b');

insert into contact_messages (id, name, email, phone, message, created_at) values
  ('00000000-0000-0000-0000-0000000000b1', 'Mensaje viejo', 'v@x.mx', '8711111111', 'hola', now() - interval '8 days'),
  ('00000000-0000-0000-0000-0000000000b2', 'Mensaje reciente', 'r@x.mx', '8712222222', 'hola', now() - interval '2 days');

insert into prospectos (id, name, phone, created_at, updated_at, last_contact_at, next_followup_at) values
  ('00000000-0000-0000-0000-0000000000f1', 'Viejo sin movimiento', '8713333333', now() - interval '40 days', now() - interval '40 days', null, null),
  ('00000000-0000-0000-0000-0000000000f2', 'Viejo pero contactado ayer', '8714444444', now() - interval '40 days', now() - interval '40 days', now() - interval '1 day', null),
  ('00000000-0000-0000-0000-0000000000f3', 'Viejo con seguimiento a futuro', '8715555555', now() - interval '40 days', now() - interval '40 days', null, current_date + 5),
  ('00000000-0000-0000-0000-0000000000f4', 'Nuevo', '8716666666', now() - interval '3 days', now() - interval '3 days', null, null),
  ('00000000-0000-0000-0000-0000000000f5', 'Viejo con etapa reciente', '8717777777', now() - interval '40 days', now() - interval '40 days', null, null);
update prospectos set updated_at = now() - interval '40 days', created_at = now() - interval '40 days' where id = '00000000-0000-0000-0000-0000000000f5';
insert into prospecto_etapas (prospecto_id, stage, at) values ('00000000-0000-0000-0000-0000000000f5', 'contactado', now() - interval '2 days');

insert into signing_requests (id, title, signer_name, document_b64, doc_sha256, code_hash, status, created_at) values
  ('00000000-0000-0000-0000-0000000000c1', 'Contrato viejo', 'Ana', 'AA==', 'x', 'x', 'pendiente', now() - interval '7 months'),
  ('00000000-0000-0000-0000-0000000000c2', 'Contrato reciente', 'Beto', 'AA==', 'x', 'x', 'pendiente', now() - interval '2 months');
insert into signing_requests (id, title, signer_name, document_b64, doc_sha256, code_hash, status, created_at, signed_at, signature_b64) values
  ('00000000-0000-0000-0000-0000000000c3', 'Viejo pero firmado hace poco', 'Carla', 'AA==', 'x', 'x', 'firmado', now() - interval '8 months', now() - interval '1 month', 'AA==');

do $$
declare ids text[];
begin
  select array_agg(id order by id) into ids from datos_vencidos('chats');
  assert array_length(ids, 1) = 1, 'un chat de 8 días vence, el de 2 no';
  select array_agg(id) into ids from datos_vencidos('mensajes');
  assert ids = array['00000000-0000-0000-0000-0000000000b1'], 'solo el mensaje de 8 días: ' || coalesce(ids::text, 'ninguno');
  select array_agg(id) into ids from datos_vencidos('prospectos');
  assert ids = array['00000000-0000-0000-0000-0000000000f1'], 'solo el viejo sin movimiento (no el contactado, ni el de seguimiento a futuro, ni el de etapa reciente): ' || coalesce(ids::text, 'ninguno');
  select array_agg(id) into ids from datos_vencidos('contratos');
  assert ids = array['00000000-0000-0000-0000-0000000000c1'], 'solo el contrato sin firmar de 7 meses: ' || coalesce(ids::text, 'ninguno');
end $$;

-- Quién puede correrlo: solo la service role.
set local role anon;
do $$ begin
  begin perform depurar_datos(); assert false, 'el público no corre la depuración'; exception when insufficient_privilege then null; end;
end $$;
reset role;
insert into admin_roles (slug, name, sections) values ('t-roles', 'Prueba roles', array['roles']), ('t-nada', 'Prueba nada', array['agenda']);
insert into admin_access (email, role_id) select 'roles@acl.mx', id from admin_roles where slug = 't-roles';
insert into admin_access (email, role_id) select 'nada@acl.mx', id from admin_roles where slug = 't-nada';
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true), set_config('request.jwt.claim.email', 'roles@acl.mx', true);
do $$ begin
  begin perform depurar_datos(); assert false, 'ni siquiera quien tiene Roles corre la depuración'; exception when insufficient_privilege then null; end;
  assert (select count(*) from jsonb_array_elements(datos_resumen())) = 4, 'el resumen trae las 4 reglas';
  assert (select (e ->> 'due')::int from jsonb_array_elements(datos_resumen()) e where e ->> 'kind' = 'prospectos') = 1, 'cuenta lo vencido';
end $$;
select set_config('request.jwt.claim.email', 'nada@acl.mx', true);
do $$ begin
  begin perform datos_resumen(); assert false, 'sin Roles no se ve el resumen'; exception when insufficient_privilege then null; end;
  begin perform datos_activar('mensajes', true); assert false, 'ni se activa'; exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Primera corrida: borra los chats, las otras reglas son simulacro.
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true), set_config('request.jwt.claim.email', '', true);
do $$
declare r jsonb;
begin
  r := depurar_datos();
  assert (r -> 'chats' ->> 'deleted')::int = 1 and (r -> 'chats' ->> 'dry_run')::boolean = false, 'los chats se borran: ' || r::text;
  assert (r -> 'mensajes' ->> 'due')::int = 1 and (r -> 'mensajes' ->> 'deleted')::int = 0 and (r -> 'mensajes' ->> 'dry_run')::boolean, 'mensajes en simulacro: ' || r::text;
  assert (r -> 'prospectos' ->> 'deleted')::int = 0 and (r -> 'contratos' ->> 'deleted')::int = 0, 'prospectos y contratos en simulacro';
end $$;
reset role;
do $$ begin
  assert (select count(*) from chat_rate_limits) = 1, 'queda el chat reciente';
  assert (select count(*) from contact_messages) = 2 and (select count(*) from prospectos) = 5 and (select count(*) from signing_requests) = 3, 'nada más se borró';
end $$;

-- Se activan las tres reglas (con Roles) y se vuelve a correr.
insert into audit_log (actor, table_name, action, row_id, label) values ('x', 'prospectos', 'UPDATE', '00000000-0000-0000-0000-0000000000f1', 'Viejo sin movimiento');
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true), set_config('request.jwt.claim.email', 'roles@acl.mx', true);
select datos_activar('mensajes', true), datos_activar('prospectos', true), datos_activar('contratos', true);
do $$ begin
  begin perform datos_activar('inventada', true); assert false, 'una regla desconocida se rechaza'; exception when invalid_parameter_value then null; end;
end $$;
reset role;
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true), set_config('request.jwt.claim.email', '', true);
select depurar_datos();
reset role;
do $$ begin
  assert not exists (select 1 from contact_messages where id = '00000000-0000-0000-0000-0000000000b1') and exists (select 1 from contact_messages where id = '00000000-0000-0000-0000-0000000000b2'), 'mensajes: se fue el viejo';
  assert (select array_agg(id::text order by id) from prospectos) = array['00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-0000000000f5'], 'prospectos: solo se fue el viejo sin movimiento';
  assert (select array_agg(id::text order by id) from signing_requests) = array['00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c3'], 'contratos: solo se fue el de 7 meses';
  assert not exists (select 1 from audit_log where label = 'Viejo sin movimiento'), 'el nombre sale del registro de actividad';
  assert (select count(*) from datos_purge_log where dry_run = false and deleted > 0) >= 3, 'quedó constancia de lo borrado';
  assert exists (select 1 from cron.job where jobname = 'depurar-datos'), 'hay corrida diaria';
end $$;

rollback;
