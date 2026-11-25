-- ─────────────────────────────────────────────
-- Derechos ARCO: consultar y borrar los datos de una persona (2026-11-25)
-- La ley mexicana (LFPDPPP) da a cada persona el derecho de Acceso, Rectificación, Cancelación y Oposición sobre sus datos. Hasta
-- hoy atender una solicitud era buscar a mano en 6 pantallas. Esta migración deja una herramienta para quien tenga el apartado `arco`
-- (se le da al rol Administrador; a otros roles desde Roles y accesos). La persona se identifica por teléfono (10 dígitos) o por
-- correo completo — nunca por nombre, para no mezclar a dos personas distintas.
--
-- · arco_buscar(consulta, registrar): ACCESO. Junta todo lo que hay de esa persona en mensajes de contacto, prospectos, alertas,
--   apartados, citas, visitas y clientes. Con `registrar = true` deja constancia (sin guardar el dato en claro).
-- · arco_cancelar(consulta, confirmar): CANCELACIÓN. Borra mensajes, prospectos (con sus etapas y contactos) y alertas; en citas,
--   visitas y apartados deja el registro pero quita nombre, teléfono y correo. NO toca a los CLIENTES: sus documentos se conservan
--   3 años por obligación (ver 0123) y se avisan como «retenidos». También quita el nombre del registro de actividad.
-- · arco_requests: constancia de cada solicitud atendida (qué tipo, cuándo, quién y cuántos registros), con la identificación
--   guardada solo como huella SHA-256. Rectificación y Oposición se atienden con las pantallas normales (editar / quitar la alerta).
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

update admin_roles
set sections = array_append(sections, 'arco')
where slug = 'admin' and not ('arco' = any(sections));

create table if not exists arco_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('acceso', 'cancelacion')),
  subject_hash text not null,
  performed_by text,
  result jsonb not null default '{}'::jsonb
);

alter table arco_requests enable row level security;
revoke all on arco_requests from anon, authenticated;
grant select on arco_requests to authenticated;
drop policy if exists "Roles con apartado arco ven las solicitudes" on arco_requests;
create policy "Roles con apartado arco ven las solicitudes" on arco_requests for select to authenticated
  using (has_admin_section('arco'));

-- Una sola identificación: correo completo o teléfono con al menos 10 dígitos (se comparan los últimos 10).
create or replace function arco_parse(p_query text, out o_email text, out o_phone text)
language plpgsql
immutable
as $$
declare
  q text := btrim(coalesce(p_query, ''));
  digits text;
begin
  if q ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    o_email := lower(q);
  else
    digits := regexp_replace(q, '\D', '', 'g');
    if length(digits) >= 10 then
      o_phone := right(digits, 10);
    else
      raise exception 'Escribe el correo completo o el teléfono a 10 dígitos de la persona' using errcode = '22023';
    end if;
  end if;
end;
$$;

-- Condición SQL «esta fila es de esa persona» para una tabla con columnas de correo y/o teléfono.
create or replace function arco_cond(p_ecol text, p_pcol text, p_email text, p_phone text)
returns text
language sql
immutable
as $$
  select coalesce(nullif(concat_ws(' or ',
    case when p_ecol is not null and p_email is not null then format('lower(btrim(%I)) = %L', p_ecol, p_email) end,
    case when p_pcol is not null and p_phone is not null
      then format('right(regexp_replace(coalesce(%I, ''''), ''\D'', '''', ''g''), 10) = %L', p_pcol, p_phone) end
  ), ''), 'false')
$$;

-- Las fuentes de datos personales: tabla, columna de correo, de teléfono, qué hacer al cancelar y, si se anonimiza, qué columnas.
create or replace function arco_sources()
returns table (tbl text, ecol text, pcol text, act text, scrub text)
language sql
immutable
as $$
  select * from (values
    ('agenda_citas',      'contact_email', 'contact_phone', 'scrub',    'contact_name = null, contact_phone = null, contact_email = null'),
    ('property_visits',   null,            'prospect_phone', 'scrub',   'prospect_name = null, prospect_phone = null'),
    ('property_holds',    null,            'buyer_phone',   'scrub',    'buyer_name = ''Anonimizado'', buyer_phone = null'),
    ('contact_messages',  'email',         'phone',         'delete',   null),
    ('prospectos',        'email',         'phone',         'delete',   null),
    ('property_alerts',   'email',         'phone',         'delete',   null),
    ('clients',           'email',         'phone',         'retain',   null)
  ) as s(tbl, ecol, pcol, act, scrub)
$$;

create or replace function arco_guard()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), current_user) not in ('service_role', 'postgres') and not has_admin_section('arco') then
    raise exception 'No tienes acceso a esta herramienta' using errcode = '42501';
  end if;
end;
$$;

create or replace function arco_actor()
returns text
language sql
stable
as $$ select coalesce(nullif(auth.jwt() ->> 'email', ''), current_user) $$;

create or replace function arco_buscar(p_query text, p_registrar boolean default false)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  e text;
  p text;
  s record;
  cond text;
  rows_json jsonb;
  result jsonb := '{}'::jsonb;
  counts jsonb := '{}'::jsonb;
begin
  perform arco_guard();
  select o_email, o_phone into e, p from arco_parse(p_query);

  for s in select * from arco_sources() loop
    cond := arco_cond(s.ecol, s.pcol, e, p);
    if s.tbl = 'agenda_citas' then
      cond := cond
        || format(' or prospecto_id in (select id from prospectos where %s)', arco_cond('email', 'phone', e, p))
        || format(' or message_id in (select id from contact_messages where %s)', arco_cond('email', 'phone', e, p));
    end if;
    -- A los clientes nunca se les exporta la contraseña del portal ni el NSS: son del cliente, no se reparten por esta vía.
    execute format(
      'select coalesce(jsonb_agg(to_jsonb(t) %s), ''[]''::jsonb) from %I t where %s',
      case when s.tbl = 'clients' then '- ''contrasena_portal'' - ''nss''' else '' end, s.tbl, cond
    ) into rows_json;
    result := result || jsonb_build_object(s.tbl, jsonb_build_object('accion', s.act, 'filas', rows_json));
    counts := counts || jsonb_build_object(s.tbl, jsonb_array_length(rows_json));
  end loop;

  if p_registrar then
    insert into arco_requests (kind, subject_hash, performed_by, result)
    values ('acceso', encode(sha256(convert_to(coalesce(e, p), 'utf8')), 'hex'), arco_actor(), counts);
  end if;
  return result;
end;
$$;

create or replace function arco_cancelar(p_query text, p_confirmar boolean default false)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  e text;
  p text;
  s record;
  cond text;
  ids text[];
  counts jsonb := '{}'::jsonb;
begin
  perform arco_guard();
  if p_confirmar is not true then
    raise exception 'Falta confirmar la cancelación' using errcode = '22023';
  end if;
  select o_email, o_phone into e, p from arco_parse(p_query);

  -- Primero lo que cuelga de otras filas (citas), después las filas que se borran, para poder seguir el enlace a su dueño.
  for s in select * from arco_sources() loop
    cond := arco_cond(s.ecol, s.pcol, e, p);
    if s.tbl = 'agenda_citas' then
      cond := cond
        || format(' or prospecto_id in (select id from prospectos where %s)', arco_cond('email', 'phone', e, p))
        || format(' or message_id in (select id from contact_messages where %s)', arco_cond('email', 'phone', e, p));
    end if;

    if s.act = 'delete' then
      execute format('with d as (delete from %I where %s returning id) select coalesce(array_agg(id::text), ''{}'') from d', s.tbl, cond) into ids;
    elsif s.act = 'scrub' then
      execute format('with u as (update %I set %s where %s returning id) select coalesce(array_agg(id::text), ''{}'') from u', s.tbl, s.scrub, cond) into ids;
    else
      execute format('select coalesce(array_agg(id::text), ''{}'') from %I where %s', s.tbl, cond) into ids;
    end if;

    counts := counts || jsonb_build_object(case when s.act = 'retain' then 'retenidos' else s.tbl end, coalesce(array_length(ids, 1), 0));
    -- El registro de actividad guarda el nombre de la persona como etiqueta: se quita de las filas que acabamos de borrar o anonimizar.
    if s.act <> 'retain' and coalesce(array_length(ids, 1), 0) > 0 then
      update audit_log set label = null where table_name = s.tbl and row_id = any(ids);
    end if;
  end loop;

  insert into arco_requests (kind, subject_hash, performed_by, result)
  values ('cancelacion', encode(sha256(convert_to(coalesce(e, p), 'utf8')), 'hex'), arco_actor(), counts);
  return counts;
end;
$$;

revoke execute on function arco_parse(text), arco_cond(text, text, text, text), arco_sources(), arco_guard(), arco_actor() from public, anon, authenticated;
revoke execute on function arco_buscar(text, boolean), arco_cancelar(text, boolean) from public, anon;
grant execute on function arco_buscar(text, boolean), arco_cancelar(text, boolean) to authenticated;
