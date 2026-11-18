-- ─────────────────────────────────────────────
-- Datos personales pegados al cliente (2026-10-06)
-- Fecha de nacimiento, estado civil, domicilio, RFC, CURP e identificación
-- oficial — se pedían solo al abrir un perfilamiento (vendedor o
-- comprador); ahora se capturan ya desde el alta/edición del cliente
-- (mismas llaves que perfilamientos/perfilamientos_comprador) para que un
-- perfilamiento nuevo se precargue con ellos sin tener que volver a
-- teclearlos (ver vendedorInitialValues/compradorInitialValues).
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

alter table clients add column if not exists fecha_nacimiento date;
alter table clients add column if not exists estado_civil text check (estado_civil is null or estado_civil in ('Soltero', 'Casado', 'Divorciado', 'Viudo', 'Unión libre'));
alter table clients add column if not exists domicilio text;
alter table clients add column if not exists rfc text check (rfc is null or rfc ~ '^[A-ZÑ&]{4}[0-9]{6}[A-Z0-9]{3}$');
alter table clients add column if not exists curp text check (curp is null or curp ~ '^[A-Z]{4}[0-9]{6}[HM][A-Z]{5}[A-Z0-9]{2}$');
alter table clients add column if not exists identificacion_oficial text;
-- Cifrado de la contraseña del portal de crédito (2026-10)
--
-- Hasta ahora `clients.contrasena_portal` y `perfilamientos_comprador.
-- contrasena_portal` guardaban la contraseña del portal de crédito del
-- comprador (INFONAVIT/FOVISSSTE/banco) en texto plano — ver el riesgo
-- aceptado documentado en README.md. Este bloque la cifra en la columna
-- (pgcrypto + una llave en Supabase Vault, que nunca vive en este archivo
-- ni en el repo) sin cambiar nada del front: la app sigue mandando y
-- recibiendo la contraseña en claro exactamente igual que antes, solo que
-- lo que queda guardado en la tabla ya no es legible sin la llave.
--
-- Qué SÍ resuelve: un volcado de la base (pg_dump, una copia de seguridad,
-- un acceso directo a la tabla que no pase por la app) ya no expone la
-- contraseña real, solo el cifrado. Qué NO resuelve: quien ya puede usar el
-- panel con el apartado 'clientes' (como hoy) sigue viendo la contraseña en
-- claro — ese acceso es intencional, lo pide el negocio para ayudar al
-- cliente a entrar a su portal — y si la llave de Vault también se
-- comprometiera, el cifrado no protege nada. No es un reemplazo de tener
-- Supabase Vault bien resguardado, es una capa más.
--
-- PASO MANUAL, UNA SOLA VEZ, ANTES de correr el resto de este bloque (la
-- llave no se puede traer ya escrita en este archivo: tiene que vivir solo
-- en tu Supabase). En el SQL Editor, con tu propia frase larga y aleatoria:
--   select vault.create_secret('<tu-frase-larga-y-aleatoria>', 'portal_password_key');
-- Si ya existe y quieres rotarla:
--   select vault.update_secret(id, '<frase-nueva>') from vault.secrets where name = 'portal_password_key';
-- (rotar la llave inutiliza lo ya cifrado con la anterior — re-captura esas
-- contraseñas después de rotar, o descífralas con la llave vieja antes).
--
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor,
-- siempre que ya hayas creado el secreto una vez)
-- ─────────────────────────────────────────────

-- Supabase instala las extensiones en el esquema `extensions`, no en
-- `public` — de ahí que las dos funciones de abajo agreguen `extensions` a
-- su search_path, si no `pgp_sym_encrypt`/`pgp_sym_decrypt` no se encuentran.
create extension if not exists pgcrypto with schema extensions;

-- Única forma de leer la llave: una función privada, sin EXECUTE para nadie
-- más que su dueño (mismo patrón que has_admin_section/_visit_report_payload).
create or replace function _portal_password_key()
returns text
language sql
stable
security definer
set search_path = public, vault
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'portal_password_key' limit 1;
$$;
revoke all on function _portal_password_key() from public, anon, authenticated;

-- Prefijo que marca un valor ya cifrado por esta función: permite volver a
-- correr este bloque sin cifrar dos veces, y que el trigger de abajo sepa
-- distinguir "el asesor tecleó una contraseña nueva" de "esto ya es cifrado".
create or replace function _encrypt_portal_password(plain text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  key text := _portal_password_key();
begin
  if plain is null or plain = '' then
    return null;
  end if;
  if left(plain, 6) = 'encv1:' then
    return plain; -- ya viene cifrado (re-ejecución de este bloque sobre una fila ya migrada)
  end if;
  if key is null then
    raise exception 'portal_password_key no está configurada en Vault — ver instrucciones en schema.sql';
  end if;
  return 'encv1:' || encode(pgp_sym_encrypt(plain, key), 'base64');
end;
$$;
revoke all on function _encrypt_portal_password(text) from public, anon, authenticated;

-- Esta sí la llama la app (a través de las vistas de abajo): cualquier
-- autenticado puede invocarla, pero sin una fila real de clients/
-- perfilamientos_comprador (bloqueada por RLS a quien no tenga el apartado
-- 'clientes') no hay ningún cifrado real que pasarle — y por si alguien
-- guardó una copia de un cifrado antes de perder ese apartado, también se
-- revisa aquí adentro, no solo en la vista.
create or replace function _decrypt_portal_password(value text)
returns text
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  key text := _portal_password_key();
begin
  if value is null or value = '' then
    return null;
  end if;
  if not has_admin_section('clientes') then
    raise exception 'No autorizado';
  end if;
  if left(value, 6) <> 'encv1:' then
    return value; -- fila que aún no se migró (no debería pasar después del update de abajo)
  end if;
  if key is null then
    raise exception 'portal_password_key no está configurada en Vault — ver instrucciones en schema.sql';
  end if;
  return pgp_sym_decrypt(decode(substring(value from 7), 'base64'), key);
end;
$$;
revoke all on function _decrypt_portal_password(text) from public, anon;
grant execute on function _decrypt_portal_password(text) to authenticated;

-- Cifra automáticamente al guardar, sin que la app tenga que cambiar nada:
-- sigue mandando la contraseña en claro en el insert/update de siempre.
create or replace function _encrypt_portal_password_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.contrasena_portal := _encrypt_portal_password(new.contrasena_portal);
  return new;
end;
$$;
revoke all on function _encrypt_portal_password_trigger() from public, anon, authenticated;

drop trigger if exists encrypt_contrasena_portal on clients;
create trigger encrypt_contrasena_portal
  before insert or update of contrasena_portal on clients
  for each row execute function _encrypt_portal_password_trigger();

drop trigger if exists encrypt_contrasena_portal on perfilamientos_comprador;
create trigger encrypt_contrasena_portal
  before insert or update of contrasena_portal on perfilamientos_comprador
  for each row execute function _encrypt_portal_password_trigger();

-- Migra lo que ya estaba guardado en texto plano (no toca lo que ya tenga el
-- prefijo, así que correr esto de nuevo no vuelve a cifrar nada dos veces).
update clients
set contrasena_portal = _encrypt_portal_password(contrasena_portal)
where contrasena_portal is not null and left(contrasena_portal, 6) <> 'encv1:';

update perfilamientos_comprador
set contrasena_portal = _encrypt_portal_password(contrasena_portal)
where contrasena_portal is not null and left(contrasena_portal, 6) <> 'encv1:';

-- Vistas de SOLO LECTURA que la app usa en vez de la tabla para traer la
-- contraseña ya descifrada (nunca para guardar — el insert/update sigue
-- yendo a la tabla real, donde el trigger de arriba cifra). `security_invoker
-- = true` es imprescindible: sin esto, Postgres evaluaría el RLS de la vista
-- con los permisos de quien la creó (saltándose has_admin_section('clientes')
-- de la tabla real) en vez de con los de quien realmente consulta.
-- Si se agrega una columna nueva a `clients` o a `perfilamientos_comprador`,
-- hay que agregarla también aquí para que no desaparezca de estas vistas.
create or replace view clients_decrypted
with (security_invoker = true) as
select
  id, name, type, email, phone, notes, active, created_at, updated_at,
  nss, _decrypt_portal_password(contrasena_portal) as contrasena_portal, numero_credito,
  referencia1_nombre, referencia1_telefono, referencia1_correo, referencia1_direccion,
  referencia2_nombre, referencia2_telefono, referencia2_correo, referencia2_direccion,
  razon_social, registro_patronal, tel_empresa
from clients;
grant select on clients_decrypted to authenticated;

create or replace view perfilamientos_comprador_decrypted
with (security_invoker = true) as
select
  id, cliente_id, nombre, nss, telefono,
  _decrypt_portal_password(contrasena_portal) as contrasena_portal,
  fecha_nacimiento, estado_civil, domicilio, correo, curp, rfc,
  registro_patronal, tel_empresa, razon_social,
  referencia1_nombre, referencia1_telefono, referencia1_correo, referencia1_direccion,
  referencia2_nombre, referencia2_telefono, referencia2_correo, referencia2_direccion,
  usuario_creo, fecha_creacion, fecha_modificacion
from perfilamientos_comprador;
grant select on perfilamientos_comprador_decrypted to authenticated;

-- Último paso manual: si tu proyecto no recarga el caché de la API solo,
-- fuerza la recarga para que PostgREST vea las vistas nuevas:
--   select pg_notify('pgrst', 'reload schema');

