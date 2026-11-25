-- Derechos ARCO: encontrar a una persona por teléfono o correo (nunca por nombre), exportar lo que hay de ella, borrarlo
-- sin tocar a los clientes (papelería 3 años) y dejar constancia sin guardar el dato en claro. Solo con el apartado `arco`.
begin;

insert into advisors (id, name) values ('00000000-0000-0000-0000-0000000000ad', 'Asesor');
insert into contact_messages (id, name, email, phone, message) values
  ('00000000-0000-0000-0000-0000000000b1', 'Ana Pérez', 'ana@correo.mx', '871 123 4567', 'Hola'),
  ('00000000-0000-0000-0000-0000000000b2', 'Otra Ana', 'otra@correo.mx', '871 999 0000', 'No es ella');
insert into prospectos (id, name, phone, email, message_id) values
  ('00000000-0000-0000-0000-0000000000f1', 'Ana Pérez', '+52 (871) 123-4567', null, '00000000-0000-0000-0000-0000000000b1'),
  ('00000000-0000-0000-0000-0000000000f2', 'Otra Ana', '8719990000', 'otra@correo.mx', null);
insert into property_alerts (id, kind, name, phone, contact_method, criteria) values
  ('00000000-0000-0000-0000-0000000000a1', 'search', 'Ana', '8711234567', 'whatsapp', '{}'),
  ('00000000-0000-0000-0000-0000000000a2', 'search', 'Otra', '8719990000', 'whatsapp', '{}');
insert into agenda_citas (id, titulo, fecha, advisor_id, contact_name, contact_phone, contact_email) values
  ('00000000-0000-0000-0000-0000000000c1', 'Visita de Ana', current_date, '00000000-0000-0000-0000-0000000000ad', 'Ana Pérez', '8711234567', 'ana@correo.mx'),
  ('00000000-0000-0000-0000-0000000000c2', 'Visita de otra', current_date, '00000000-0000-0000-0000-0000000000ad', 'Otra Ana', '8719990000', null);
insert into clients (id, name, type, phone, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'Ana Pérez', 'comprador', '8711234567', 'ana@correo.mx');

insert into admin_roles (slug, name, sections) values ('t-arco', 'Prueba ARCO', array['arco']), ('t-nada', 'Prueba nada', array['agenda']);
insert into admin_access (email, role_id) select 'arco@acl.mx', id from admin_roles where slug = 't-arco';
insert into admin_access (email, role_id) select 'nada@acl.mx', id from admin_roles where slug = 't-nada';

-- Sin el apartado, nada.
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true), set_config('request.jwt.claim.email', 'nada@acl.mx', true);
do $$ begin
  begin perform arco_buscar('8711234567'); assert false, 'sin apartado no se busca'; exception when insufficient_privilege then null; end;
  begin perform arco_cancelar('8711234567', true); assert false, 'sin apartado no se borra'; exception when insufficient_privilege then null; end;
end $$;
set local role anon;
select set_config('request.jwt.claim.role', 'anon', true), set_config('request.jwt.claim.email', '', true);
do $$ begin
  begin perform arco_buscar('8711234567'); assert false, 'el público no ejecuta ARCO'; exception when insufficient_privilege then null; end;
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true), set_config('request.jwt.claim.email', 'arco@acl.mx', true);
do $$
declare r jsonb;
begin
  -- Solo por correo completo o teléfono: un nombre o un teléfono corto se rechaza.
  begin perform arco_buscar('Ana Pérez'); assert false, 'no se busca por nombre'; exception when invalid_parameter_value then null; end;
  begin perform arco_buscar('12345'); assert false, 'ni con un teléfono corto'; exception when invalid_parameter_value then null; end;

  -- Acceso por teléfono (con otro formato y lada): halla a Ana en todas partes y no a la otra persona.
  r := arco_buscar('+52 871-123-4567');
  assert jsonb_array_length(r -> 'contact_messages' -> 'filas') = 1, 'su mensaje: ' || r::text;
  assert jsonb_array_length(r -> 'prospectos' -> 'filas') = 1, 'su prospecto';
  assert jsonb_array_length(r -> 'property_alerts' -> 'filas') = 1, 'su alerta';
  assert jsonb_array_length(r -> 'agenda_citas' -> 'filas') = 1, 'su cita';
  assert jsonb_array_length(r -> 'clients' -> 'filas') = 1, 'su ficha de cliente';
  assert r -> 'clients' ->> 'accion' = 'retain' and r -> 'contact_messages' ->> 'accion' = 'delete', 'dice qué se haría con cada cosa';
  assert not ((r -> 'clients' -> 'filas' -> 0) ? 'contrasena_portal') and not ((r -> 'clients' -> 'filas' -> 0) ? 'nss'), 'no se exportan la contraseña ni el NSS';

  -- Acceso por correo: halla lo que tiene ese correo (mensaje, cita, cliente) y, por la cita, nada de la otra persona.
  r := arco_buscar('  ANA@correo.mx ');
  assert jsonb_array_length(r -> 'contact_messages' -> 'filas') = 1 and jsonb_array_length(r -> 'agenda_citas' -> 'filas') >= 1, 'por correo';
  assert jsonb_array_length(r -> 'property_alerts' -> 'filas') = 0, 'la alerta solo tiene teléfono';

  -- Solo registrar (acceso) deja constancia; buscar a secas no.
  assert (select count(*) from arco_requests) = 0, 'buscar sin registrar no deja constancia';
  perform arco_buscar('8711234567', true);
  assert (select count(*) from arco_requests where kind = 'acceso') = 1, 'registrar sí';

  -- Cancelar pide confirmación.
  begin perform arco_cancelar('8711234567'); assert false, 'sin confirmar no se borra'; exception when invalid_parameter_value then null; end;
end $$;
reset role;

-- El registro de actividad guarda el nombre; lo ponemos como lo dejan los disparadores y comprobamos que se limpie.
update audit_log set label = 'Ana Pérez' where table_name = 'contact_messages' and row_id = '00000000-0000-0000-0000-0000000000b1';
insert into audit_log (actor, table_name, action, row_id, label) values ('x', 'prospectos', 'DELETE', '00000000-0000-0000-0000-0000000000f1', 'Ana Pérez');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true), set_config('request.jwt.claim.email', 'arco@acl.mx', true);
do $$
declare r jsonb;
begin
  r := arco_cancelar('871 123 4567', true);
  assert (r ->> 'contact_messages')::int = 1 and (r ->> 'prospectos')::int = 1 and (r ->> 'property_alerts')::int = 1, 'se borró lo suyo: ' || r::text;
  assert (r ->> 'agenda_citas')::int >= 1, 'su cita se anonimizó';
  assert (r ->> 'retenidos')::int = 1, 'su ficha de cliente se avisa como retenida';
end $$;
reset role;

do $$
begin
  -- Lo suyo ya no está…
  assert not exists (select 1 from contact_messages where id = '00000000-0000-0000-0000-0000000000b1'), 'mensaje borrado';
  assert not exists (select 1 from prospectos where id = '00000000-0000-0000-0000-0000000000f1'), 'prospecto borrado';
  assert not exists (select 1 from property_alerts where id = '00000000-0000-0000-0000-0000000000a1'), 'alerta borrada';
  -- …la cita queda (es del negocio) pero sin datos de la persona…
  assert exists (select 1 from agenda_citas where id = '00000000-0000-0000-0000-0000000000c1' and contact_name is null and contact_phone is null and contact_email is null), 'cita anonimizada';
  -- …el cliente se conserva (papelería de 3 años)…
  assert exists (select 1 from clients where id = '00000000-0000-0000-0000-0000000000d1'), 'el cliente se conserva';
  -- …y lo de la otra persona no se tocó.
  assert exists (select 1 from contact_messages where id = '00000000-0000-0000-0000-0000000000b2'), 'el mensaje de otra persona sigue';
  assert exists (select 1 from prospectos where id = '00000000-0000-0000-0000-0000000000f2'), 'el prospecto de otra persona sigue';
  assert exists (select 1 from property_alerts where id = '00000000-0000-0000-0000-0000000000a2'), 'la alerta de otra persona sigue';
  assert exists (select 1 from agenda_citas where id = '00000000-0000-0000-0000-0000000000c2' and contact_name = 'Otra Ana'), 'la cita de otra persona sigue';
  -- El nombre sale del registro de actividad.
  assert not exists (select 1 from audit_log where label = 'Ana Pérez' and table_name in ('contact_messages', 'prospectos')), 'el nombre se quita del registro de actividad';
  -- La constancia no guarda el dato en claro.
  assert (select count(*) from arco_requests where kind = 'cancelacion') = 1, 'constancia de la cancelación';
  assert not exists (select 1 from arco_requests where subject_hash like '%8711234567%' or result::text like '%871%'), 'la constancia no lleva el teléfono';
  assert (select subject_hash from arco_requests where kind = 'cancelacion') ~ '^[0-9a-f]{64}$', 'solo la huella';
end $$;

rollback;
