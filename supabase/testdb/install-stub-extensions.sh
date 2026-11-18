#!/usr/bin/env bash
# Crea extensiones «de mentira» pg_cron y pg_net en un Postgres común (necesita permiso de escritura en el directorio de
# extensiones: sudo en CI, root aquí). Cada una solo expone lo que usa schema.sql y deja constancia en cron.job.
set -euo pipefail
SHARE="$(pg_config --sharedir)/extension"

cat > "$SHARE/pg_net.control" <<'CTL'
comment = 'Simulación de pg_net para pruebas'
default_version = '0.0'
relocatable = false
schema = net
CTL
cat > "$SHARE/pg_net--0.0.sql" <<'SQL'
create table net.http_calls (id bigserial primary key, url text, headers jsonb, body jsonb, created_at timestamptz default now());
create function net.http_post(url text, body jsonb default '{}'::jsonb, params jsonb default '{}'::jsonb, headers jsonb default '{}'::jsonb, timeout_milliseconds int default 5000)
returns bigint language sql as $$ insert into net.http_calls (url, headers, body) values (url, headers, body) returning id $$;
SQL

cat > "$SHARE/pg_cron.control" <<'CTL'
comment = 'Simulación de pg_cron para pruebas'
default_version = '0.0'
relocatable = false
schema = cron
CTL
cat > "$SHARE/pg_cron--0.0.sql" <<'SQL'
create table cron.job (jobid bigserial primary key, jobname text unique, schedule text not null, command text not null);
create function cron.schedule(job_name text, schedule text, command text) returns bigint language sql as $$
  insert into cron.job (jobname, schedule, command) values (job_name, schedule, command)
  on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command returning jobid $$;
create function cron.schedule(schedule text, command text) returns bigint language sql as $$
  insert into cron.job (jobname, schedule, command) values (null, schedule, command) returning jobid $$;
create function cron.unschedule(job_name text) returns boolean language sql as $$ delete from cron.job where jobname = job_name returning true $$;
SQL
echo "Extensiones de prueba instaladas en $SHARE"
