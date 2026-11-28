-- Papelería de clientes: 3 años desde la última actividad con el cliente. Un cliente con movimiento reciente no vence; uno sin
-- movimiento en 3 años sí; solo la service role y quien tiene Roles pueden ver lo vencido.
begin;

insert into clients (id, name, type, created_at, updated_at) values
  ('00000000-0000-0000-0000-0000000000a1', 'Cliente viejo', 'comprador', now() - interval '4 years', now() - interval '4 years'),
  ('00000000-0000-0000-0000-0000000000a2', 'Cliente reciente', 'comprador', now() - interval '4 years', now() - interval '10 days'),
  ('00000000-0000-0000-0000-0000000000a3', 'Viejo con documento nuevo', 'comprador', now() - interval '4 years', now() - interval '4 years'),
  ('00000000-0000-0000-0000-0000000000a4', 'Viejo con cita reciente', 'comprador', now() - interval '4 years', now() - interval '4 years'),
  ('00000000-0000-0000-0000-0000000000a5', 'Justo antes de los 3 años', 'comprador', now() - interval '2 years 11 months', now() - interval '2 years 11 months'),
  ('00000000-0000-0000-0000-0000000000a6', 'Justo después de los 3 años', 'comprador', now() - interval '3 years 1 month', now() - interval '3 years 1 month');

insert into client_documents (id, client_id, doc_type, file_path, captured_at) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1', 'ine', 'a1/ine.jpg', now() - interval '4 years'),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000a2', 'ine', 'a2/ine.jpg', now() - interval '4 years'),
  ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000a3', 'ine', 'a3/ine.jpg', now() - interval '4 years'),
  ('00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-0000000000a3', 'curp', 'a3/curp.jpg', now() - interval '1 month'),
  ('00000000-0000-0000-0000-0000000000d5', '00000000-0000-0000-0000-0000000000a4', 'ine', 'a4/ine.jpg', now() - interval '4 years'),
  ('00000000-0000-0000-0000-0000000000d6', '00000000-0000-0000-0000-0000000000a5', 'ine', 'a5/ine.jpg', now() - interval '2 years 11 months'),
  ('00000000-0000-0000-0000-0000000000d7', '00000000-0000-0000-0000-0000000000a6', 'ine', 'a6/ine.jpg', now() - interval '3 years 1 month');

insert into advisors (id, name) values ('00000000-0000-0000-0000-0000000000ad', 'Asesor');
insert into agenda_citas (id, titulo, fecha, client_id, advisor_id) values
  ('00000000-0000-0000-0000-0000000000c4', 'Cita reciente', (now() - interval '2 months')::date, '00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-0000000000ad'),
  ('00000000-0000-0000-0000-0000000000c9', 'Avalúo viejo sin cliente', (now() - interval '4 years')::date, null, '00000000-0000-0000-0000-0000000000ad'),
  ('00000000-0000-0000-0000-0000000000ca', 'Avalúo reciente sin cliente', (now() - interval '1 month')::date, null, '00000000-0000-0000-0000-0000000000ad');
insert into agenda_expedientes (id, cita_id, file_path, file_name, created_at) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000c9', 'x/viejo.pdf', 'viejo.pdf', now() - interval '4 years'),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000ca', 'x/nuevo.pdf', 'nuevo.pdf', now() - interval '1 month'),
  ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000c4', 'x/de-cliente-activo.pdf', 'c.pdf', now() - interval '4 years');

do $$
declare ids uuid[];
begin
  assert papeleria_retention() = interval '3 years', 'el plazo es de 3 años';

  select array_agg(id order by id) into ids from papeleria_vencida();
  assert ids = array[
    '00000000-0000-0000-0000-0000000000d1'::uuid,   -- cliente viejo sin movimiento
    '00000000-0000-0000-0000-0000000000d7'::uuid,   -- 3 años y 1 mes sin movimiento
    '00000000-0000-0000-0000-0000000000e1'::uuid    -- avalúo de hace 4 años sin cliente
  ], 'vencidos: ' || coalesce(ids::text, 'ninguno');
  -- No vencen: actividad reciente en el cliente (d2), un documento nuevo (d3, d4), una cita reciente (d5, e3), 2 años 11 meses (d6),
  -- ni el avalúo reciente sin cliente (e2).
end $$;

-- Quién puede verlo: la service role sí; el público y un rol sin Roles, no.
set local role service_role;
do $$ begin
  assert (select count(*) from papeleria_vencida()) = 3, 'la service role ve lo vencido';
end $$;
reset role;

insert into admin_roles (slug, name, sections) values ('t-roles', 'Prueba roles', array['roles']), ('t-nada', 'Prueba nada', array['agenda']);
insert into admin_access (email, role_id) select 'roles@acl.mx', id from admin_roles where slug = 't-roles';
insert into admin_access (email, role_id) select 'nada@acl.mx', id from admin_roles where slug = 't-nada';

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true), set_config('request.jwt.claim.email', 'roles@acl.mx', true);
do $$
declare r jsonb;
begin
  assert (select count(*) from papeleria_vencida()) = 3, 'quien tiene Roles ve lo vencido';
  r := papeleria_resumen();
  assert (r ->> 'documents')::int = 3 and (r ->> 'retention_years')::int = 3 and r -> 'last_run' = 'null'::jsonb, 'el resumen cuenta y aún no hay corridas: ' || r::text;
end $$;
select set_config('request.jwt.claim.email', 'nada@acl.mx', true);
do $$ begin
  begin
    perform * from papeleria_vencida();
    assert false, 'un rol sin Roles no debe ver lo vencido';
  exception when insufficient_privilege then null;
  end;
  begin
    perform papeleria_resumen();
    assert false, 'ni el resumen';
  exception when insufficient_privilege then null;
  end;
end $$;
set local role anon;
select set_config('request.jwt.claim.role', 'anon', true), set_config('request.jwt.claim.email', '', true);
do $$ begin
  begin
    perform * from papeleria_vencida();
    assert false, 'el público no debe ejecutar papeleria_vencida';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- La bitácora solo la lee quien tiene Roles.
insert into retention_purge_log (dry_run, documents_due) values (true, 3);
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true), set_config('request.jwt.claim.email', 'nada@acl.mx', true);
do $$ begin
  assert (select count(*) from retention_purge_log) = 0, 'sin Roles no se lee la bitácora de depuración';
end $$;
select set_config('request.jwt.claim.email', 'roles@acl.mx', true);
do $$ begin
  assert (select count(*) from retention_purge_log) = 1, 'con Roles sí';
  assert (papeleria_resumen() -> 'last_run' ->> 'dry_run')::boolean, 'el resumen muestra la última corrida (simulacro)';
end $$;

rollback;
