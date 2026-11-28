-- Un secreto por función programada: derivado por HMAC del secreto maestro, distinto en cada función, y ninguna función de trigger
-- ni trabajo de pg_cron manda ya el secreto maestro tal cual.
begin;

do $$
declare
  master text;
  a text;
  b text;
  leftover int;
  j record;
begin
  select decrypted_secret into master from vault.decrypted_secrets where name = 'agenda_cron_secret';

  -- Valor esperado: HMAC-SHA256(llave = maestro, mensaje = nombre) en hexadecimal (mismo cálculo que supabase/functions/_shared/cronAuth.js).
  a := cron_secret_for('enviar-push');
  b := cron_secret_for('visita-correo');
  assert a = encode(extensions.hmac('enviar-push'::bytea, master::bytea, 'sha256'), 'hex'), 'cron_secret_for es el HMAC del nombre con el maestro';
  assert a <> b and a <> master and length(a) = 64, 'cada función tiene su secreto y ninguno es el maestro';

  -- Nada manda ya el maestro tal cual.
  select count(*) into leftover from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind = 'f' and p.proname <> 'cron_secret_for' and p.prosrc like '%agenda_cron_secret%';
  assert leftover = 0, 'quedan ' || leftover || ' funciones que mandan el secreto maestro';
  assert not exists (select 1 from cron.job where command like '%agenda_cron_secret%'), 'quedan trabajos de pg_cron que mandan el secreto maestro';

  -- Cada trabajo y cada función de trigger usa el secreto de SU función (el de la URL a la que llama).
  for j in select jobname, command from cron.job where command like '%/functions/v1/%' loop
    assert j.command like '%cron_secret_for(''' || (regexp_match(j.command, '/functions/v1/([a-z0-9-]+)'))[1] || ''')%', 'el trabajo ' || j.jobname || ' usa el secreto de su función';
  end loop;
  assert (select count(*) from cron.job where command like '%cron_secret_for(%') = 10, 'los 10 trabajos que llaman a una función de Edge usan secretos por función (el de prospectos sin atender llama a una función SQL, ya reescrita)';
  assert (select prosrc from pg_proc where proname = 'notify_visit_email') like '%cron_secret_for(''visita-correo'')%', 'notify_visit_email usa el secreto de visita-correo';
  assert (select prosrc from pg_proc where proname = 'notify_new_contact_message') like '%cron_secret_for(''mensaje-contacto-whatsapp'')%', 'notify_new_contact_message usa el de mensaje-contacto-whatsapp';
  assert (select prosrc from pg_proc where proname = 'notify_client_stage') like '%cron_secret_for(''portal-avisos'')%', 'notify_client_stage usa el de portal-avisos';
  assert (select prosrc from pg_proc where proname = 'notify_client_intake_submitted') like '%cron_secret_for(''enviar-push'')%', 'notify_client_intake_submitted usa el de enviar-push';
end $$;

-- El público no puede pedir los secretos derivados.
set local role anon;
do $$ begin
  begin
    perform cron_secret_for('enviar-push');
    assert false, 'anon no debe poder ejecutar cron_secret_for';
  exception when insufficient_privilege then null;
  end;
end $$;

rollback;
