
-- ─────────────────────────────────────────────
-- La papelería de los clientes dura 3 años (2026-11-25)
-- Regla del negocio: los documentos de un cliente (INE, CURP, comprobantes, constancia fiscal, acta, expedientes de avalúo) se
-- conservan 3 años y después se depuran. Los 3 años se cuentan desde la ÚLTIMA ACTIVIDAD con ese cliente: lo más reciente entre
-- que se dio de alta o se editó, el último documento capturado, el último movimiento de su trámite y su última cita en la Agenda.
-- Mientras haya actividad la papelería no vence; un cliente que lleva 3 años sin movimiento sí.
-- · papeleria_retention(): el plazo (3 años) en un solo lugar.
-- · papeleria_vencida(): los documentos que ya cumplieron el plazo (solo la service role y quien tiene el apartado Roles).
-- · papeleria_resumen(): cuántos hay y qué pasó en la última corrida (para la tarjeta de Roles y accesos).
-- · retention_purge_log: bitácora de cada corrida de la depuración.
-- · La función de Edge `depurar-papeleria` corre el día 1 de cada mes (pg_cron). POR OMISIÓN ES UN SIMULACRO: solo cuenta y registra lo
--   que borraría. Borra de verdad únicamente con `supabase secrets set RETENTION_PURGE_ENABLED=true`.
-- No se borra nada más que archivos y filas de documentos; el cliente, sus ventas y su historial no se tocan.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

create or replace function papeleria_retention()
returns interval
language sql
immutable
as $$ select interval '3 years' $$;

create table if not exists retention_purge_log (
  id uuid primary key default gen_random_uuid(),
  ran_at timestamptz not null default now(),
  dry_run boolean not null,
  documents_due integer not null default 0,
  documents_deleted integer not null default 0,
  files_failed integer not null default 0,
  detail jsonb
);

alter table retention_purge_log enable row level security;

drop policy if exists "Rol con apartado roles lee retention_purge_log" on retention_purge_log;
create policy "Rol con apartado roles lee retention_purge_log" on retention_purge_log for select
  using (has_admin_section('roles'));

-- Última actividad con un cliente.
create or replace function _client_last_activity(p_client_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select greatest(
    c.created_at,
    c.updated_at,
    (select max(d.captured_at) from client_documents d where d.client_id = c.id),
    (select t.updated_at from client_tramites t where t.client_id = c.id),
    (select max(a.fecha)::timestamptz from agenda_citas a where a.client_id = c.id)
  )
  from clients c
  where c.id = p_client_id;
$$;

revoke all on function _client_last_activity(uuid) from public, anon, authenticated;

create or replace function papeleria_vencida()
returns table (kind text, id uuid, client_id uuid, bucket text, file_path text, last_activity timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), current_user) not in ('service_role', 'postgres') and not has_admin_section('roles') then
    raise exception 'Sin acceso' using errcode = '42501';
  end if;

  return query
  select 'documento'::text, d.id, d.client_id, 'client-documents'::text, d.file_path, _client_last_activity(d.client_id)
  from client_documents d
  where _client_last_activity(d.client_id) < now() - papeleria_retention()
  union all
  -- Expedientes de avalúo de la Agenda: con cliente, cuenta su actividad; sin cliente, la fecha de la cita (o de la subida).
  select 'expediente'::text, e.id, a.client_id, 'agenda-expedientes'::text, e.file_path,
         case when a.client_id is not null then greatest(_client_last_activity(a.client_id), a.fecha::timestamptz) else greatest(e.created_at, a.fecha::timestamptz) end
  from agenda_expedientes e
  join agenda_citas a on a.id = e.cita_id
  where case when a.client_id is not null then greatest(_client_last_activity(a.client_id), a.fecha::timestamptz) else greatest(e.created_at, a.fecha::timestamptz) end
        < now() - papeleria_retention();
end;
$$;

revoke all on function papeleria_vencida() from public, anon;
grant execute on function papeleria_vencida() to authenticated, service_role;

create or replace function papeleria_resumen()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  due record;
  last_run retention_purge_log;
begin
  if not has_admin_section('roles') then
    raise exception 'Sin acceso' using errcode = '42501';
  end if;
  select count(*) as documents, count(distinct v.client_id) as clients, min(v.last_activity) as oldest into due from papeleria_vencida() v;
  select * into last_run from retention_purge_log order by ran_at desc limit 1;
  return jsonb_build_object(
    'retention_years', 3,
    'documents', due.documents,
    'clients', due.clients,
    'oldest_activity', due.oldest,
    'last_run', case when last_run.id is null then null else jsonb_build_object(
      'ran_at', last_run.ran_at, 'dry_run', last_run.dry_run, 'documents_due', last_run.documents_due,
      'documents_deleted', last_run.documents_deleted, 'files_failed', last_run.files_failed) end
  );
end;
$$;

revoke all on function papeleria_resumen() from public, anon;
grant execute on function papeleria_resumen() to authenticated;

-- Corrida mensual (día 1, 09:00 UTC). El secreto es el de SU función (migración 0122).
select cron.schedule(
  'depurar-papeleria',
  '0 9 1 * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/depurar-papeleria',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key'),
      'x-cron-secret', cron_secret_for('depurar-papeleria')
    ),
    body := '{}'::jsonb
  );
  $$
);
