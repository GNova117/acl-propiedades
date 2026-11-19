-- report_client_error: ignora lo mal formado, agrupa por huella, reabre lo resuelto y avisa de nuevo.
begin;
set local role anon;
select set_config('request.jwt.claim.role', 'anon', true), set_config('request.headers', '{"x-forwarded-for":"7.7.7.7"}', true);
select report_client_error('abcdef12', 'Boom', 'at x', '/visita/:token', 'UA', 'r1', 'react');
select report_client_error('abcdef12', 'Boom', 'at x', '/otra', 'UA', 'r2', 'react');
select report_client_error('NOHEX', 'mala huella');
select report_client_error('abcdef13', '   ');
select report_client_error('abcdef14', 'Otro', 's', null, null, null, 'raro');
reset role;

do $$
declare e client_errors;
begin
  assert (select count(*) from client_errors) = 2, 'solo 2 errores válidos (la huella mala y el mensaje vacío se ignoran)';
  select * into e from client_errors where fingerprint = 'abcdef12';
  assert e.count = 2 and e.url = '/otra' and e.release = 'r2', 'el mismo error se agrupa y cuenta';
  assert (select source from client_errors where fingerprint = 'abcdef14') = 'window', 'un origen raro cae en window';

  update client_errors set status = 'resuelto', notified_at = now() where fingerprint = 'abcdef12';
  perform report_client_error('abcdef12', 'Boom', 'at x', '/otra', 'UA', 'r3', 'react');
  select * into e from client_errors where fingerprint = 'abcdef12';
  assert e.status = 'nuevo' and e.notified_at is null and e.count = 3, 'un error resuelto que reaparece vuelve a ser nuevo y pendiente de aviso';
end $$;
rollback;
