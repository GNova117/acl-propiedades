-- Enlaces con token: la página pública sabe hasta cuándo sirve cada enlace (expires_at), el informe del vendedor ya no vive para
-- siempre, y el contacto del asesor llega solo a quien tiene un enlace válido (el público no lee esas columnas de la tabla).
begin;

insert into advisors (id, name, phone, email, whatsapp, bio, active, show_in_team) values
  ('00000000-0000-0000-0000-0000000000b1', 'Carlos Delgado', '8711111111', 'carlos@acl.mx', '528711111111', 'Asesor', true, true),
  ('00000000-0000-0000-0000-0000000000b2', 'Ex Asesor', '8712222222', 'ex@acl.mx', '528712222222', 'Se fue', false, true);

insert into properties (id, title, type, price, area_m2, zone, address, lat, lng, active)
values ('00000000-0000-0000-0000-0000000000c1', 'Casa de prueba', 'casa', 1000000, 100, 'Torreón', 'Calle 1', 25.5, -103.4, true);

-- Informe del vendedor: vigente, vencido y desactivado (regenerado = otro token).
insert into property_report_links (property_id, token, expires_at) values ('00000000-0000-0000-0000-0000000000c1', repeat('a', 32), now() + interval '10 days');
insert into properties (id, title, type, price, area_m2, zone, address, lat, lng, active)
values ('00000000-0000-0000-0000-0000000000c2', 'Casa vencida', 'casa', 1000000, 100, 'Torreón', 'Calle 2', 25.5, -103.4, true);
insert into property_report_links (property_id, token, expires_at) values ('00000000-0000-0000-0000-0000000000c2', repeat('b', 32), now() - interval '1 day');

-- Firma, portal, registro y selección
insert into signing_requests (token, title, signer_name, document_b64, doc_sha256, code_hash, expires_at)
values (repeat('c', 64), 'Contrato de prueba', 'Ana', 'JVBERi0=', repeat('0', 64), 'x', now() + interval '3 days');
insert into clients (id, name, type) values ('00000000-0000-0000-0000-0000000000d1', 'Ana López', 'comprador');
insert into client_portal_tokens (client_id, token, expires_at) values ('00000000-0000-0000-0000-0000000000d1', repeat('d', 32), now() + interval '5 days');
insert into client_intake_links (token, type, advisor_id, expires_at) values
  (repeat('e', 32), 'comprador', '00000000-0000-0000-0000-0000000000b1', now() + interval '2 days'),
  (repeat('f', 32), 'comprador', '00000000-0000-0000-0000-0000000000b2', now() + interval '2 days'),
  (repeat('1', 32), 'comprador', null, now() + interval '2 days');
insert into property_selections (token, title, property_ids, advisor_id, expires_at)
values (repeat('2', 32), 'Para Ana', array['00000000-0000-0000-0000-0000000000c1'::uuid], '00000000-0000-0000-0000-0000000000b1', now() - interval '1 day');

set local role anon;
select set_config('request.jwt.claim.role', 'anon', true);

do $$
declare r jsonb;
begin
  -- Informe: vigente responde con su vencimiento; vencido o inexistente no responde.
  r := visit_report_by_token(repeat('a', 32));
  assert r is not null and r ->> 'link_expires_at' is not null, 'el informe vigente trae link_expires_at';
  assert visit_report_by_token(repeat('b', 32)) is null, 'un informe con enlace vencido no responde';
  assert visit_report_by_token(repeat('9', 32)) is null, 'un token inexistente no responde';

  -- Firma, portal y registro dicen hasta cuándo sirven.
  assert signing_info(repeat('c', 64)) ->> 'expires_at' is not null and signing_info(repeat('c', 64)) ->> 'status' = 'pendiente', 'signing_info trae expires_at y conserva el estado';
  r := portal_token_status(repeat('d', 32));
  assert r ->> 'status' = 'activo' and r ->> 'expires_at' is not null, 'el portal vigente trae expires_at';
  r := client_intake_status(repeat('e', 32));
  assert r ->> 'status' = 'activo' and r ->> 'expires_at' is not null, 'el registro vigente trae expires_at';

  -- Contacto del asesor por el enlace de registro: sí con asesor activo; no con uno que ya no está; no sin asesor.
  assert r -> 'advisor' ->> 'whatsapp' = '528711111111' and r -> 'advisor' ->> 'name' = 'Carlos Delgado', 'el registro trae el contacto del asesor que lo mandó';
  assert not (r -> 'advisor' ? 'email'), 'sin el correo del asesor';
  assert client_intake_status(repeat('f', 32)) -> 'advisor' is null or client_intake_status(repeat('f', 32)) ->> 'advisor' is null, 'un asesor inactivo no se muestra';
  assert client_intake_status(repeat('1', 32)) ->> 'advisor' is null, 'sin asesor no hay contacto';

  -- Selección: el contacto llega con el enlace aunque ya haya vencido (para pedir otra); un token inventado no da nada.
  assert selection_advisor(repeat('2', 32)) ->> 'whatsapp' = '528711111111', 'selection_advisor entrega el contacto con un token que existe';
  assert selection_advisor(repeat('3', 32)) is null, 'con un token inventado no entrega nada';
  assert selection_advisor('no-es-token') is null, 'ni con basura';

  -- El público ve los asesores activos pero no sus datos de contacto.
  assert (select count(*) from advisors) = 1, 'solo los asesores activos se leen';
  begin
    perform phone from advisors;
    assert false, 'el público no debe poder leer advisors.phone';
  exception when insufficient_privilege then null;
  end;
  assert (select count(*) from team_advisors()) = 1 and (select whatsapp from team_advisors()) = '528711111111', 'el equipo publicado sí trae su contacto por la función';
end $$;

rollback;
