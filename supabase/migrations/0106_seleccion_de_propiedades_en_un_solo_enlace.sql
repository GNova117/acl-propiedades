-- ─────────────────────────────────────────────
-- Selección de propiedades en un solo enlace (2026-11-13)
-- El asesor elige varias propiedades (las que le encajan a un prospecto u otras) y
-- manda UN enlace: /seleccion/<token>, una página pública con todas, el botón de
-- WhatsApp del asesor y «Me interesa» por propiedad. La fila guarda las propiedades,
-- el mensaje y quién la mandó; además cuenta cuándo la abrió el cliente (primera y
-- última vez, y cuántas veces) para el seguimiento: la ficha del prospecto muestra
-- «Abrió la selección» y la línea de tiempo anota el momento.
--
-- Privacidad: el token (32 hex, nunca corto ni adivinable) es la llave; la tabla NO
-- se lee desde fuera (RLS: solo personal con Prospectos o Propiedades, y cada asesor
-- ve las suyas; la oficina ve todas). La página pública llama a selection_open(),
-- security definer, que devuelve solo lo que la página necesita —las propiedades en sí
-- son las mismas que ya lee el sitio público— y anota la apertura. Un enlace
-- vence a los 60 días y el asesor puede desactivarlo (revoked_at).
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

create table if not exists property_selections (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default replace(gen_random_uuid()::text, '-', '')
    check (token ~ '^[0-9a-f]{32}$'),
  title text check (title is null or char_length(title) <= 120),
  note text check (note is null or char_length(note) <= 500),
  property_ids uuid[] not null check (cardinality(property_ids) between 1 and 12),
  advisor_id uuid references advisors(id) on delete set null,
  prospecto_id uuid references prospectos(id) on delete set null,
  created_by text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '60 days',
  first_opened_at timestamptz,
  last_opened_at timestamptz,
  open_count integer not null default 0,
  revoked_at timestamptz
);

create index if not exists idx_property_selections_prospecto on property_selections(prospecto_id);
create index if not exists idx_property_selections_advisor on property_selections(advisor_id, created_at desc);

alter table property_selections enable row level security;

drop policy if exists "Ver selecciones propias o todas" on property_selections;
create policy "Ver selecciones propias o todas" on property_selections for select
  using ((has_admin_section('prospectos') or has_admin_section('propiedades')) and (my_advisor_id() is null or my_advisor_id() = advisor_id));

drop policy if exists "Crear selecciones propias o todas" on property_selections;
create policy "Crear selecciones propias o todas" on property_selections for insert
  with check ((has_admin_section('prospectos') or has_admin_section('propiedades')) and (my_advisor_id() is null or my_advisor_id() = advisor_id));

-- Editar solo sirve para desactivar el enlace (revoked_at): las aperturas las anota selection_open().
drop policy if exists "Editar selecciones propias o todas" on property_selections;
create policy "Editar selecciones propias o todas" on property_selections for update
  using ((has_admin_section('prospectos') or has_admin_section('propiedades')) and (my_advisor_id() is null or my_advisor_id() = advisor_id))
  with check ((has_admin_section('prospectos') or has_admin_section('propiedades')) and (my_advisor_id() is null or my_advisor_id() = advisor_id));

drop policy if exists "Borrar selecciones propias o todas" on property_selections;
create policy "Borrar selecciones propias o todas" on property_selections for delete
  using ((has_admin_section('prospectos') or has_admin_section('propiedades')) and (my_advisor_id() is null or my_advisor_id() = advisor_id));

-- Lo que consulta la página pública /seleccion/<token>. Token que no existe = null (la página
-- muestra «enlace no válido»). `status`: ok | expired | revoked; en los dos últimos no se anota
-- apertura y no hace falta mostrar propiedades, pero sí el asesor para que el cliente le escriba.
-- p_track = false para que el asesor vea la página como el cliente sin contar como apertura.
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
    'expires_at', s.expires_at
  );
end;
$$;

revoke all on function selection_open(text, boolean) from public;
grant execute on function selection_open(text, boolean) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Plano en la ficha (2026-11)
-- ---------------------------------------------------------------------------
-- Imagen del plano de la propiedad que se muestra en la ficha pública. Se
-- publica desde Construcción («Publicar en la ficha») o se sube desde el
-- formulario de la propiedad. Vive en el bucket público `property-images`
-- (mismas políticas de subida que las fotos). Re-ejecutable.
alter table properties add column if not exists floor_plan_url text;

