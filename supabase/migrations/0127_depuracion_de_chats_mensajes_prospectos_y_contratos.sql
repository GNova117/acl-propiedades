-- ─────────────────────────────────────────────
-- Depuración de datos personales: chats, mensajes, prospectos y contratos (2026-11-26)
-- Reglas del negocio (decididas por el dueño):
--   · chats        1 semana   — chat_rate_limits: lo único que el chat guarda (sesión y huella de la IP; el texto de la conversación no se guarda).
--   · mensajes     1 semana   — contact_messages (los del formulario de contacto, atendidos o no).
--   · prospectos   1 mes      — prospectos, contado desde su ÚLTIMA ACTIVIDAD (alta, edición, contacto, cambio de etapa). Un prospecto con un
--                               seguimiento programado a futuro no vence mientras esa fecha no pase.
--   · contratos    6 meses    — signing_requests (documento enviado a firma, su firma, IP y huella), contados desde lo más reciente entre
--                               que se creó, se firmó o se selló.
-- Cada día corre `depurar_datos()` (pg_cron). Los chats se borran de una vez (es solo bitácora de límites); las otras tres reglas
-- ARRANCAN COMO SIMULACRO: cuentan y registran lo que borrarían, sin borrar. Se activan una por una desde la tarjeta «Depuración de
-- datos» de Roles y accesos (o con datos_activar) cuando se revisó el simulacro.
-- Al borrar se quita también el nombre del registro de actividad (audit_log). Las citas y visitas conservan su historial: para quitar
-- los datos de una persona concreta está la herramienta de Derechos ARCO (0125).
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

create table if not exists retention_rules (
  kind text primary key check (kind in ('chats', 'mensajes', 'prospectos', 'contratos')),
  retention interval not null check (retention >= interval '1 day'),
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by text
);

insert into retention_rules (kind, retention, enabled) values
  ('chats', interval '7 days', true),
  ('mensajes', interval '7 days', false),
  ('prospectos', interval '1 month', false),
  ('contratos', interval '6 months', false)
on conflict (kind) do nothing;

create table if not exists datos_purge_log (
  id uuid primary key default gen_random_uuid(),
  ran_at timestamptz not null default now(),
  kind text not null,
  dry_run boolean not null,
  due integer not null default 0,
  deleted integer not null default 0
);
create index if not exists idx_datos_purge_log_ran on datos_purge_log(ran_at desc);

alter table retention_rules enable row level security;
alter table datos_purge_log enable row level security;
revoke all on retention_rules, datos_purge_log from anon, authenticated;
grant select on retention_rules, datos_purge_log to authenticated;
drop policy if exists "Rol con apartado roles lee retention_rules" on retention_rules;
create policy "Rol con apartado roles lee retention_rules" on retention_rules for select to authenticated using (has_admin_section('roles'));
drop policy if exists "Rol con apartado roles lee datos_purge_log" on datos_purge_log;
create policy "Rol con apartado roles lee datos_purge_log" on datos_purge_log for select to authenticated using (has_admin_section('roles'));

-- Los ids (como texto) de lo que ya cumplió su plazo en cada regla.
create or replace function datos_vencidos(p_kind text)
returns table (id text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r interval;
begin
  select retention into r from retention_rules where kind = p_kind;
  if r is null then return; end if;

  if p_kind = 'chats' then
    return query select c.id::text from chat_rate_limits c where c.created_at < now() - r;
  elsif p_kind = 'mensajes' then
    return query select m.id::text from contact_messages m where m.created_at < now() - r;
  elsif p_kind = 'prospectos' then
    return query
      select p.id::text
      from prospectos p
      where greatest(
              p.created_at, p.updated_at, p.last_contact_at,
              (select max(e.at) from prospecto_etapas e where e.prospecto_id = p.id),
              (select max(k.at) from prospecto_contactos k where k.prospecto_id = p.id)
            ) < now() - r
        and (p.next_followup_at is null or p.next_followup_at < current_date);
  elsif p_kind = 'contratos' then
    return query
      select s.id::text
      from signing_requests s
      where greatest(s.created_at, s.signed_at, s.sealed_at, s.fingerprint_at) < now() - r;
  end if;
end;
$$;

revoke all on function datos_vencidos(text) from public, anon, authenticated;

create or replace function datos_borrar(p_kind text, p_ids text[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer := 0;
  tbl text;
begin
  if coalesce(array_length(p_ids, 1), 0) = 0 then return 0; end if;
  if p_kind = 'chats' then
    delete from chat_rate_limits where id::text = any(p_ids);
    get diagnostics n = row_count;
    return n;
  elsif p_kind = 'mensajes' then
    delete from contact_messages where id::text = any(p_ids);
    tbl := 'contact_messages';
  elsif p_kind = 'prospectos' then
    delete from prospectos where id::text = any(p_ids);
    tbl := 'prospectos';
  elsif p_kind = 'contratos' then
    delete from signing_requests where id::text = any(p_ids);
    tbl := 'signing_requests';
  else
    return 0;
  end if;
  get diagnostics n = row_count;
  -- El registro de actividad guarda el nombre como etiqueta: se quita de lo que se borró.
  update audit_log set label = null where table_name = tbl and row_id = any(p_ids);
  return n;
end;
$$;

revoke all on function datos_borrar(text, text[]) from public, anon, authenticated;

-- La corrida diaria. Solo la service role (o el dueño de la base, desde pg_cron).
create or replace function depurar_datos()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rule retention_rules;
  ids text[];
  due integer;
  deleted integer;
  result jsonb := '{}'::jsonb;
begin
  if coalesce(auth.role(), current_user) not in ('service_role', 'postgres') then
    raise exception 'Sin acceso' using errcode = '42501';
  end if;

  for rule in select * from retention_rules order by kind loop
    select coalesce(array_agg(v.id), '{}') into ids from datos_vencidos(rule.kind) v;
    due := coalesce(array_length(ids, 1), 0);
    deleted := case when rule.enabled then datos_borrar(rule.kind, ids) else 0 end;
    insert into datos_purge_log (kind, dry_run, due, deleted) values (rule.kind, not rule.enabled, due, deleted);
    result := result || jsonb_build_object(rule.kind, jsonb_build_object('due', due, 'deleted', deleted, 'dry_run', not rule.enabled));
  end loop;

  -- La bitácora de corridas no crece sin fin: se queda un año.
  delete from datos_purge_log where ran_at < now() - interval '1 year';
  return result;
end;
$$;

revoke all on function depurar_datos() from public, anon, authenticated;
grant execute on function depurar_datos() to service_role;

-- Resumen para la tarjeta de Roles y accesos.
create or replace function datos_resumen()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  rule retention_rules;
  last_run datos_purge_log;
  due integer;
  result jsonb := '[]'::jsonb;
begin
  if not has_admin_section('roles') then
    raise exception 'Sin acceso' using errcode = '42501';
  end if;
  for rule in select * from retention_rules order by kind loop
    select count(*) into due from datos_vencidos(rule.kind);
    select * into last_run from datos_purge_log where kind = rule.kind order by ran_at desc limit 1;
    result := result || jsonb_build_object(
      'kind', rule.kind,
      'retention', rule.retention::text,
      'enabled', rule.enabled,
      'due', due,
      'last_run', case when last_run.id is null then null else jsonb_build_object(
        'ran_at', last_run.ran_at, 'dry_run', last_run.dry_run, 'due', last_run.due, 'deleted', last_run.deleted) end
    );
  end loop;
  return result;
end;
$$;

revoke all on function datos_resumen() from public, anon;
grant execute on function datos_resumen() to authenticated;

-- Activar o apagar el borrado de una regla (de simulacro a real y de regreso).
create or replace function datos_activar(p_kind text, p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not has_admin_section('roles') then
    raise exception 'Sin acceso' using errcode = '42501';
  end if;
  update retention_rules set enabled = coalesce(p_enabled, false), updated_at = now(), updated_by = coalesce(nullif(auth.jwt() ->> 'email', ''), current_user)
  where kind = p_kind;
  if not found then
    raise exception 'Regla desconocida' using errcode = '22023';
  end if;
end;
$$;

revoke all on function datos_activar(text, boolean) from public, anon;
grant execute on function datos_activar(text, boolean) to authenticated;

-- Corrida diaria (07:30 UTC). Llama directo a la función de la base: no pasa por la red ni necesita secretos.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'depurar-datos') then
    perform cron.unschedule('depurar-datos');
  end if;
  perform cron.schedule('depurar-datos', '30 7 * * *', 'select depurar_datos()');
end $$;
