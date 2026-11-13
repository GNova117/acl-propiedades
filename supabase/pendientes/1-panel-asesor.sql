-- ══════════════════════════════════════════════════════════════════════════════
-- ARCHIVO 1 de 2 — Panel del asesor (noviembre 2026). Pégalo COMPLETO en Supabase → SQL Editor → Run.
-- Es re-ejecutable: si lo corres dos veces no pasa nada. No necesita que se haya desplegado nada antes.
-- Incluye: comisiones publicadas para cada asesor, aviso «le encaja a tu prospecto» (solo la tabla),
-- página/tarjeta digital del asesor (slug), opinión del cliente después de la visita.
-- El cron de «le encaja a tu prospecto» va en el ARCHIVO 2 (córrelo DESPUÉS de desplegar la función).
-- ══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────
-- «Le encaja a tu prospecto» (aviso push) y «Mis ventas y comisiones» del asesor (2026-11)
--
-- 1) Le encaja a tu prospecto. La Edge Function `prospecto-coincidencias` corre cada hora (solo de 8 am a 8 pm, hora de México) y
--    avisa por push al asesor cuando entra una propiedad nueva —o baja de precio— que le encaja a alguno de sus prospectos
--    abiertos (los criterios de «qué busca» del prospecto; la coincidencia es la misma de la pantalla Prospectos). Los prospectos
--    sin asesor van a la oficina. `property_match_pushes` recuerda qué novedad ya se avisó para no repetirla. La pantalla (Mi día
--    y la campana) funciona sin esto: el push solo es el aviso al teléfono; sin el bloque, o sin activar las notificaciones en el
--    dispositivo, el asesor ve la lista dentro del panel.
--    ⚠️ ORDEN: desplegar la función `prospecto-coincidencias` (sin verificar JWT, como las demás de cron) ANTES de correr el cron,
--    y tener ya desplegada la versión actual de `enviar-push` (la que entiende advisorId y office).
--
-- 2) Mis ventas y comisiones. La liquidación (utilidad, gastos, lo de cada socio) es confidencial y solo la ve quien tiene el
--    apartado 'liquidaciones'. Para que cada asesor vea SU comisión sin abrir eso, la oficina la PUBLICA desde Reportes → Utilidad
--    («Publicar comisiones»): se guarda una fila por persona, casa y concepto (captación o venta) con solo su monto. Es una foto
--    de ese momento —si cambia la liquidación, se vuelve a publicar— y nada se publica solo: mientras la oficina no lo haga, el
--    asesor ve «pendiente». Cada asesor lee únicamente las suyas (my_advisor_id()); escribir es de quien tiene 'liquidaciones'.
--    Las ventas propias ya eran legibles por el asesor (política «Asesor ve sus propias ventas», más arriba).
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

create table if not exists property_match_pushes (
  property_id uuid not null references properties(id) on delete cascade,
  kind text not null check (kind in ('new', 'priceDrop')),
  event_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (property_id, kind, event_at)
);

-- Solo la usa la función con la service role key (se salta RLS): con RLS activa y sin políticas, nadie más la lee ni la escribe.
alter table property_match_pushes enable row level security;

create table if not exists advisor_commissions (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  advisor_id uuid not null references advisors(id) on delete cascade,
  role text not null check (role in ('captacion', 'venta')),
  amount numeric not null check (amount >= 0),
  fecha_venta date,
  published_by text,
  published_at timestamptz not null default now(),
  unique (property_id, advisor_id, role)
);

create index if not exists idx_advisor_commissions_advisor on advisor_commissions(advisor_id);
create index if not exists idx_advisor_commissions_fecha on advisor_commissions(fecha_venta);

alter table advisor_commissions enable row level security;

drop policy if exists "Asesor ve sus comisiones publicadas" on advisor_commissions;
create policy "Asesor ve sus comisiones publicadas" on advisor_commissions for select
  using (my_advisor_id() is not null and my_advisor_id() = advisor_id);

drop policy if exists "Rol con apartado liquidaciones maneja comisiones publicadas" on advisor_commissions;
create policy "Rol con apartado liquidaciones maneja comisiones publicadas" on advisor_commissions for all
  using (has_admin_section('liquidaciones'))
  with check (has_admin_section('liquidaciones'));


-- ─────────────────────────────────────────────
-- Página y tarjeta digital del asesor, y opinión del cliente después de la visita (2026-11)
--
-- 1) Página del asesor (/asesor/<slug>). `advisors.slug` se genera UNA vez con el nombre (sin acentos, con guiones; -2, -3… si se
--    repite) y ya no cambia, para que el QR impreso y los enlaces mandados sigan sirviendo. Solo la oficina (apartado 'asesores')
--    puede cambiarlo a mano. La página es pública y solo muestra a quien está activo y visible en el equipo; la tabla advisors ya
--    era de lectura pública (la usa Nosotros).
--    Lo que escribe un visitante en la página llega a ESE asesor: contact_messages.advisor_id, aviso por WhatsApp (se suma su
--    número) y, de una vez, un prospecto «nuevo» asignado a él (con su aviso push), para que no dependa de que alguien de la
--    oficina convierta el mensaje. Los prospectos «nuevo» sin atender siguen el aviso de siempre (1 h al asesor, 3 h a la oficina).
-- 2) Opinión de la visita. El cliente, desde /visita/<token>, califica de 1 a 5 estrellas, comenta y pide ver más opciones, una sola
--    vez, desde que empieza la visita y hasta 30 días después (solo si no canceló ni dejó de ir). `submit_booking_feedback` lo guarda
--    en agenda_citas y avisa al asesor con un mensaje (canal «visita_opinion», con su aviso por WhatsApp como los de cambio de
--    visita). get_booking ahora también responde `can_feedback` y `feedback`. Queda en la línea de tiempo del prospecto y como
--    chip en la Agenda. NO entra al informe para el vendedor (ahí van las visitas que registra el equipo, no las opiniones).
-- 3) Ausencias: sin cambios de base (usan advisor_time_off, que ya existía como «días de descanso» del horario de visitas).
-- ⚠️ ORDEN: corre este bloque ANTES de publicar el sitio nuevo si quieres que /asesor/<slug> y las opiniones funcionen desde el
--    primer día; sin él el sitio no se rompe (la tarjeta digital avisa que aún no está disponible y la opinión no se ofrece).
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

alter table advisors add column if not exists slug text;

create or replace function advisors_set_slug() returns trigger
language plpgsql
as $$
declare
  base text;
  candidate text;
  n int := 1;
begin
  if new.slug is not null and btrim(new.slug) <> '' then
    return new;
  end if;
  base := coalesce(nullif(trim(both '-' from regexp_replace(translate(lower(coalesce(new.name, '')), 'áéíóúüñ', 'aeiouun'), '[^a-z0-9]+', '-', 'g')), ''), 'asesor');
  candidate := base;
  while exists (select 1 from advisors a where a.slug = candidate and a.id is distinct from new.id) loop
    n := n + 1;
    candidate := base || '-' || n;
  end loop;
  new.slug := candidate;
  return new;
end;
$$;

-- El asesor edita su propio perfil, pero no su enlace ni si aparece en el equipo (eso lo decide la oficina). El orden de los
-- triggers importa: este va antes (guard < set_slug) y deja el slug como estaba para que set_slug solo rellene si falta.
create or replace function advisors_guard_self_edit() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not has_admin_section('asesores') then
    new.active := old.active;
    new.show_in_team := old.show_in_team;
    new.slug := old.slug;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_advisors_set_slug on advisors;
create trigger trg_advisors_set_slug
before insert or update on advisors
for each row execute function advisors_set_slug();

-- A los asesores que ya existen se les pone su slug (un update sin cambios dispara el trigger).
update advisors set name = name where slug is null;

create unique index if not exists advisors_slug_key on advisors (slug);

alter table contact_messages add column if not exists advisor_id uuid references advisors(id) on delete set null;
create index if not exists idx_contact_messages_advisor on contact_messages(advisor_id);

create or replace function notify_new_contact_message() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  advisor_phones jsonb := '[]'::jsonb;
  cita_advisor uuid;
  cita_phone text;
begin
  if new.property_id is not null then
    select coalesce(jsonb_agg(numero), '[]'::jsonb) into advisor_phones
    from (
      select coalesce(nullif(btrim(a.whatsapp), ''), nullif(btrim(a.phone), '')) as numero
      from property_advisors pa
      join advisors a on a.id = pa.advisor_id
      where pa.property_id = new.property_id
        and a.active
    ) s
    where numero is not null;
  end if;

  -- Mensajes ligados a una cita (reserva, cambio, solicitud): también va el asesor de la cita.
  if coalesce(new.details ->> 'advisor_id', '') ~ '^[0-9a-f-]{36}$' then
    cita_advisor := (new.details ->> 'advisor_id')::uuid;
    select coalesce(nullif(btrim(a.whatsapp), ''), nullif(btrim(a.phone), '')) into cita_phone
    from advisors a where a.id = cita_advisor and a.active;
    if cita_phone is not null and not advisor_phones ? cita_phone then
      advisor_phones := advisor_phones || to_jsonb(cita_phone);
    end if;
  end if;

  -- Mensajes que llegaron por la página de un asesor: también va ese asesor.
  if new.advisor_id is not null then
    cita_phone := null;
    select coalesce(nullif(btrim(a.whatsapp), ''), nullif(btrim(a.phone), '')) into cita_phone
    from advisors a where a.id = new.advisor_id and a.active;
    if cita_phone is not null and not advisor_phones ? cita_phone then
      advisor_phones := advisor_phones || to_jsonb(cita_phone);
    end if;
  end if;

  perform net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/mensaje-contacto-whatsapp',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key'),
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'agenda_cron_secret')
    ),
    body := jsonb_build_object(
      'name', new.name,
      'phone', new.phone,
      'message', new.message,
      'advisorPhones', advisor_phones
    )
  );
  return new;
end;
$$;

-- Aviso push: además de la oficina (apartado 'mensajes'), el asesor al que va dirigido el mensaje, directo a Prospectos.
create or replace function notify_new_contact_message_push() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/enviar-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key'),
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'agenda_cron_secret')
    ),
    body := jsonb_build_object(
      'section', 'mensajes',
      'title', 'Nuevo mensaje: ' || new.name,
      'body', left(coalesce(new.message, ''), 150),
      'url', '/admin/mensajes'
    )
  );

  if new.advisor_id is not null then
    perform net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/enviar-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key'),
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'agenda_cron_secret')
      ),
      body := jsonb_build_object(
        'advisorId', new.advisor_id,
        'title', case when new.channel = 'visita_opinion' then 'Opinión de una visita: ' || new.name else 'Escribieron en tu tarjeta: ' || new.name end,
        'body', left(coalesce(new.message, ''), 150),
        'url', case when new.channel = 'asesor' then '/admin/prospectos' else '/admin/mi-dia' end
      )
    );
  end if;
  return new;
end;
$$;

-- Lo que escriben en la página de un asesor se vuelve, de una vez, un prospecto nuevo asignado a él.
create or replace function advisor_message_to_prospect() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.advisor_id is null or new.channel <> 'asesor' then
    return new;
  end if;
  insert into prospectos (name, phone, email, source, stage, advisor_id, message_id, notes, created_by)
  values (
    coalesce(nullif(btrim(new.name), ''), 'Sin nombre'), new.phone, nullif(btrim(coalesce(new.email, '')), ''),
    'sitio', 'nuevo', new.advisor_id, new.id, new.message, 'tarjeta del asesor'
  )
  on conflict (message_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_advisor_message_to_prospect on contact_messages;
create trigger trg_advisor_message_to_prospect
after insert on contact_messages
for each row execute function advisor_message_to_prospect();

-- Opinión de la visita (columnas en la cita).
alter table agenda_citas add column if not exists feedback_rating smallint check (feedback_rating between 1 and 5);
alter table agenda_citas add column if not exists feedback_comment text;
alter table agenda_citas add column if not exists feedback_more_options boolean not null default false;
alter table agenda_citas add column if not exists feedback_at timestamptz;

create or replace function get_booking(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  c agenda_citas;
  adv advisors;
  prop properties;
  cl_name text;
  now_mx timestamp := (now() at time zone 'America/Mexico_City');
  start_at timestamp;
  mins_until numeric;
begin
  select * into c from agenda_citas where booking_token = p_token and p_token ~ '^[0-9a-f]{32}$';
  if not found then return jsonb_build_object('status', 'invalido'); end if;

  select * into adv from advisors where id = c.advisor_id;
  select * into prop from properties where id = c.property_id;
  -- Una cita que capturó el equipo en la Agenda también tiene enlace: el nombre sale del cliente ligado.
  select name into cl_name from clients where id = c.client_id;
  start_at := c.fecha + coalesce(c.hora, time '00:00');
  mins_until := extract(epoch from (start_at - now_mx)) / 60;

  return jsonb_build_object(
    'status', c.status,
    'fecha', c.fecha,
    'hora', to_char(c.hora, 'HH24:MI'),
    'duracion_min', c.duracion_min,
    'client_name', split_part(coalesce(nullif(trim(c.contact_name), ''), cl_name, ''), ' ', 1),
    'titulo', c.titulo,
    'lugar', c.lugar,
    'client_confirmed_at', c.client_confirmed_at,
    'reschedule_count', c.reschedule_count,
    -- Una cita del sitio se mueve siempre (se reservó con los horarios de su asesor); una que capturó el
    -- equipo, solo si su asesor ofrece horarios en línea (si no, no hay a dónde moverla desde aquí).
    'can_reschedule', c.status = 'confirmada' and c.hora is not null and mins_until >= 120 and c.reschedule_count < 2
      and (c.source = 'sitio' or exists (select 1 from advisor_visit_settings s where s.advisor_id = c.advisor_id and s.enabled)),
    'can_cancel', c.status in ('confirmada', 'solicitada') and c.hora is not null and mins_until > 0,
    'can_confirm', c.status = 'confirmada' and c.hora is not null and mins_until > 0 and c.client_confirmed_at is null,
    -- Opinión después de la visita: ya empezó (confirmada o realizada), máximo 30 días y una sola vez.
    'can_feedback', c.status in ('confirmada', 'realizada') and mins_until <= 0 and mins_until >= -43200 and c.feedback_at is null,
    'feedback', case when c.feedback_at is null then null else
      jsonb_build_object('rating', c.feedback_rating, 'comment', c.feedback_comment, 'more_options', c.feedback_more_options, 'at', c.feedback_at)
    end,
    'advisor', case when adv.id is null then null else
      jsonb_build_object('id', adv.id, 'name', adv.name, 'phone', adv.phone, 'whatsapp', adv.whatsapp, 'photo_url', adv.photo_url)
    end,
    'property', case when prop.id is null then null else
      jsonb_build_object('id', prop.id, 'title', prop.title, 'code', prop.code, 'address', prop.address, 'main_image', prop.main_image, 'lat', prop.lat, 'lng', prop.lng)
    end
  );
end;
$$;

revoke all on function get_booking(text) from public;
grant execute on function get_booking(text) to anon, authenticated;

create or replace function submit_booking_feedback(p_token text, p_rating int, p_comment text default null, p_more_options boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c agenda_citas;
  prop properties;
  cl_name text;
  now_mx timestamp := (now() at time zone 'America/Mexico_City');
  start_at timestamp;
  clean_comment text;
  label text;
  msg text;
begin
  select * into c from agenda_citas where booking_token = p_token and p_token ~ '^[0-9a-f]{32}$';
  if not found then return jsonb_build_object('error', 'not_found'); end if;
  if c.status not in ('confirmada', 'realizada') then return jsonb_build_object('error', 'not_active'); end if;

  start_at := c.fecha + coalesce(c.hora, time '00:00');
  if start_at > now_mx then return jsonb_build_object('error', 'too_early'); end if;
  if start_at < now_mx - interval '30 days' then return jsonb_build_object('error', 'too_late'); end if;
  if c.feedback_at is not null then return jsonb_build_object('error', 'already_sent'); end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then return jsonb_build_object('error', 'invalid_rating'); end if;

  clean_comment := nullif(left(btrim(coalesce(p_comment, '')), 500), '');
  update agenda_citas
  set feedback_rating = p_rating, feedback_comment = clean_comment, feedback_more_options = coalesce(p_more_options, false),
      feedback_at = now(), updated_at = now()
  where id = c.id;

  -- Aviso al asesor. Mismo texto que buildFeedbackMessage() en src/lib/visitSlots.js.
  select * into prop from properties where id = c.property_id;
  select name into cl_name from clients where id = c.client_id;
  label := coalesce(case when prop.code is not null then trim(prop.title) || ' (' || prop.code || ')' else trim(prop.title) end, trim(c.titulo));
  msg := 'Opinión de la visita — ' || label || E'.\nCalificación: ' || repeat('★', p_rating) || repeat('☆', 5 - p_rating) || ' (' || p_rating || ' de 5)'
    || case when clean_comment is not null then E'\nComentario: ' || clean_comment else '' end
    || case when coalesce(p_more_options, false) then E'\nQuiere ver más opciones: propónle un día para mostrarle otras propiedades.' else '' end;

  insert into contact_messages (name, email, phone, message, property_id, channel, details, advisor_id)
  values (
    coalesce(nullif(trim(c.contact_name), ''), cl_name, '(sin nombre)'), coalesce(c.contact_email, ''), c.contact_phone, msg,
    c.property_id, 'visita_opinion',
    jsonb_build_object('cita_id', c.id, 'advisor_id', c.advisor_id, 'rating', p_rating, 'more_options', coalesce(p_more_options, false)),
    c.advisor_id
  );
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function submit_booking_feedback(text, int, text, boolean) from public;
grant execute on function submit_booking_feedback(text, int, text, boolean) to anon, authenticated;
