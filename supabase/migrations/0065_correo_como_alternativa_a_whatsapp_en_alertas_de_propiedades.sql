-- ─────────────────────────────────────────────
-- Correo como alternativa a WhatsApp en alertas de propiedades (2026-10-01):
-- quien pide que le avisen de propiedades nuevas o bajas de precio puede
-- elegir recibirlo por correo en vez de WhatsApp. `contact_method` dice cuál
-- de los dos se usa; phone pasa a ser opcional (antes era obligatorio) y se
-- agrega email, con una constraint que exige el campo que corresponda según
-- el método — así nunca queda una alerta sin forma real de avisar. Lo manda
-- la misma Edge Function alertas-propiedades (ahora con rama de correo vía
-- Resend, variable RESEND_API_KEY) en la misma corrida de cada hora.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

alter table property_alerts add column if not exists contact_method text not null default 'whatsapp' check (contact_method in ('whatsapp', 'email'));
alter table property_alerts add column if not exists email text;
alter table property_alerts alter column phone drop not null;

alter table property_alerts drop constraint if exists property_alerts_contact_valid;
alter table property_alerts add constraint property_alerts_contact_valid check (
  (contact_method = 'whatsapp' and phone is not null) or (contact_method = 'email' and email is not null)
);

create index if not exists idx_property_alerts_email on property_alerts(email);

drop function if exists alert_subscribe(text, text, text, jsonb, uuid);

-- Público: suscribirse. Devuelve { ok } o { error }: bad_kind, bad_contact_method,
-- name_required, bad_phone, bad_email, bad_criteria, property_unavailable, limit.
-- Repetir la misma alerta no crea otra ({ ok, duplicate }).
create or replace function alert_subscribe(
  p_kind text, p_name text, p_phone text, p_criteria jsonb, p_property_id uuid,
  p_contact_method text default 'whatsapp', p_email text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_phone text;
  v_email text;
  v_method text := coalesce(p_contact_method, 'whatsapp');
  p properties;
  crit jsonb := coalesce(p_criteria, '{}'::jsonb);
  existing uuid;
begin
  if p_kind not in ('search', 'price') then
    return jsonb_build_object('error', 'bad_kind');
  end if;
  if v_method not in ('whatsapp', 'email') then
    return jsonb_build_object('error', 'bad_contact_method');
  end if;
  if coalesce(trim(p_name), '') = '' or length(p_name) > 80 then
    return jsonb_build_object('error', 'name_required');
  end if;

  if v_method = 'whatsapp' then
    if length(digits) = 10 then
      v_phone := '52' || digits;
    elsif length(digits) = 12 and left(digits, 2) = '52' then
      v_phone := digits;
    elsif length(digits) = 13 and left(digits, 3) = '521' then
      v_phone := '52' || right(digits, 10);
    else
      return jsonb_build_object('error', 'bad_phone');
    end if;
  else
    v_email := lower(trim(coalesce(p_email, '')));
    if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' or length(v_email) > 180 then
      return jsonb_build_object('error', 'bad_email');
    end if;
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
      where active and kind = 'price' and contact_method = v_method
        and (case when v_method = 'whatsapp' then phone = v_phone else email = v_email end)
        and property_id = p.id limit 1;
  else
    select id into existing from property_alerts
      where active and kind = 'search' and contact_method = v_method
        and (case when v_method = 'whatsapp' then phone = v_phone else email = v_email end)
        and criteria = crit limit 1;
  end if;

  if existing is not null then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;

  if (
    select count(*) from property_alerts
    where active and contact_method = v_method
      and (case when v_method = 'whatsapp' then phone = v_phone else email = v_email end)
  ) >= 5 then
    return jsonb_build_object('error', 'limit');
  end if;

  insert into property_alerts (kind, name, phone, email, contact_method, criteria, property_id, price_at_subscribe)
  values (p_kind, trim(p_name), v_phone, v_email, v_method, crit, case when p_kind = 'price' then p.id end, case when p_kind = 'price' then p.price end);
  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function alert_subscribe(text, text, text, jsonb, uuid, text, text) from public;
grant execute on function alert_subscribe(text, text, text, jsonb, uuid, text, text) to anon, authenticated;

