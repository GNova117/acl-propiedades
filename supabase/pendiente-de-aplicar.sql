-- ─────────────────────────────────────────────
-- SQL PENDIENTE DE APLICAR en Supabase (todo lo nuevo desde la última versión de «main»).
-- Pégalo COMPLETO en el SQL Editor (Project → SQL Editor → New query) y ejecútalo UNA vez. Es re-ejecutable: si algo se
-- corta a medias, puedes volver a correrlo completo sin dañar nada.
-- Contiene, en este orden: Listado y ficha (próximas visitas, reacciones, interés) · Avisos por correo al cliente del portal ·
-- Encuesta tras la visita · Ofertas y apartados + calendario de la Agenda · Contratos, comisiones y fusión de prospectos ·
-- Freno de envíos públicos · Verificación en dos pasos y dispositivos · Monitoreo de errores · Tiempo real · Conteo por tipo.
-- Se generó con: git diff de supabase/schema.sql contra main (ver docs/migraciones-y-pruebas-de-sql.md).
-- ─────────────────────────────────────────────
-- ---------------------------------------------------------------------------
-- Plano en la ficha (2026-11)
-- ---------------------------------------------------------------------------
-- Imagen del plano de la propiedad que se muestra en la ficha pública. Se
-- publica desde Construcción («Publicar en la ficha») o se sube desde el
-- formulario de la propiedad. Vive en el bucket público `property-images`
-- (mismas políticas de subida que las fotos). Re-ejecutable.
alter table properties add column if not exists floor_plan_url text;

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

-- ─────────────────────────────────────────────
-- Avisos por correo al cliente del portal (2026-11-17)
--
-- Dos avisos automáticos para el cliente que tiene portal (/documentos/<token>):
--  · «Tu trámite avanzó»: cuando el asesor cambia la etapa del trámite, un trigger llama a la Edge
--    Function portal-avisos (pg_net), que le manda el correo.
--  · Recordatorios de documentos pendientes: pg_cron llama a esa misma función una vez al día
--    (10:30 hora de México); manda a lo más 3 recordatorios, uno cada 7 días como máximo, y solo si
--    todavía le falta algo por subir o corregir.
--
-- Son OPT-IN por cliente: el asesor los activa con «Avisar por correo» en el trámite del cliente
-- (client_tramites.notify_client, apagado por omisión), y solo se manda a quien tiene correo y un
-- enlace de portal vigente. Cada aviso se «reclama» en la base antes de enviarse (las funciones
-- portal_claim_*), así que dos corridas o un reintento nunca lo duplican.
--
-- Despliegue (en este orden):
--   1. Correr este bloque (re-ejecutable).
--   2. Desplegar la función:  supabase functions deploy portal-avisos --no-verify-jwt
--      (valida con su propio x-cron-secret, igual que visita-correo). Usa los secretos que ya existen:
--      CRON_SECRET, RESEND_API_KEY y, si los tienes, RESEND_FROM y SITE_URL.
--   3. Necesita los secretos de Vault que ya usan las demás funciones: project_url, publishable_key y
--      agenda_cron_secret.
-- (bloque re-ejecutable: cron.schedule con un nombre que ya existe actualiza ese job; necesita antes
--  el bloque «Portal del cliente: más documentos, lista de pendientes y estatus del trámite»)
-- ─────────────────────────────────────────────

alter table client_tramites add column if not exists notify_client boolean not null default false;
alter table client_tramites add column if not exists last_reminder_at timestamptz;
alter table client_tramites add column if not exists reminder_count integer not null default 0;
alter table client_tramites add column if not exists last_notified_stage text;

-- Los recordatorios empiezan de cero al activar los avisos, y al cambiar de etapa se espera una semana
-- (el cliente acaba de recibir el aviso de la etapa nueva).
create or replace function client_tramite_reset_reminders()
returns trigger
language plpgsql
as $$
begin
  if new.notify_client and not old.notify_client then
    new.reminder_count := 0;
    new.last_reminder_at := null;
  elsif new.stage is distinct from old.stage then
    new.reminder_count := 0;
    new.last_reminder_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_client_tramite_reset_reminders on client_tramites;
create trigger trg_client_tramite_reset_reminders
before update on client_tramites
for each row execute function client_tramite_reset_reminders();

-- Cambio de etapa con avisos activados → portal-avisos (si no se puede encolar, el cambio de etapa se
-- guarda igual: solo se pierde el aviso).
create or replace function notify_client_stage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not new.notify_client or new.stage is not distinct from old.stage then
    return new;
  end if;
  begin
    perform net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/portal-avisos',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key'),
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'agenda_cron_secret')
      ),
      body := jsonb_build_object('kind', 'etapa', 'client_id', new.client_id)
    );
  exception when others then
    raise warning 'notify_client_stage: no se pudo encolar el aviso del cliente %: %', new.client_id, sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists trg_client_tramite_notify on client_tramites;
create trigger trg_client_tramite_notify
after update of stage on client_tramites
for each row execute function notify_client_stage();

-- «Reclamos»: solo los usa la Edge Function (service_role); nadie más puede llamarlos.
-- Aviso de etapa: true si esta llamada lo reclamó (esa etapa aún no se había avisado).
create or replace function portal_claim_stage_notice(p_client_id uuid, p_stage text)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  changed integer;
begin
  update client_tramites
  set last_notified_stage = p_stage
  where client_id = p_client_id and notify_client and stage = p_stage and last_notified_stage is distinct from p_stage;
  get diagnostics changed = row_count;
  return changed > 0;
end;
$$;

-- Recordatorio: { claimed, prev_at, prev_count }. No se reclama con avisos apagados, con el máximo ya
-- mandado ni antes de que pasen p_min_days desde el último. prev_* sirven para liberarlo si falla el envío.
create or replace function portal_claim_reminder(p_client_id uuid, p_min_days integer default 7, p_max integer default 3)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  prev record;
begin
  select last_reminder_at, reminder_count into prev
  from client_tramites
  where client_id = p_client_id and notify_client
  for update;
  if not found
     or prev.reminder_count >= p_max
     or (prev.last_reminder_at is not null and prev.last_reminder_at > now() - make_interval(days => p_min_days)) then
    return jsonb_build_object('claimed', false);
  end if;
  update client_tramites set last_reminder_at = now(), reminder_count = reminder_count + 1 where client_id = p_client_id;
  return jsonb_build_object('claimed', true, 'prev_at', prev.last_reminder_at, 'prev_count', prev.reminder_count);
end;
$$;

create or replace function portal_release_reminder(p_client_id uuid, p_prev_at timestamptz, p_prev_count integer)
returns void
language sql
volatile
security definer
set search_path = public
as $$
  update client_tramites set last_reminder_at = p_prev_at, reminder_count = coalesce(p_prev_count, 0) where client_id = p_client_id;
$$;

revoke all on function portal_claim_stage_notice(uuid, text) from public, anon, authenticated;
revoke all on function portal_claim_reminder(uuid, integer, integer) from public, anon, authenticated;
revoke all on function portal_release_reminder(uuid, timestamptz, integer) from public, anon, authenticated;
grant execute on function portal_claim_stage_notice(uuid, text) to service_role;
grant execute on function portal_claim_reminder(uuid, integer, integer) to service_role;
grant execute on function portal_release_reminder(uuid, timestamptz, integer) to service_role;

-- Recordatorios: una vez al día a las 10:30 hora de México (16:30 UTC; México ya no cambia de horario).
select cron.schedule(
  'portal-recordatorios',
  '30 16 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/portal-avisos',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key'),
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'agenda_cron_secret')
    ),
    body := jsonb_build_object('kind', 'recordatorios')
  );
  $$
);

-- ─────────────────────────────────────────────
-- Encuesta tras la visita y vendidas recientes con sus días (2026-11-17)
--
-- 1. «Vendidas recientemente» del inicio: public_sales_stats() ahora devuelve también `recent_sold`
--    ([{ property_id, days }]) para mostrar «Vendida en N días». Mismas reglas que el promedio: una venta
--    registrada el mismo día del alta (o antes) lleva days = null, nunca «0 días».
--
-- 2. Encuesta tras la visita: cuando el asesor marca «Realizada» una visita reservada desde el sitio (con
--    correo), el trigger de correo manda «¿Cómo te fue?» (visita-correo, kind 'encuesta') con el enlace
--    /opinion/<booking_token>. El cliente califica de 1 a 5 y puede dejar un comentario (máx. 500); una sola
--    respuesta por visita. get_visit_survey() y submit_visit_feedback() son públicas y se guían por el
--    mismo token de la visita; las respuestas (visit_feedback) solo las leen el asesor de esa visita y la
--    oficina (RLS). El correo se «reclama» (visit_claim_survey, solo service_role): marcar «Realizada» más de
--    una vez no lo manda otra vez.
--
-- Despliegue: correr este bloque (re-ejecutable) y volver a desplegar la función visita-correo
--   (supabase functions deploy visita-correo --no-verify-jwt). Sin eso, todo sigue como antes.
-- (bloque re-ejecutable: necesita antes "Agendar visita con horarios reales")
-- ─────────────────────────────────────────────

-- ── 1. Vendidas recientes con sus días ──
create or replace function public_sales_stats() returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'total', count(*),
    'last_12_months', count(*) filter (where v.fecha_venta >= current_date - 365),
    'avg_days_to_sell', round(avg(v.fecha_venta - p.created_at::date) filter (where v.fecha_venta - p.created_at::date > 0)),
    'recent_sold', coalesce((
      select jsonb_agg(jsonb_build_object('property_id', r.property_id, 'days', case when r.days > 0 then r.days end) order by r.fecha_venta desc)
      from (
        select v3.property_id, v3.fecha_venta, (v3.fecha_venta - p3.created_at::date) as days
        from ventas v3
        join properties p3 on p3.id = v3.property_id
        where p3.active
        order by v3.fecha_venta desc
        limit 6
      ) r
    ), '[]'::jsonb),
    'recent_property_ids', coalesce((
      select jsonb_agg(r.property_id)
      from (
        select v2.property_id
        from ventas v2
        join properties p2 on p2.id = v2.property_id
        where p2.active
        order by v2.fecha_venta desc
        limit 6
      ) r
    ), '[]'::jsonb)
  )
  from ventas v
  join properties p on p.id = v.property_id;
$$;

revoke all on function public_sales_stats() from public;
grant execute on function public_sales_stats() to anon, authenticated;

-- ── 2. Encuesta tras la visita ──
alter table agenda_citas add column if not exists survey_sent_at timestamptz;

create table if not exists visit_feedback (
  id uuid primary key default gen_random_uuid(),
  cita_id uuid not null unique references agenda_citas(id) on delete cascade,
  property_id uuid references properties(id) on delete set null,
  advisor_id uuid references advisors(id) on delete set null,
  rating smallint not null check (rating between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 500),
  created_at timestamptz not null default now()
);

create index if not exists idx_visit_feedback_advisor on visit_feedback(advisor_id, created_at desc);

alter table visit_feedback enable row level security;

-- Solo lectura para el personal (el asesor de la visita, o la oficina). Nadie escribe directo: se hace por submit_visit_feedback().
drop policy if exists "Ver opiniones de visitas propias o todas con agenda" on visit_feedback;
create policy "Ver opiniones de visitas propias o todas con agenda" on visit_feedback for select
  using (has_admin_section('agenda') and (my_advisor_id() is null or my_advisor_id() = advisor_id));

-- Lo que consulta /opinion/<token>. status: invalido | ok | respondida | no_disponible (la visita aún no es «realizada»).
create or replace function get_visit_survey(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  c agenda_citas;
  prop properties;
  answered boolean;
begin
  select * into c from agenda_citas where booking_token = p_token and p_token ~ '^[0-9a-f]{32}$';
  if not found then
    return jsonb_build_object('status', 'invalido');
  end if;
  select * into prop from properties where id = c.property_id;
  select exists (select 1 from visit_feedback where cita_id = c.id) into answered;
  return jsonb_build_object(
    'status', case when answered then 'respondida' when c.status = 'realizada' then 'ok' else 'no_disponible' end,
    'fecha', c.fecha,
    'property', case when prop.id is null then null else jsonb_build_object('title', prop.title, 'code', prop.code) end
  );
end;
$$;

-- Errores (jsonb {error}): invalid (token), not_ready, invalid_rating, invalid_comment, already_answered.
create or replace function submit_visit_feedback(p_token text, p_rating integer, p_comment text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  c agenda_citas;
  cleaned text := nullif(btrim(coalesce(p_comment, '')), '');
  inserted integer;
begin
  select * into c from agenda_citas where booking_token = p_token and p_token ~ '^[0-9a-f]{32}$';
  if not found then return jsonb_build_object('error', 'invalid'); end if;
  if c.status <> 'realizada' then return jsonb_build_object('error', 'not_ready'); end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then return jsonb_build_object('error', 'invalid_rating'); end if;
  if cleaned is not null and char_length(cleaned) > 500 then return jsonb_build_object('error', 'invalid_comment'); end if;

  insert into visit_feedback (cita_id, property_id, advisor_id, rating, comment)
  values (c.id, c.property_id, c.advisor_id, p_rating, cleaned)
  on conflict (cita_id) do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then return jsonb_build_object('error', 'already_answered'); end if;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function get_visit_survey(text) from public;
revoke all on function submit_visit_feedback(text, integer, text) from public;
grant execute on function get_visit_survey(text) to anon, authenticated;
grant execute on function submit_visit_feedback(text, integer, text) to anon, authenticated;

-- «Reclamo» del correo de la encuesta: true solo la primera vez (solo la usa la Edge Function, con service_role).
create or replace function visit_claim_survey(p_cita_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  changed integer;
begin
  update agenda_citas set survey_sent_at = now() where id = p_cita_id and status = 'realizada' and survey_sent_at is null;
  get diagnostics changed = row_count;
  return changed > 0;
end;
$$;

revoke all on function visit_claim_survey(uuid) from public, anon, authenticated;
grant execute on function visit_claim_survey(uuid) to service_role;

-- El trigger de correo de visitas, ahora también con la encuesta al marcar «Realizada».
create or replace function notify_visit_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  kind text;
begin
  -- Solo reservas del sitio con correo. Las citas que crea el equipo a mano no mandan correo.
  if new.source is distinct from 'sitio' or coalesce(trim(new.contact_email), '') = '' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    kind := case when new.status = 'solicitada' then 'solicitud' else 'confirmacion' end;
  elsif old.status is distinct from 'realizada' and new.status = 'realizada' then
    kind := 'encuesta'; -- el asesor marcó la visita como realizada: se le pide su opinión
  elsif old.status in ('confirmada', 'solicitada') and new.status = 'cancelada' then
    kind := 'cancelacion';
  elsif old.status in ('cancelada', 'solicitada') and new.status = 'confirmada' then
    kind := 'confirmacion'; -- el asesor reactivó una visita cancelada o tomó una solicitud sin asesor
  elsif new.status = 'confirmada' and (new.fecha is distinct from old.fecha or new.hora is distinct from old.hora) then
    kind := 'reprogramada';
  else
    return new;
  end if;

  begin
    perform net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/visita-correo',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key'),
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'agenda_cron_secret')
      ),
      body := jsonb_build_object('cita_id', new.id, 'kind', kind)
    );
  exception when others then
    raise warning 'notify_visit_email: no se pudo encolar el correo (%) de la cita %: %', kind, new.id, sqlerrm;
  end;

  return new;
end;
$$;

-- ─────────────────────────────────────────────
-- Ofertas y apartados por propiedad, y calendario suscribible de la Agenda (2026-11-17)
--
-- 1. property_offers: ofertas del cliente y contraofertas del propietario por propiedad (quién, cuánto, nota y
--    estado). Solo la ve y la maneja quien tiene el apartado Propiedades o Naves (mismo permiso que la propiedad).
-- 2. property_holds: apartados (monto, fecha límite, estado). A lo mucho UNO vigente por propiedad (índice
--    único parcial). El aviso de «por vencer» y «vencido» se calcula con la fecha: nada cambia solo en la base.
-- 3. agenda_feed_tokens + create_agenda_feed_token() + get_agenda_feed(): una URL secreta por persona del equipo
--    para suscribir la Agenda en Google/Apple/Outlook (SOLO lectura, un sentido: el calendario externo no
--    escribe en el sitio). El token es un secreto: quien tenga la URL ve las citas de esa persona; se puede
--    regenerar para invalidar la anterior. No expone teléfonos ni correos de clientes.

create table if not exists property_offers (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  party text not null check (party in ('cliente', 'propietario')),
  buyer_name text not null check (char_length(btrim(buyer_name)) between 1 and 120),
  amount numeric not null check (amount > 0),
  note text check (note is null or char_length(note) <= 300),
  status text not null default 'abierta' check (status in ('abierta', 'aceptada', 'rechazada', 'retirada')),
  created_by text default auth.email(),
  created_at timestamptz not null default now()
);

create index if not exists idx_property_offers_property on property_offers(property_id, created_at desc);

alter table property_offers enable row level security;

drop policy if exists "Rol con apartado propiedades o naves maneja property_offers" on property_offers;
create policy "Rol con apartado propiedades o naves maneja property_offers" on property_offers for all
  using (has_admin_section('propiedades') or has_admin_section('naves_industriales'))
  with check (has_admin_section('propiedades') or has_admin_section('naves_industriales'));

create table if not exists property_holds (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  advisor_id uuid references advisors(id) on delete set null default my_advisor_id(),
  buyer_name text not null check (char_length(btrim(buyer_name)) between 1 and 120),
  buyer_phone text check (buyer_phone is null or char_length(buyer_phone) <= 30),
  amount numeric not null check (amount >= 0),
  due_date date not null,
  note text check (note is null or char_length(note) <= 300),
  status text not null default 'vigente' check (status in ('vigente', 'concretado', 'cancelado')),
  created_by text default auth.email(),
  created_at timestamptz not null default now()
);

create index if not exists idx_property_holds_property on property_holds(property_id, created_at desc);
create index if not exists idx_property_holds_due on property_holds(due_date) where status = 'vigente';
-- Una propiedad no se aparta dos veces a la vez.
create unique index if not exists uniq_property_holds_vigente on property_holds(property_id) where status = 'vigente';

alter table property_holds enable row level security;

drop policy if exists "Rol con apartado propiedades o naves maneja property_holds" on property_holds;
create policy "Rol con apartado propiedades o naves maneja property_holds" on property_holds for all
  using (has_admin_section('propiedades') or has_admin_section('naves_industriales'))
  with check (has_admin_section('propiedades') or has_admin_section('naves_industriales'));

create table if not exists agenda_feed_tokens (
  email text primary key,
  advisor_id uuid references advisors(id) on delete cascade,
  token text not null unique check (token ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

alter table agenda_feed_tokens enable row level security;

-- Cada quien ve (y solo ve) su propio registro; nadie escribe directo: se hace por create_agenda_feed_token().
drop policy if exists "Ver mi propio token de calendario" on agenda_feed_tokens;
create policy "Ver mi propio token de calendario" on agenda_feed_tokens for select
  using (email = auth.email());

-- Crea o REGENERA el token de quien llama (la URL anterior deja de servir). Requiere el apartado Agenda.
create or replace function create_agenda_feed_token()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  new_token text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
begin
  if auth.email() is null or not has_admin_section('agenda') then
    raise exception 'No tienes acceso a la Agenda' using errcode = '42501';
  end if;
  insert into agenda_feed_tokens (email, advisor_id, token)
  values (auth.email(), my_advisor_id(), new_token)
  on conflict (email) do update set token = excluded.token, advisor_id = excluded.advisor_id, created_at = now();
  return new_token;
end;
$$;

revoke all on function create_agenda_feed_token() from public, anon;
grant execute on function create_agenda_feed_token() to authenticated;

-- Lo que lee /api/agenda-ics con el token: las citas confirmadas de esa persona (o todas, si es de oficina) de la
-- última semana en adelante. Sin teléfonos ni correos del cliente. Token inválido → arreglo vacío (no revela nada).
create or replace function get_agenda_feed(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  t agenda_feed_tokens;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return '[]'::jsonb;
  end if;
  select * into t from agenda_feed_tokens where token = p_token;
  if not found then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id, 'titulo', c.titulo, 'fecha', c.fecha, 'hora', c.hora,
      'duracion_min', c.duracion_min, 'lugar', c.lugar, 'actividades', c.actividades
    ) order by c.fecha, c.hora)
    from (
      select * from agenda_citas
      where status = 'confirmada'
        and fecha >= current_date - 7
        and (t.advisor_id is null or advisor_id = t.advisor_id)
      order by fecha, hora
      limit 1000
    ) c
  ), '[]'::jsonb);
end;
$$;

revoke all on function get_agenda_feed(text) from public;
grant execute on function get_agenda_feed(text) to anon, authenticated;

-- ─────────────────────────────────────────────
-- Contratos de intermediación, comisiones por asesor y fusión de prospectos (2026-11-17)
--
-- 1. property_contracts: tipo (exclusiva o abierta) y fecha de vencimiento del contrato con el propietario, para
--    avisar antes de que venza. Va en una tabla APARTE de properties a propósito: properties se lee en público
--    (cualquiera puede consultarla), y esto es interno. Solo el personal con el apartado Propiedades o Naves.
-- 2. commissions: comisión de cada asesor por propiedad y concepto (captación o venta), con su estado
--    (pendiente o pagada) y la fecha de pago. Confidencial como las liquidaciones: la manejan solo los dos
--    socios; cada asesor puede LEER las suyas (no las de otros).
-- 3. merge_prospects(): fusiona dos prospectos duplicados en uno, sin perder su historia (etapas, contactos,
--    citas, selecciones y notas internas pasan al que se conserva).
-- 4. team_leaderboard(): lo que lleva cada asesor ACTIVO en el mes (contactos, visitas, prospectos captados, ventas) y
--    cuántas de sus metas ha cumplido, para la tabla de posiciones. Solo CONTEOS (nada de nombres de clientes ni
--    montos); las metas no se revelan, solo cuántas van cumplidas. Cualquier persona del equipo con Prospectos o Agenda.

create table if not exists property_contracts (
  property_id uuid primary key references properties(id) on delete cascade,
  kind text not null check (kind in ('exclusiva', 'abierta')),
  expires_on date not null,
  note text check (note is null or char_length(note) <= 300),
  updated_by text default auth.email(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_property_contracts_expires on property_contracts(expires_on);

alter table property_contracts enable row level security;

drop policy if exists "Rol con apartado propiedades o naves maneja property_contracts" on property_contracts;
create policy "Rol con apartado propiedades o naves maneja property_contracts" on property_contracts for all
  using (has_admin_section('propiedades') or has_admin_section('naves_industriales'))
  with check (has_admin_section('propiedades') or has_admin_section('naves_industriales'));

create table if not exists commissions (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  advisor_id uuid not null references advisors(id) on delete cascade,
  concept text not null check (concept in ('captacion', 'venta')),
  amount numeric not null check (amount >= 0),
  status text not null default 'pendiente' check (status in ('pendiente', 'pagada')),
  paid_on date,
  note text check (note is null or char_length(note) <= 300),
  updated_by text default auth.email(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (property_id, concept),
  -- Una comisión pagada lleva su fecha de pago; una pendiente no.
  constraint commissions_paid_has_date check ((status = 'pagada') = (paid_on is not null))
);

create index if not exists idx_commissions_advisor on commissions(advisor_id, status);

alter table commissions enable row level security;

drop policy if exists "Solo socios manejan commissions" on commissions;
create policy "Solo socios manejan commissions" on commissions for all
  using (auth.email() in ('inmobiliaria@aclpropiedades.com', 'mh@aclpropiedades.com'))
  with check (auth.email() in ('inmobiliaria@aclpropiedades.com', 'mh@aclpropiedades.com'));

drop policy if exists "Cada asesor lee sus commissions" on commissions;
create policy "Cada asesor lee sus commissions" on commissions for select
  using (advisor_id = my_advisor_id());

-- Fusiona p_remove dentro de p_keep (el que se conserva) y borra p_remove. Quien llama debe tener el apartado
-- Prospectos y, si es un asesor (no la oficina), ser dueño de los dos. Lo que el prospecto conservado ya tiene se
-- respeta; los huecos (teléfono, correo, qué busca, propiedad, visita, asesor) se llenan con los del otro; las
-- notas se juntan; la etapa es la más avanzada (perdido es la más baja); el seguimiento, el más próximo.
create or replace function merge_prospects(p_keep uuid, p_remove uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  k prospectos;
  r prospectos;
  me uuid := my_advisor_id();
  ranks text[] := array['perdido', 'nuevo', 'contactado', 'interesado', 'negociacion', 'cerrado'];
  new_stage text;
  merged_notes text;
begin
  if auth.email() is null or not has_admin_section('prospectos') then
    raise exception 'No tienes acceso a Prospectos' using errcode = '42501';
  end if;
  if p_keep is null or p_remove is null or p_keep = p_remove then
    return jsonb_build_object('error', 'invalid');
  end if;

  select * into k from prospectos where id = p_keep for update;
  if not found then return jsonb_build_object('error', 'not_found'); end if;
  select * into r from prospectos where id = p_remove for update;
  if not found then return jsonb_build_object('error', 'not_found'); end if;

  if me is not null and (k.advisor_id is distinct from me or r.advisor_id is distinct from me) then
    return jsonb_build_object('error', 'forbidden');
  end if;

  new_stage := case when array_position(ranks, r.stage) > array_position(ranks, k.stage) then r.stage else k.stage end;
  merged_notes := nullif(concat_ws(E'\n\n',
    nullif(btrim(coalesce(k.notes, '')), ''),
    case when nullif(btrim(coalesce(r.notes, '')), '') is not null then 'Fusionado con «' || r.name || '»: ' || btrim(r.notes) end
  ), '');

  -- visit_id es único: se libera en el que se borra antes de pasárselo al que se conserva.
  if r.visit_id is not null then
    update prospectos set visit_id = null where id = r.id;
  end if;

  update prospectos set
    phone = coalesce(nullif(btrim(coalesce(k.phone, '')), ''), r.phone),
    email = coalesce(nullif(btrim(coalesce(k.email, '')), ''), r.email),
    looking_for = coalesce(nullif(btrim(coalesce(k.looking_for, '')), ''), r.looking_for),
    property_id = coalesce(k.property_id, r.property_id),
    visit_id = coalesce(k.visit_id, r.visit_id),
    advisor_id = coalesce(k.advisor_id, r.advisor_id),
    notes = merged_notes,
    stage = new_stage,
    lost_reason = case when new_stage = 'perdido' then coalesce(k.lost_reason, r.lost_reason) else null end,
    last_contact_at = greatest(k.last_contact_at, r.last_contact_at),
    next_followup_at = least(k.next_followup_at, r.next_followup_at),
    created_at = least(k.created_at, r.created_at),
    updated_at = now()
  where id = k.id;

  update prospecto_etapas set prospecto_id = k.id where prospecto_id = r.id;
  update prospecto_contactos set prospecto_id = k.id where prospecto_id = r.id;
  update agenda_citas set prospecto_id = k.id where prospecto_id = r.id;
  update property_selections set prospecto_id = k.id where prospecto_id = r.id;
  update internal_notes set entity_id = k.id where entity_type = 'prospect' and entity_id = r.id;

  delete from prospectos where id = r.id;
  return jsonb_build_object('ok', true, 'kept', k.id);
end;
$$;

revoke all on function merge_prospects(uuid, uuid) from public, anon;
grant execute on function merge_prospects(uuid, uuid) to authenticated;

create or replace function team_leaderboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  month_start timestamptz := date_trunc('month', now());
begin
  if auth.email() is null or not (has_admin_section('prospectos') or has_admin_section('agenda')) then
    raise exception 'No tienes acceso al equipo' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(to_jsonb(r) order by r.name)
    from (
      select
        a.id as advisor_id,
        a.name,
        c.contacts, v.visits, p.new_prospects, s.sales,
        coalesce((g.contacts > 0)::int + (g.visits > 0)::int + (g.new_prospects > 0)::int + (g.sales > 0)::int, 0) as goals_set,
        coalesce((g.contacts > 0 and c.contacts >= g.contacts)::int + (g.visits > 0 and v.visits >= g.visits)::int
          + (g.new_prospects > 0 and p.new_prospects >= g.new_prospects)::int + (g.sales > 0 and s.sales >= g.sales)::int, 0) as goals_met
      from advisors a
      left join advisor_goals g on g.advisor_id = a.id
      cross join lateral (select count(*)::int as contacts from prospecto_contactos pc join prospectos pr on pr.id = pc.prospecto_id where pr.advisor_id = a.id and pc.at >= month_start) c
      cross join lateral (select count(*)::int as visits from property_visits pv where pv.advisor_id = a.id and pv.visited_at >= month_start) v
      cross join lateral (select count(*)::int as new_prospects from prospectos pr where pr.advisor_id = a.id and pr.created_at >= month_start) p
      cross join lateral (select count(*)::int as sales from ventas ve where ve.advisor_id = a.id and ve.fecha_venta >= month_start::date) s
      where a.active
    ) r
  ), '[]'::jsonb);
end;
$$;

revoke all on function team_leaderboard() from public, anon;
grant execute on function team_leaderboard() to authenticated;

-- ─────────────────────────────────────────────
-- Freno de envíos públicos en el servidor (2026-11-18)
-- Hasta ahora el freno del formulario de contacto (campo trampa y espera de 60 s) vivía solo en el navegador: quien
-- llamara a la API directo podía mandar mensajes sin límite (cada uno dispara un aviso por WhatsApp). Ahora la base
-- cuenta los envíos anónimos por conexión (IP) y en total, y rechaza el exceso. Aplica a:
--   · contact_messages (formulario de Contacto, solicitudes de visita y de información) — 10 por hora por IP, 200 por hora en total
--   · property_alerts  (suscripción a avisos, que manda correos/WhatsApp a terceros)    — 10 por hora por IP, 100 por hora en total
-- Solo cuenta a quien entra como anónimo (rol «anon»): el personal con sesión, el SQL Editor y las funciones del
-- servidor (service role) no se frenan. Las reservas de visita ya tenían su propio freno (visit_booking_attempts).
-- Limitaciones (a propósito): quien rote de IP puede seguir mandando hasta el tope global; y detrás de una misma red
-- (oficina, datos móviles compartidos) varias personas comparten el cupo. Para frenar bots de verdad (no solo exceso)
-- el siguiente paso sería Cloudflare Turnstile, que necesita una cuenta y llaves propias.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

create table if not exists public_rate_hits (
  id bigserial primary key,
  bucket text not null,
  ip text,
  created_at timestamptz not null default now()
);
create index if not exists idx_public_rate_hits_bucket_ip on public_rate_hits(bucket, ip, created_at desc);
create index if not exists idx_public_rate_hits_bucket_time on public_rate_hits(bucket, created_at desc);

-- Sin políticas: solo las funciones de abajo (security definer) leen y escriben.
alter table public_rate_hits enable row level security;

-- IP de quien llama, tal como la reporta el proxy de Supabase (primer valor de x-forwarded-for). null si no hay.
create or replace function request_client_ip()
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
  if headers is null then return null; end if;
  return nullif(trim(split_part(coalesce(headers ->> 'x-forwarded-for', headers ->> 'cf-connecting-ip', ''), ',', 1)), '');
end;
$$;

-- Cuenta un envío anónimo en `p_bucket` y lo rechaza (error 54429) si esa IP ya llegó a su tope o si el total pasó el suyo.
create or replace function enforce_public_rate_limit(p_bucket text, p_ip_limit int, p_global_limit int, p_window interval default interval '1 hour')
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  caller_ip text;
begin
  -- Solo se frena a quien entra como anónimo.
  if coalesce(auth.role(), '') <> 'anon' then
    return;
  end if;

  caller_ip := request_client_ip();

  if caller_ip is not null
     and (select count(*) from public_rate_hits h where h.bucket = p_bucket and h.ip = caller_ip and h.created_at > now() - p_window) >= p_ip_limit then
    raise exception 'Demasiados envíos desde tu conexión. Inténtalo de nuevo más tarde.' using errcode = '54429';
  end if;

  if (select count(*) from public_rate_hits h where h.bucket = p_bucket and h.created_at > now() - p_window) >= p_global_limit then
    raise exception 'Estamos recibiendo demasiados envíos. Inténtalo de nuevo más tarde.' using errcode = '54429';
  end if;

  insert into public_rate_hits (bucket, ip) values (p_bucket, caller_ip);

  -- Limpieza de pasada: casi nunca, y solo lo viejo.
  if random() < 0.02 then
    delete from public_rate_hits where created_at < now() - interval '2 days';
  end if;
end;
$$;

revoke all on function enforce_public_rate_limit(text, int, int, interval) from public, anon, authenticated;
revoke all on function request_client_ip() from public;
grant execute on function request_client_ip() to anon, authenticated;

create or replace function trg_limit_contact_messages()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform enforce_public_rate_limit('contact_messages', 10, 200);
  return new;
end;
$$;

drop trigger if exists trg_limit_contact_messages on contact_messages;
create trigger trg_limit_contact_messages
before insert on contact_messages
for each row execute function trg_limit_contact_messages();

create or replace function trg_limit_property_alerts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform enforce_public_rate_limit('property_alerts', 10, 100);
  return new;
end;
$$;

drop trigger if exists trg_limit_property_alerts on property_alerts;
create trigger trg_limit_property_alerts
before insert on property_alerts
for each row execute function trg_limit_property_alerts();

-- ─────────────────────────────────────────────
-- Verificación en dos pasos y dispositivos del panel (2026-11-18)
-- 1) mfa_ok(): verdadero si la sesión ya confirmó su código (aal2) o si la persona NO tiene la verificación activada.
--    Así nadie queda fuera por no haberla activado todavía, pero quien SÍ la activó ya no puede leer los datos sensibles con
--    una sesión que solo tenga la contraseña (aal1). Se aplica como política «restrictive» (se suma a las que ya existen) a:
--      · clients (INE/CURP/contraseña del portal), client_documents y perfilamientos_comprador
--      · el bucket privado de archivos de clientes (client-documents)
--    Alcance: acceso directo a tablas y archivos. Las funciones del servidor (security definer) no pasan por aquí.
-- 2) admin_devices: dispositivos que han entrado al panel (el navegador se registra solo al iniciar sesión).
--    Supabase no deja a la app listar las sesiones reales, así que esta lista es de «dispositivos vistos»; cerrar las demás
--    sesiones sí es real (signOut con scope «others») y además borra de la lista a los otros dispositivos.
-- Requiere activar MFA (TOTP) en Supabase: Authentication → Sign In / Providers → Multi-Factor.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

create or replace function mfa_ok()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
    or not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified');
$$;

revoke all on function mfa_ok() from public;
grant execute on function mfa_ok() to authenticated;

drop policy if exists "Dos pasos para datos sensibles" on clients;
create policy "Dos pasos para datos sensibles" on clients as restrictive for all to authenticated
  using (mfa_ok()) with check (mfa_ok());

drop policy if exists "Dos pasos para datos sensibles" on client_documents;
create policy "Dos pasos para datos sensibles" on client_documents as restrictive for all to authenticated
  using (mfa_ok()) with check (mfa_ok());

do $$
begin
  if to_regclass('public.perfilamientos_comprador') is not null then
    execute 'drop policy if exists "Dos pasos para datos sensibles" on perfilamientos_comprador';
    execute 'create policy "Dos pasos para datos sensibles" on perfilamientos_comprador as restrictive for all to authenticated using (mfa_ok()) with check (mfa_ok())';
  end if;
end $$;

drop policy if exists "Dos pasos para archivos de clientes" on storage.objects;
create policy "Dos pasos para archivos de clientes" on storage.objects as restrictive for all to authenticated
  using (bucket_id <> 'client-documents' or mfa_ok())
  with check (bucket_id <> 'client-documents' or mfa_ok());

create table if not exists admin_devices (
  user_id uuid not null,
  device_id text not null check (length(device_id) between 8 and 80),
  label text not null default '' check (length(label) <= 120),
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  primary key (user_id, device_id)
);

alter table admin_devices enable row level security;

drop policy if exists "Cada quien ve sus dispositivos" on admin_devices;
create policy "Cada quien ve sus dispositivos" on admin_devices for select to authenticated
  using (user_id = auth.uid());

create or replace function touch_admin_device(p_device_id text, p_label text default '')
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or p_device_id is null or length(p_device_id) not between 8 and 80 then
    return;
  end if;
  insert into admin_devices (user_id, device_id, label)
  values (auth.uid(), p_device_id, left(coalesce(p_label, ''), 120))
  on conflict (user_id, device_id) do update set last_seen = now(), label = excluded.label;
  -- Sin acumular: solo los 20 más recientes de cada persona.
  delete from admin_devices d
  where d.user_id = auth.uid()
    and d.device_id in (select device_id from admin_devices where user_id = auth.uid() order by last_seen desc offset 20);
end;
$$;

create or replace function forget_other_admin_devices(p_device_id text)
returns int
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  removed int;
begin
  if auth.uid() is null then return 0; end if;
  delete from admin_devices where user_id = auth.uid() and device_id <> coalesce(p_device_id, '');
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function touch_admin_device(text, text) from public, anon;
revoke all on function forget_other_admin_devices(text) from public, anon;
grant execute on function touch_admin_device(text, text) to authenticated;
grant execute on function forget_other_admin_devices(text) to authenticated;

-- ─────────────────────────────────────────────
-- Monitoreo de errores del navegador (2026-11-18)
-- Hasta ahora un fallo en producción no avisaba a nadie. El sitio manda cada error del navegador (mensaje, pila, ruta sin
-- datos personales ni enlaces secretos, navegador y versión) a report_client_error; se agrupan por «huella» (el mismo
-- error cuenta como uno con su número de veces) y los administradores (apartado «roles») los ven en /admin/errores.
-- La Edge Function errores-aviso, disparada por pg_cron cada 30 minutos, manda UN correo con los errores nuevos
-- (o que reaparecieron tras marcarse como resueltos). Sin servicios de terceros.
-- report_client_error es público (los visitantes no tienen cuenta) y usa el freno de envíos públicos de arriba
-- (60 por hora por IP, 600 por hora en total). Requiere los secretos CRON_SECRET, RESEND_API_KEY (y opcional RESEND_FROM,
-- SITE_URL, ERRORS_REPORT_TO) de la función; desplegarla con la verificación de JWT desactivada.
-- (bloque re-ejecutable: cron.schedule con un nombre que ya existe actualiza ese job)
-- ─────────────────────────────────────────────

create table if not exists client_errors (
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null unique,
  message text not null,
  stack text,
  source text not null default 'window',
  url text,
  user_agent text,
  release text,
  count int not null default 1,
  status text not null default 'nuevo' check (status in ('nuevo', 'resuelto', 'ignorado')),
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  notified_at timestamptz
);

create index if not exists idx_client_errors_status_seen on client_errors(status, last_seen desc);

alter table client_errors enable row level security;

drop policy if exists "Administradores leen errores" on client_errors;
create policy "Administradores leen errores" on client_errors for select
  using (has_admin_section('roles'));

drop policy if exists "Administradores actualizan errores" on client_errors;
create policy "Administradores actualizan errores" on client_errors for update
  using (has_admin_section('roles')) with check (has_admin_section('roles'));

drop policy if exists "Administradores borran errores" on client_errors;
create policy "Administradores borran errores" on client_errors for delete
  using (has_admin_section('roles'));

create or replace function report_client_error(
  p_fingerprint text,
  p_message text,
  p_stack text default null,
  p_url text default null,
  p_user_agent text default null,
  p_release text default null,
  p_source text default 'window'
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if p_fingerprint is null or p_fingerprint !~ '^[0-9a-f]{8}$' or coalesce(trim(p_message), '') = '' then
    return;
  end if;

  perform enforce_public_rate_limit('client_errors', 60, 600);

  insert into client_errors (fingerprint, message, stack, source, url, user_agent, release)
  values (
    p_fingerprint,
    left(p_message, 500),
    left(p_stack, 4000),
    case when p_source in ('window', 'promise', 'react') then p_source else 'window' end,
    left(p_url, 300),
    left(p_user_agent, 300),
    left(p_release, 40)
  )
  on conflict (fingerprint) do update set
    count = client_errors.count + 1,
    last_seen = now(),
    url = excluded.url,
    user_agent = excluded.user_agent,
    release = excluded.release,
    -- Si ya estaba resuelto y vuelve a pasar, reaparece como nuevo y se avisa otra vez.
    status = case when client_errors.status = 'resuelto' then 'nuevo' else client_errors.status end,
    notified_at = case when client_errors.status = 'resuelto' then null else client_errors.notified_at end;
end;
$$;

revoke all on function report_client_error(text, text, text, text, text, text, text) from public;
grant execute on function report_client_error(text, text, text, text, text, text, text) to anon, authenticated;

select cron.schedule(
  'errores-aviso',
  '*/30 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/errores-aviso',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key'),
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'agenda_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ─────────────────────────────────────────────
-- Tiempo real del panel (2026-11-18)
-- Mensajes de contacto y prospectos nuevos aparecen en el panel al instante, sin recargar ni cambiar de pantalla
-- (Supabase Realtime, solo a las personas con sesión; las políticas de lectura de cada tabla siguen mandando: quien no puede
-- leer una fila tampoco recibe su aviso). Solo hay que agregar las tablas a la publicación «supabase_realtime».
-- Es lo único que hace este bloque; si prefieres, también se puede activar en el panel de Supabase:
-- Database → Replication.
-- (bloque re-ejecutable: no repite una tabla que ya está en la publicación)
-- ─────────────────────────────────────────────

do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    return; -- fuera de Supabase (o con Realtime apagado): nada que hacer
  end if;
  foreach t in array array['contact_messages', 'prospectos'] loop
    if to_regclass('public.' || t) is not null
       and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ─────────────────────────────────────────────
-- Conteo de propiedades por tipo, sin bajar el catálogo (2026-11-18)
-- El encabezado y el inicio del sitio bajaban TODAS las propiedades activas solo para contar cuántas hay de cada tipo (y el
-- inicio, además, para elegir las destacadas). Ahora piden este número ya contado. Cuenta las propiedades activas (con
-- cualquier estatus), igual que antes. Función de solo lectura que respeta las políticas de la tabla.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

create or replace function public_type_counts()
returns jsonb
language sql
stable
as $$
  select coalesce(jsonb_object_agg(type, n), '{}'::jsonb)
  from (select type, count(*)::int as n from properties where active group by type) t;
$$;

revoke all on function public_type_counts() from public;
grant execute on function public_type_counts() to anon, authenticated;
