-- report_user_problem: el equipo con sesión reporta un problema; queda en client_errors con su correo como etiqueta, no se
-- agrupa, tiene mínimo de texto, tope por hora y no lo puede usar un visitante anónimo.
begin;
set local role authenticated;
select set_config('request.jwt.claim.email', 'ana@correo.mx', true), set_config('request.jwt.claim.role', 'authenticated', true);
select report_user_problem('No me carga la agenda de hoy', '/admin/agenda', 'UA de prueba', 'r1');

do $$
declare i int; blocked boolean := false; tooShort boolean := false;
begin
  begin
    perform report_user_problem('corto');
  exception when sqlstate '22023' then
    tooShort := true;
  end;
  assert tooShort, 'un texto de menos de 10 caracteres debía rechazarse';

  -- el primero ya está; con 9 más llegan a 10 (el tope por hora)
  for i in 2..10 loop
    perform report_user_problem('Reporte número ' || i || ' de prueba');
  end loop;
  begin
    perform report_user_problem('Uno más de lo permitido');
  exception when sqlstate '54429' then
    blocked := true;
  end;
  assert blocked, 'el reporte 11 en una hora debía frenarse (54429)';
end $$;
reset role;

do $$
begin
  assert (select count(*) from client_errors where source = 'usuario' and reported_by = 'ana@correo.mx') = 10, 'deben quedar 10 reportes de ana';
  assert (select count(distinct fingerprint) from client_errors where source = 'usuario') = 10, 'cada reporte es independiente (no se agrupan)';
  assert (select message from client_errors where url = '/admin/agenda' and source = 'usuario') = 'No me carga la agenda de hoy', 'el texto se guarda tal cual';
  assert (select count(*) from client_errors where source = 'usuario' and status = 'nuevo' and notified_at is null) = 10, 'entran como nuevos y pendientes de aviso';
end $$;

-- Otra persona tiene su propio tope.
set local role authenticated;
select set_config('request.jwt.claim.email', 'luis@correo.mx', true);
select report_user_problem('Primer reporte de otra persona');

-- Un visitante anónimo no puede.
reset role;
set local role anon;
select set_config('request.jwt.claim.role', 'anon', true), set_config('request.jwt.claim.email', '', true);
do $$
declare denied boolean := false;
begin
  begin
    perform report_user_problem('Intento sin haber iniciado sesión');
  exception when insufficient_privilege then
    denied := true;
  end;
  assert denied, 'un anónimo no debe poder reportar';
end $$;
reset role;
rollback;
