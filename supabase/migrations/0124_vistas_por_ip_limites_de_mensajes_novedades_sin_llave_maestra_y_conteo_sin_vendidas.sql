
-- ─────────────────────────────────────────────
-- Vistas por IP, límites de tamaño en mensajes, novedades sin la llave maestra y conteos sin vendidas (2026-11-26)
-- · record_property_view contaba cualquier visitor_id inventado: con un script se inflaba el «N personas la vieron» y las vistas del
--   informe al vendedor. Ahora cada vista nueva guarda la huella de la IP (sin la IP) y una misma IP no puede sumar más de 40 vistas
--   nuevas por hora. Lo que pase del tope simplemente no se anota (la ficha sigue funcionando y devuelve el conteo).
-- · contact_messages aceptaba nombre, mensaje y `details` de cualquier tamaño y un `channel` cualquiera de quien llamara a la API: un bot
--   podía guardar megabytes por envío. Límites: nombre 200, correo 254, teléfono 40, mensaje 5,000 caracteres, `details` 16 KB y channel
--   en minúsculas/guion bajo de hasta 30. Es NOT VALID a propósito: vale para lo que se escriba de ahora en adelante, no revisa lo viejo.
-- · El flujo de GitHub «Novedades» guardaba la llave service_role (acceso total a la base) solo para insertar una fila. Ahora llama a
--   registrar_novedad(token, …), que solo inserta en site_updates y solo con el secreto `novedades_token` de Vault (ver
--   .github/workflows/log-site-update.yml). Una filtración de ese token ya no abre la base: lo máximo es escribir una novedad.
-- · public_type_counts (conteos del inicio y del menú) contaba también las propiedades vendidas como si estuvieran a la venta.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

-- ── Vistas por IP ──
alter table property_views add column if not exists ip_hash text;
create index if not exists idx_property_views_ip on property_views(ip_hash, created_at desc);

create or replace function record_property_view(p_property_id uuid, p_visitor_id uuid, p_days int default 3)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ip text := request_client_ip();
  v_hash text := case when v_ip is null then null else md5('acl-views:' || v_ip) end;
begin
  if v_hash is null
     or (select count(*) from property_views where ip_hash = v_hash and created_at > now() - interval '1 hour') < 40 then
    insert into property_views (property_id, visitor_id, ip_hash)
    values (p_property_id, p_visitor_id, v_hash)
    on conflict (property_id, visitor_id, viewed_on) do nothing;
  end if;

  return (
    select count(distinct visitor_id)
    from property_views
    where property_id = p_property_id
      and viewed_on > current_date - p_days
  );
end;
$$;

revoke all on function record_property_view(uuid, uuid, int) from public;
grant execute on function record_property_view(uuid, uuid, int) to anon, authenticated;

-- ── Límites de tamaño en contact_messages ──
alter table contact_messages drop constraint if exists contact_messages_limits;
alter table contact_messages add constraint contact_messages_limits check (
  char_length(name) <= 200
  and char_length(email) <= 254
  and char_length(coalesce(phone, '')) <= 40
  and char_length(message) <= 5000
  and (details is null or pg_column_size(details) <= 16384)
  and channel ~ '^[a-z_]{1,30}$'
) not valid;

-- ── Novedades sin la llave maestra ──
-- Para activarlo: guardar en Vault un secreto largo y aleatorio llamado `novedades_token` (select vault.create_secret('<token>', 'novedades_token');)
-- y poner el mismo valor en el secreto NOVEDADES_TOKEN del repositorio de GitHub.
create or replace function registrar_novedad(p_token text, p_title text, p_body text, p_author text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  expected text;
begin
  select decrypted_secret into expected from vault.decrypted_secrets where name = 'novedades_token';
  if expected is null or length(expected) < 20 or p_token is null or p_token <> expected then
    return jsonb_build_object('error', 'unauthorized');
  end if;
  if nullif(trim(coalesce(p_title, '')), '') is null or nullif(trim(coalesce(p_body, '')), '') is null then
    return jsonb_build_object('error', 'invalid');
  end if;
  insert into site_updates (title, body, created_by)
  values (left(trim(p_title), 300), left(trim(p_body), 10000), left(nullif(trim(coalesce(p_author, '')), ''), 100));
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function registrar_novedad(text, text, text, text) from public;
grant execute on function registrar_novedad(text, text, text, text) to anon, authenticated;

-- ── Conteos del inicio y del menú sin las vendidas ──
create or replace function public_type_counts()
returns jsonb
language sql
stable
as $$
  select coalesce(jsonb_object_agg(type, n), '{}'::jsonb)
  from (select type, count(*)::int as n from properties where active and status <> 'vendida' group by type) t;
$$;

revoke all on function public_type_counts() from public;
grant execute on function public_type_counts() to anon, authenticated;
