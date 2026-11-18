-- ─────────────────────────────────────────────
-- Listado y ficha: próximas visitas, reacciones en la selección e interés en línea (2026-11-17)
--
-- Tres piezas independientes (cada una se puede ignorar sin romper las demás):
--
-- 1. «Visítala mañana» en las tarjetas del listado: next_visit_slots() devuelve, de un golpe
--    para varias propiedades, el primer horario libre de cada una (reusa get_visit_slots).
--
-- 2. «Me gusta / no me gusta» y comentario por propiedad en la selección que manda el asesor
--    (/seleccion/<token>): property_selections.reactions (jsonb) + selection_react(). El
--    cliente solo puede reaccionar a las propiedades de SU selección, mientras el enlace
--    esté vigente. selection_open() ahora también devuelve las reacciones.
--
-- 3. Interés en línea en el informe del vendedor: property_events cuenta cuántas personas
--    guardaron la propiedad en favoritos y cuántas veces se compartió (las vistas ya las
--    cuenta property_views); _visit_report_payload() suma el resumen en `interest`. Solo se
--    publican cifras agregadas; las filas crudas (quién y cuándo) no las lee nadie con anon
--    ni authenticated, igual que property_views.
--
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor; necesita que antes
--  estén "Agendar visita con horarios reales", "Selección de propiedades en un solo enlace"
--  y "property_views")
-- ─────────────────────────────────────────────

-- ── 1. Próximo horario libre de varias propiedades ──
-- Como mucho 48 propiedades por llamada y 14 días de horizonte. Una propiedad sin horarios
-- (sin asesor con reserva activa, vendida, inactiva…) simplemente no sale en el resultado.
create or replace function next_visit_slots(p_property_ids uuid[], p_days int default 7)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  pid uuid;
  first_slot jsonb;
  result jsonb := '[]'::jsonb;
begin
  if p_property_ids is null then
    return result;
  end if;
  foreach pid in array p_property_ids[1:48] loop
    continue when pid is null;
    first_slot := (get_visit_slots(pid, null, least(greatest(coalesce(p_days, 7), 1), 14)) -> 'slots') -> 0;
    if first_slot is not null then
      result := result || jsonb_build_array(jsonb_build_object('property_id', pid, 'fecha', first_slot ->> 'fecha', 'hora', first_slot ->> 'hora'));
    end if;
  end loop;
  return result;
end;
$$;

revoke all on function next_visit_slots(uuid[], int) from public;
grant execute on function next_visit_slots(uuid[], int) to anon, authenticated;

-- ── 2. Reacciones del cliente en una selección ──
-- reactions = { "<property_id>": { "r": "like" | "dislike" | null, "c": "comentario" | null, "at": "…" } }
alter table property_selections add column if not exists reactions jsonb not null default '{}'::jsonb;

-- Errores (jsonb {error}): unavailable (enlace inexistente, vencido o desactivado),
-- invalid_property, invalid_reaction, invalid_comment. Sin reacción ni comentario = borra la entrada.
create or replace function selection_react(p_token text, p_property_id uuid, p_reaction text, p_comment text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  s property_selections%rowtype;
  cleaned text := nullif(btrim(coalesce(p_comment, '')), '');
  next_reactions jsonb;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{32}$' then
    return jsonb_build_object('error', 'unavailable');
  end if;
  select * into s from property_selections where token = p_token;
  if not found or s.revoked_at is not null or s.expires_at < now() then
    return jsonb_build_object('error', 'unavailable');
  end if;
  if p_property_id is null or not (p_property_id = any (s.property_ids)) then
    return jsonb_build_object('error', 'invalid_property');
  end if;
  if p_reaction is not null and p_reaction not in ('like', 'dislike') then
    return jsonb_build_object('error', 'invalid_reaction');
  end if;
  if cleaned is not null and char_length(cleaned) > 300 then
    return jsonb_build_object('error', 'invalid_comment');
  end if;

  if p_reaction is null and cleaned is null then
    next_reactions := s.reactions - p_property_id::text;
  else
    next_reactions := jsonb_set(
      s.reactions,
      array[p_property_id::text],
      jsonb_build_object('r', p_reaction, 'c', cleaned, 'at', now())
    );
  end if;
  update property_selections set reactions = next_reactions where id = s.id;
  return jsonb_build_object('ok', true, 'reactions', next_reactions);
end;
$$;

revoke all on function selection_react(text, uuid, text, text) from public;
grant execute on function selection_react(text, uuid, text, text) to anon, authenticated;

-- Misma función de siempre, ahora con las reacciones.
create or replace function selection_open(p_token text, p_track boolean default true)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  s property_selections%rowtype;
  st text;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{32}$' then
    return null;
  end if;

  select * into s from property_selections where token = p_token;
  if not found then
    return null;
  end if;

  st := case
    when s.revoked_at is not null then 'revoked'
    when s.expires_at < now() then 'expired'
    else 'ok'
  end;

  if st = 'ok' and coalesce(p_track, true) then
    update property_selections
    set open_count = open_count + 1,
        first_opened_at = coalesce(first_opened_at, now()),
        last_opened_at = now()
    where id = s.id;
  end if;

  return jsonb_build_object(
    'status', st,
    'title', s.title,
    'note', s.note,
    'advisor_id', s.advisor_id,
    'property_ids', case when st = 'ok' then to_jsonb(s.property_ids) else '[]'::jsonb end,
    'created_at', s.created_at,
    'expires_at', s.expires_at,
    'reactions', case when st = 'ok' then s.reactions else '{}'::jsonb end
  );
end;
$$;

revoke all on function selection_open(text, boolean) from public;
grant execute on function selection_open(text, boolean) to anon, authenticated;

-- ── 3. Interés en línea: favoritos y veces compartida ──
create table if not exists property_events (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  visitor_id uuid not null,
  kind text not null check (kind in ('favorite', 'share')),
  event_on date not null default current_date,
  created_at timestamptz not null default now(),
  unique (property_id, visitor_id, kind, event_on)
);

create index if not exists idx_property_events_property on property_events(property_id, kind);

-- Sin políticas: nadie con anon/authenticated lee ni escribe la tabla directo.
alter table property_events enable row level security;

-- Una vez por visitante, evento y día (recargar o volver a tocar no infla la cifra). Una propiedad
-- que no existe o no está publicada se ignora sin error.
create or replace function track_property_event(p_property_id uuid, p_visitor_id uuid, p_kind text)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if p_kind is null or p_kind not in ('favorite', 'share') or p_visitor_id is null then
    return;
  end if;
  if not exists (select 1 from properties where id = p_property_id and active) then
    return;
  end if;
  insert into property_events (property_id, visitor_id, kind)
  values (p_property_id, p_visitor_id, p_kind)
  on conflict (property_id, visitor_id, kind, event_on) do nothing;
end;
$$;

revoke all on function track_property_event(uuid, uuid, text) from public;
grant execute on function track_property_event(uuid, uuid, text) to anon, authenticated;

-- El informe del vendedor, ahora con `interest`: vistas de la ficha (una por persona y día),
-- personas distintas, personas distintas en los últimos 7 días, personas que la guardaron en
-- favoritos y veces que se compartió. Mismos campos de siempre; solo se agrega ese objeto.
create or replace function _visit_report_payload(p_property_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'property', jsonb_build_object(
      'title', p.title,
      'code', p.code,
      'zone', p.zone,
      'status', p.status,
      'created_at', p.created_at,
      'main_image', p.main_image
    ),
    'sold_on', case when p.status = 'vendida' then (select v.fecha_venta from ventas v where v.property_id = p.id) end,
    'visits', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'visited_at', pv.visited_at,
          'interest', pv.interest,
          'reasons', to_jsonb(pv.reasons),
          'comments', nullif(btrim(pv.comments), '')
        )
        order by pv.visited_at desc
      )
      from property_visits pv
      where pv.property_id = p.id
    ), '[]'::jsonb),
    'interest', jsonb_build_object(
      'views', (select count(*) from property_views pv2 where pv2.property_id = p.id),
      'unique_visitors', (select count(distinct pv2.visitor_id) from property_views pv2 where pv2.property_id = p.id),
      'views_7d', (select count(distinct pv2.visitor_id) from property_views pv2 where pv2.property_id = p.id and pv2.viewed_on > current_date - 7),
      'favorites', (select count(distinct pe.visitor_id) from property_events pe where pe.property_id = p.id and pe.kind = 'favorite'),
      'shares', (select count(*) from property_events pe where pe.property_id = p.id and pe.kind = 'share')
    )
  )
  from properties p
  where p.id = p_property_id;
$$;

