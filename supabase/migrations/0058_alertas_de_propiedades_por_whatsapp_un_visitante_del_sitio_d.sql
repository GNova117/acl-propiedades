-- ─────────────────────────────────────────────
-- Alertas de propiedades por WhatsApp (2026-09-28): un visitante del sitio deja
-- su nombre y su WhatsApp para (a) recibir un aviso cuando se publique una
-- propiedad que coincida con su búsqueda ('search') o (b) cuando baje de precio
-- una propiedad que le interesó ('price'). Los avisos los manda la Edge Function
-- supabase/functions/alertas-propiedades (cada hora, solo de 8 am a 8 pm hora de
-- México), con la plantilla de WhatsApp "alerta_propiedad".
--
-- Cómo se protege:
-- · La tabla está cerrada al público: se suscribe SOLO con alert_subscribe(), que
--   valida el teléfono, limita a 5 alertas activas por número y no duplica.
-- · Cada aviso lleva un enlace para darse de baja (/alertas/baja/<token>); el token
--   tiene 128 bits. alert_unsubscribe() solo apaga esa alerta.
-- · El personal con el apartado 'prospectos' ve las alertas, las apaga y las borra;
--   no puede cambiar teléfono ni criterios.
-- property_alert_deliveries registra qué se avisó de qué propiedad, para no repetir.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

create table if not exists property_alerts (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('search', 'price')),
  name text not null,
  phone text not null, -- formato WhatsApp: 52 + 10 dígitos
  criteria jsonb not null default '{}'::jsonb, -- búsqueda: filtros del listado
  property_id uuid references properties(id) on delete cascade, -- solo 'price'
  price_at_subscribe numeric, -- solo 'price': precio al suscribirse
  active boolean not null default true,
  unsubscribe_token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now(),
  last_notified_at timestamptz,
  constraint property_alerts_price_needs_property check (kind <> 'price' or (property_id is not null and price_at_subscribe is not null))
);

create index if not exists idx_property_alerts_active on property_alerts(active, kind);
create index if not exists idx_property_alerts_phone on property_alerts(phone);

create table if not exists property_alert_deliveries (
  id bigint generated always as identity primary key,
  alert_id uuid not null references property_alerts(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  kind text not null,
  price numeric,
  sent_at timestamptz not null default now()
);

create index if not exists idx_property_alert_deliveries_alert on property_alert_deliveries(alert_id, property_id);

alter table property_alerts enable row level security;
alter table property_alert_deliveries enable row level security;

drop policy if exists "Rol con apartado prospectos ve alertas" on property_alerts;
create policy "Rol con apartado prospectos ve alertas" on property_alerts for select
  using (has_admin_section('prospectos'));

drop policy if exists "Rol con apartado prospectos edita alertas" on property_alerts;
create policy "Rol con apartado prospectos edita alertas" on property_alerts for update
  using (has_admin_section('prospectos')) with check (has_admin_section('prospectos'));

drop policy if exists "Rol con apartado prospectos borra alertas" on property_alerts;
create policy "Rol con apartado prospectos borra alertas" on property_alerts for delete
  using (has_admin_section('prospectos'));

drop policy if exists "Rol con apartado prospectos ve envios de alertas" on property_alert_deliveries;
create policy "Rol con apartado prospectos ve envios de alertas" on property_alert_deliveries for select
  using (has_admin_section('prospectos'));

-- Sin insert directo: las alertas se crean solo con alert_subscribe(). El personal
-- solo puede apagar/prender una alerta (no cambiar teléfono, criterios ni token).
revoke insert, truncate on property_alerts from anon, authenticated;
revoke update on property_alerts from anon, authenticated;
revoke delete on property_alerts from anon;
grant update (active) on property_alerts to authenticated;
revoke insert, update, delete, truncate on property_alert_deliveries from anon, authenticated;

-- Público: suscribirse. Devuelve { ok } o { error }: bad_kind, name_required,
-- bad_phone, bad_criteria, property_unavailable, limit. Repetir la misma alerta
-- no crea otra ({ ok, duplicate }).
create or replace function alert_subscribe(p_kind text, p_name text, p_phone text, p_criteria jsonb, p_property_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_phone text;
  p properties;
  crit jsonb := coalesce(p_criteria, '{}'::jsonb);
  existing uuid;
begin
  if p_kind not in ('search', 'price') then
    return jsonb_build_object('error', 'bad_kind');
  end if;
  if coalesce(trim(p_name), '') = '' or length(p_name) > 80 then
    return jsonb_build_object('error', 'name_required');
  end if;

  if length(digits) = 10 then
    v_phone := '52' || digits;
  elsif length(digits) = 12 and left(digits, 2) = '52' then
    v_phone := digits;
  elsif length(digits) = 13 and left(digits, 3) = '521' then
    v_phone := '52' || right(digits, 10);
  else
    return jsonb_build_object('error', 'bad_phone');
  end if;

  if jsonb_typeof(crit) <> 'object' or length(crit::text) > 1500 then
    return jsonb_build_object('error', 'bad_criteria');
  end if;

  if p_kind = 'price' then
    select * into p from properties where id = p_property_id and active and status = 'disponible';
    if not found then
      return jsonb_build_object('error', 'property_unavailable');
    end if;
    crit := '{}'::jsonb;
    select id into existing from property_alerts
      where active and kind = 'price' and phone = v_phone and property_id = p.id limit 1;
  else
    select id into existing from property_alerts
      where active and kind = 'search' and phone = v_phone and criteria = crit limit 1;
  end if;

  if existing is not null then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;

  if (select count(*) from property_alerts where active and phone = v_phone) >= 5 then
    return jsonb_build_object('error', 'limit');
  end if;

  insert into property_alerts (kind, name, phone, criteria, property_id, price_at_subscribe)
  values (p_kind, trim(p_name), v_phone, crit, case when p_kind = 'price' then p.id end, case when p_kind = 'price' then p.price end);
  return jsonb_build_object('ok', true);
end;
$$;

-- Público: darse de baja con el token del aviso.
create or replace function alert_unsubscribe(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  found_id uuid;
begin
  update property_alerts set active = false where unsubscribe_token = p_token returning id into found_id;
  if found_id is null then
    return jsonb_build_object('error', 'not_found');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function alert_subscribe(text, text, text, jsonb, uuid) from public;
revoke execute on function alert_unsubscribe(text) from public;
grant execute on function alert_subscribe(text, text, text, jsonb, uuid) to anon, authenticated;
grant execute on function alert_unsubscribe(text) to anon, authenticated;

-- Quedan en el registro de actividad (solo nombres de columna).
do $$
begin
  if to_regclass('public.property_alerts') is not null and to_regprocedure('public.audit_row_change()') is not null then
    drop trigger if exists trg_audit_row_change on property_alerts;
    create trigger trg_audit_row_change after insert or update or delete on property_alerts
      for each row execute function audit_row_change();
  end if;
end;
$$;

-- Envío de las alertas: cada hora (la función solo manda de 8 am a 8 pm hora de
-- México) revisa qué avisos tocan y los manda por WhatsApp. Mismas credenciales
-- (Vault) y secretos que los avisos de Agenda. Variable opcional de la función:
-- SITE_URL (por omisión https://acl-propiedades.com), para armar los enlaces.
-- Requiere crear y aprobar en Meta Business Manager la plantilla de WhatsApp
-- "alerta_propiedad" (idioma es_MX), con 4 variables con nombre: nombre, aviso,
-- enlace y enlace_baja. Texto sugerido:
--   Hola {{nombre}}, {{aviso}} Míralo aquí: {{enlace}}. Si ya no quieres recibir
--   estos avisos, entra a: {{enlace_baja}}
-- La persona pidió los avisos ella misma en el sitio (consentimiento), y cada uno
-- trae su enlace de baja. Meta puede clasificar la plantilla como Marketing.
select cron.schedule(
  'alertas-propiedades',
  '0 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/alertas-propiedades',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key'),
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'agenda_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);

