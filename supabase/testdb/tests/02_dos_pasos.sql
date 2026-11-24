-- mfa_ok(): deja pasar a quien no activó 2FA y a quien ya confirmó su código (aal2); frena la sesión solo-contraseña (aal1) de
-- quien sí la activó. Y los dispositivos se registran, se limitan a 20 y se olvidan.
begin;
insert into auth.mfa_factors (user_id, status) values ('11111111-1111-1111-1111-111111111111', 'verified');
set local role authenticated;

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","aal":"aal1"}', true);
do $$ begin assert not mfa_ok(), 'con 2FA activado y solo contraseña (aal1) no debe pasar'; end $$;

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","aal":"aal2"}', true);
do $$ begin assert mfa_ok(), 'con código confirmado (aal2) debe pasar'; end $$;

select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","aal":"aal1"}', true);
do $$ begin assert mfa_ok(), 'quien no activó 2FA no debe quedar fuera'; end $$;

-- dispositivos
do $$
declare i int; kept int; removed int;
begin
  perform touch_admin_device('corto', 'x'); -- identificador demasiado corto: se ignora
  for i in 1..25 loop
    perform touch_admin_device('dispositivo-' || lpad(i::text, 3, '0'), 'Chrome en Windows');
  end loop;
  select count(*) into kept from admin_devices;
  assert kept = 20, 'solo se conservan los 20 dispositivos más recientes, hay ' || kept;
  -- (dentro de una misma transacción todos tienen la misma hora: se toma uno cualquiera de los que quedaron como «este»)
  removed := forget_other_admin_devices((select device_id from admin_devices limit 1));
  assert removed = 19, 'debía olvidar a los otros 19, olvidó ' || removed;
  select count(*) into kept from admin_devices;
  assert kept = 1, 'debía quedar solo este dispositivo';
end $$;
reset role;
rollback;
