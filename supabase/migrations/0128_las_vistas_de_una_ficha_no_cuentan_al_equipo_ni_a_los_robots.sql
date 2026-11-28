-- ─────────────────────────────────────────────
-- Las vistas de una ficha no cuentan al equipo ni a los robots (2026-11-26)
-- «N personas la vieron» (y las vistas del informe al vendedor) contaban también a los asesores enseñando la ficha con su sesión
-- iniciada y a los robots que ejecutan JavaScript (Googlebot, vistas previas de WhatsApp o Facebook, Lighthouse, navegadores sin
-- cabeza). Ahora record_property_view no anota la vista si quien llama tiene sesión del panel (rol `authenticated`) o si su
-- User-Agent es de un robot; igual devuelve el conteo, para que la ficha se vea igual.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

create or replace function request_user_agent()
returns text
language plpgsql
stable
as $$
declare
  headers json;
begin
  begin
    headers := nullif(current_setting('request.headers', true), '')::json;
  exception when others then
    return null;
  end;
  return headers ->> 'user-agent';
end;
$$;

create or replace function record_property_view(p_property_id uuid, p_visitor_id uuid, p_days int default 3)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ip text := request_client_ip();
  v_hash text := case when v_ip is null then null else md5('acl-views:' || v_ip) end;
  v_ua text := coalesce(request_user_agent(), '');
  v_counts boolean;
begin
  -- No cuenta: el equipo con sesión del panel y los robots (por su User-Agent).
  v_counts := coalesce(auth.role(), 'anon') <> 'authenticated'
              and v_ua !~* '(bot|crawl|spider|slurp|headless|lighthouse|facebookexternalhit|whatsapp|preview|python-requests|curl/|wget)';

  if v_counts and (v_hash is null
     or (select count(*) from property_views where ip_hash = v_hash and created_at > now() - interval '1 hour') < 40) then
    insert into property_views (property_id, visitor_id, ip_hash)
    values (p_property_id, p_visitor_id, v_hash)
    on conflict (property_id, visitor_id, viewed_on) do nothing;
  end if;

  return (
    select count(distinct visitor_id)
    from property_views
    where property_id = p_property_id
      and viewed_on > current_date - p_days
  );
end;
$$;

revoke all on function request_user_agent() from public;
grant execute on function record_property_view(uuid, uuid, int) to anon, authenticated;
