-- Lectura pública mínima: el público solo ve propiedades activas; el personal con sesión ve todas; los límites por IP del chat y el
-- registro de correos existen; las cubetas públicas solo aceptan imágenes.
begin;

insert into properties (id, title, type, price, area_m2, zone, address, lat, lng, active) values
  ('00000000-0000-0000-0000-0000000000e1', 'Publicada', 'casa', 1000000, 100, 'Torreón', 'Calle 1', 25.5, -103.4, true),
  ('00000000-0000-0000-0000-0000000000e2', 'Borrador', 'casa', 1000000, 100, 'Torreón', 'Calle 2', 25.5, -103.4, false);
insert into advisors (id, name, active) values ('00000000-0000-0000-0000-0000000000f1', 'Asesor', true);
insert into property_advisors (property_id, advisor_id) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000f1'),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000f1');

set local role anon;
select set_config('request.jwt.claim.role', 'anon', true);
do $$ begin
  assert (select count(*) from properties where id in ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000e2')) = 1, 'el público solo ve la propiedad activa';
  assert (select title from properties where id = '00000000-0000-0000-0000-0000000000e2') is null, 'el borrador no se entrega por id';
  assert (select count(*) from property_advisors) = 1, 'la relación con asesores solo de propiedades publicadas';
end $$;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true), set_config('request.jwt.claim.email', 'staff@acl.mx', true);
do $$ begin
  assert (select count(*) from properties where id in ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000e2')) = 2, 'el personal con sesión ve también los borradores';
  assert (select count(*) from advisors) >= 1, 'el personal lee la tabla de asesores completa';
  perform phone from advisors;
end $$;
reset role;

do $$
declare mimes text[];
begin
  assert exists (select 1 from information_schema.columns where table_name = 'chat_rate_limits' and column_name = 'ip_hash'), 'chat_rate_limits tiene ip_hash';
  assert exists (select 1 from information_schema.tables where table_name = 'email_send_log'), 'existe el registro de correos';
  assert (select relrowsecurity from pg_class where relname = 'email_send_log'), 'email_send_log tiene RLS (sin políticas: solo la service role)';
  assert (select file_size_limit from storage.buckets where id = 'property-images') = 15728640, 'property-images con tope de 15 MB';
  select allowed_mime_types into mimes from storage.buckets where id = 'property-images';
  assert 'image/jpeg' = any (mimes) and not ('application/pdf' = any (mimes)), 'property-images solo imágenes';
  assert (select file_size_limit from storage.buckets where id = 'property-360') = 31457280, 'property-360 con tope de 30 MB';
end $$;

rollback;
