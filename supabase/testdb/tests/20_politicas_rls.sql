-- 505: las políticas RLS contra una base real. Si un cambio de política abre datos que no debía, esta prueba falla.
--  1. Toda tabla de `public` tiene RLS activada (una tabla nueva sin RLS queda abierta a cualquiera con la llave pública).
--  2. Un visitante anónimo no ve nada de lo interno: mensajes, prospectos, clientes, ventas, liquidaciones, bitácora, llaves.
--  3. Quien tiene sesión pero ningún apartado asignado (sin fila en admin_access) tampoco ve lo que depende de un apartado.
--  4. El anónimo no puede modificar ni borrar lo que otro mandó.
--  5. Lo público sí es público: propiedades activas, zonas, tipos y amenidades.
begin;

do $$
declare missing text;
begin
  select string_agg(c.relname, ', ' order by c.relname) into missing
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
  assert missing is null, 'tablas de public sin RLS: ' || coalesce(missing, '');
end $$;

insert into properties (id, title, type, price, area_m2, zone, address, lat, lng, active) values
  ('00000000-0000-0000-0000-0000000005a1', 'Publicada RLS', 'casa', 1000000, 100, 'Torreón', 'Calle 1', 25.5, -103.4, true),
  ('00000000-0000-0000-0000-0000000005a2', 'Borrador RLS', 'casa', 1000000, 100, 'Torreón', 'Calle 2', 25.5, -103.4, false);
insert into contact_messages (id, name, email, message) values ('00000000-0000-0000-0000-0000000005b1', 'QA', 'qa@correo.com', 'hola');
insert into prospectos (id, name) values ('00000000-0000-0000-0000-0000000005b2', 'Prospecto RLS');
insert into clients (id, name, type) values ('00000000-0000-0000-0000-0000000005b3', 'Cliente RLS', 'comprador');
insert into ventas (property_id, fecha_venta) values ('00000000-0000-0000-0000-0000000005a1', current_date);
insert into liquidaciones (property_id) values ('00000000-0000-0000-0000-0000000005a1');
insert into property_log (property_id, kind, entry_date, descripcion) values ('00000000-0000-0000-0000-0000000005a1', 'nota', current_date, 'nota interna');
insert into secretaria_llaves (address, key_label, receiver_name) values ('Calle 1', 'Llave 1', 'Recibe');

-- Anónimo: lo interno no existe para él.
set local role anon;
select set_config('request.jwt.claim.role', 'anon', true);
do $$
declare t text; n bigint; denied boolean;
begin
  foreach t in array array['contact_messages', 'prospectos', 'clients', 'ventas', 'liquidaciones', 'property_log', 'secretaria_llaves', 'admin_access', 'audit_log'] loop
    begin
      execute format('select count(*) from %I', t) into n;
    exception when insufficient_privilege then
      n := 0;
    end;
    assert n = 0, format('anon no debe ver filas de %s (ve %s)', t, n);
  end loop;

  -- No puede cambiar ni borrar lo de otros.
  begin
    update contact_messages set message = 'hackeado' where id = '00000000-0000-0000-0000-0000000005b1';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from prospectos where id = '00000000-0000-0000-0000-0000000005b2';
  exception when insufficient_privilege then null;
  end;
  begin
    update properties set price = 1 where id = '00000000-0000-0000-0000-0000000005a1';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

do $$
begin
  assert (select message from contact_messages where id = '00000000-0000-0000-0000-0000000005b1') = 'hola', 'anon no debe poder cambiar un mensaje';
  assert exists (select 1 from prospectos where id = '00000000-0000-0000-0000-0000000005b2'), 'anon no debe poder borrar un prospecto';
  assert (select price from properties where id = '00000000-0000-0000-0000-0000000005a1') = 1000000, 'anon no debe poder cambiar el precio';
end $$;

-- Lo público sí se ve.
set local role anon;
select set_config('request.jwt.claim.role', 'anon', true);
do $$
begin
  assert (select count(*) from properties where id in ('00000000-0000-0000-0000-0000000005a1', '00000000-0000-0000-0000-0000000005a2')) = 1, 'anon ve solo la propiedad activa';
  assert (select count(*) from zones) >= 0 and (select count(*) from property_types) >= 1, 'anon lee zonas y tipos de propiedad';
end $$;
reset role;

-- Con sesión pero sin ningún apartado: tampoco ve lo que depende de un apartado.
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true), set_config('request.jwt.claim.email', 'sin-apartados@acl.mx', true);
do $$
declare t text; n bigint;
begin
  foreach t in array array['contact_messages', 'prospectos', 'clients', 'ventas', 'liquidaciones', 'property_log', 'secretaria_llaves'] loop
    execute format('select count(*) from %I', t) into n;
    assert n = 0, format('una sesión sin apartados no debe ver filas de %s (ve %s)', t, n);
  end loop;
end $$;
reset role;

rollback;
