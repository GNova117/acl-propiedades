-- ─────────────────────────────────────────────
-- Visitas e informe para el vendedor (2026-09-23) — registro interno +
-- enlace privado de solo lectura (/informe/<token>)
-- `property_visits`: una fila por recorrido de un prospecto a una propiedad
-- (fecha y hora, asesor, interés, motivos de objeción, comentarios). Cada
-- asesor ve y edita solo SUS visitas; un correo con el apartado 'visitas' pero
-- SIN asesor vinculado (admin_access.advisor_id null) ve las de todos — el
-- mismo patrón de "propias o todas" de agenda_citas (my_advisor_id()).
-- `prospect_name` e `internal_notes` son SOLO internos: el informe del
-- vendedor nunca los recibe, y eso lo garantiza la base de datos, no el front:
-- el informe sale de visit_report() / visit_report_by_token(), que arman el
-- JSON con una lista cerrada de campos (fecha, interés, motivos, comentario)
-- y nada más — ni el nombre del prospecto, ni el asesor, ni las notas internas.
-- `property_report_links`: el enlace secreto de cada propiedad. Quien lo tenga
-- ve el informe SIN iniciar sesión (solo ese informe: las tablas siguen
-- cerradas); regenerar el token invalida el enlace anterior y borrar la fila
-- lo desactiva. El token es un uuid sin guiones (122 bits aleatorios).
-- `_visit_report_payload` es interna: se le quita EXECUTE a anon/authenticated
-- porque, sin token ni permiso, cualquiera podría pedir el informe de
-- cualquier propiedad solo con su id.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

create table if not exists property_visits (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  advisor_id uuid references advisors(id) on delete set null,
  visited_at timestamptz not null,
  prospect_name text, -- interno: nunca sale en el informe del vendedor
  interest text not null check (interest in ('muy_interesado', 'interesado', 'oferta_realizada', 'descartado')),
  reasons text[] not null default '{}', -- ubicacion, precio, espacios, conservacion, distribucion: libre a propósito (agregar una categoría no requiere SQL)
  comments text, -- lo ve el vendedor (sin nombre del prospecto)
  internal_notes text, -- interno: nunca sale en el informe del vendedor
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_property_visits_property on property_visits(property_id, visited_at desc);
create index if not exists idx_property_visits_advisor on property_visits(advisor_id);

alter table property_visits enable row level security;

drop policy if exists "Ver visitas propias o todas con visitas" on property_visits;
create policy "Ver visitas propias o todas con visitas" on property_visits for select
  using (has_admin_section('visitas') and (my_advisor_id() is null or my_advisor_id() = advisor_id));

drop policy if exists "Crear visitas propias o todas con visitas" on property_visits;
create policy "Crear visitas propias o todas con visitas" on property_visits for insert
  with check (has_admin_section('visitas') and (my_advisor_id() is null or my_advisor_id() = advisor_id));

drop policy if exists "Editar visitas propias o todas con visitas" on property_visits;
create policy "Editar visitas propias o todas con visitas" on property_visits for update
  using (has_admin_section('visitas') and (my_advisor_id() is null or my_advisor_id() = advisor_id))
  with check (has_admin_section('visitas') and (my_advisor_id() is null or my_advisor_id() = advisor_id));

drop policy if exists "Borrar visitas propias o todas con visitas" on property_visits;
create policy "Borrar visitas propias o todas con visitas" on property_visits for delete
  using (has_admin_section('visitas') and (my_advisor_id() is null or my_advisor_id() = advisor_id));

create table if not exists property_report_links (
  property_id uuid primary key references properties(id) on delete cascade,
  token text not null unique default replace(gen_random_uuid()::text, '-', '')
    check (token ~ '^[0-9a-f]{32}$'), -- nunca un token corto/adivinable, aunque el front se equivoque
  created_by text,
  created_at timestamptz not null default now()
);

alter table property_report_links enable row level security;

drop policy if exists "Rol con apartado visitas maneja property_report_links" on property_report_links;
create policy "Rol con apartado visitas maneja property_report_links" on property_report_links for all
  using (has_admin_section('visitas')) with check (has_admin_section('visitas'));

-- El informe completo de UNA propiedad, ya anonimizado. security definer: lee
-- property_visits sin importar quién llama (por eso el JSON se arma aquí, con
-- una lista cerrada de campos, y no se le da a nadie la tabla). Las visitas
-- van de la más reciente a la más antigua. `sold_on` solo cuando la propiedad
-- está vendida, para dejar de contar los días en el mercado.
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
    ), '[]'::jsonb)
  )
  from properties p
  where p.id = p_property_id;
$$;

-- Vista previa para el personal: el MISMO informe que recibe el vendedor, con
-- las visitas de todos los asesores (una visita ajena no se ve en la tabla de
-- property_visits por RLS, pero sí cuenta en el informe de la propiedad).
create or replace function visit_report(p_property_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not has_admin_section('visitas') then
    raise exception 'Sin acceso al apartado Visitas' using errcode = '42501';
  end if;
  return _visit_report_payload(p_property_id);
end;
$$;

-- Lo que consulta la página pública /informe/<token>. Token inexistente,
-- regenerado o desactivado = null (la página muestra "enlace no válido").
create or replace function visit_report_by_token(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select _visit_report_payload(l.property_id)
  from property_report_links l
  where l.token = p_token;
$$;

revoke all on function _visit_report_payload(uuid) from public, anon, authenticated;
revoke all on function visit_report(uuid) from public, anon;
grant execute on function visit_report(uuid) to authenticated;
revoke all on function visit_report_by_token(text) from public;
grant execute on function visit_report_by_token(text) to anon, authenticated;

update admin_roles
set sections = array_append(sections, 'visitas')
where slug in ('admin', 'asesores') and not ('visitas' = any(sections));

