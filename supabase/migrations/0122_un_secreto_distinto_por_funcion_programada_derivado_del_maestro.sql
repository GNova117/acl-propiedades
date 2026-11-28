
-- ─────────────────────────────────────────────
-- Un secreto distinto por función programada (2026-11-25)
-- Las 12 funciones de Edge que dispara la base (pg_cron y los triggers vía pg_net) compartían UN secreto en el encabezado
-- `x-cron-secret`: si se filtraba el de una llamada, servía para disparar cualquiera. Ahora cada función recibe el suyo, derivado del
-- secreto maestro (Vault `agenda_cron_secret`, que sigue siendo el mismo CRON_SECRET de las funciones):
--     secreto de la función = HMAC-SHA256(llave = secreto maestro, mensaje = nombre de la función), en hexadecimal.
-- El maestro ya no viaja en ninguna llamada y el de una función no sirve para otra. No hay secretos nuevos que sembrar.
-- · cron_secret_for('<función>') calcula ese valor (solo lo ejecutan los roles internos de la base, nunca el público).
-- · Los trabajos de pg_cron y las funciones de trigger que mandaban el secreto maestro se reescriben para mandar el de su función. Se
--   toma el nombre de la función de la propia URL (`/functions/v1/<nombre>`); lo que no tenga exactamente una, no se toca.
-- · Las funciones de Edge aceptan los dos secretos mientras CRON_ACCEPT_SHARED_SECRET no valga «false» (ver
--   supabase/functions/_shared/cronAuth.js): desplegar primero las funciones, aplicar esta migración y, cuando todo funcione, apagar
--   la transición con `supabase secrets set CRON_ACCEPT_SHARED_SECRET=false`.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

create or replace function cron_secret_for(p_function text)
returns text
language sql
stable
security definer
set search_path = public, extensions
as $$
  select encode(extensions.hmac(convert_to(p_function, 'UTF8'), convert_to(s.decrypted_secret, 'UTF8'), 'sha256'), 'hex')
  from vault.decrypted_secrets s
  where s.name = 'agenda_cron_secret';
$$;

revoke all on function cron_secret_for(text) from public, anon, authenticated;

do $$
declare
  shared constant text := '(select decrypted_secret from vault.decrypted_secrets where name = ''agenda_cron_secret'')';
  f record;
  j record;
  fns text[];
begin
  -- Funciones de trigger (aviso de mensajes, de prospectos sin atender, de visitas, del portal, del registro…).
  for f in
    select p.oid, pg_get_functiondef(p.oid) as def
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f' and p.prosrc like '%agenda_cron_secret%'
  loop
    select array_agg(distinct m[1]) into fns from regexp_matches(f.def, '/functions/v1/([a-z0-9-]+)', 'g') as m;
    if fns is not null and cardinality(fns) = 1 and position(shared in f.def) > 0 then
      execute replace(f.def, shared, format('cron_secret_for(%L)', fns[1]));
    end if;
  end loop;

  -- Trabajos programados de pg_cron.
  for j in select jobname, schedule, command from cron.job where jobname is not null and command like '%agenda_cron_secret%' loop
    select array_agg(distinct m[1]) into fns from regexp_matches(j.command, '/functions/v1/([a-z0-9-]+)', 'g') as m;
    if fns is not null and cardinality(fns) = 1 and position(shared in j.command) > 0 then
      perform cron.schedule(j.jobname, j.schedule, replace(j.command, shared, format('cron_secret_for(%L)', fns[1])));
    end if;
  end loop;
end $$;
