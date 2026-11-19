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

