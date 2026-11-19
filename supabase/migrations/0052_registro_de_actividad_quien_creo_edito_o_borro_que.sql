-- ─────────────────────────────────────────────
-- Registro de actividad (2026-09-25) — quién creó, editó o borró qué.
-- Lo escriben TRIGGERS de la base (no el navegador), así que no se puede
-- saltar desde la app ni borrar desde ella: audit_log solo tiene política de
-- lectura, y solo para roles con el apartado 'roles' (administradores).
-- Guarda quién (correo), cuándo, en qué tabla, qué acción, una etiqueta del
-- registro (nombre/título) y, en ediciones, el NOMBRE de las columnas que
-- cambiaron — nunca los valores: así no se copian datos sensibles (RFC, CURP,
-- contraseñas de portales) a otra tabla. actor vacío = visitante del sitio o
-- proceso automático del sistema.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

create table if not exists audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor text,
  table_name text not null,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  row_id text,
  label text,
  changed text[]
);

create index if not exists idx_audit_log_at on audit_log(at desc);
create index if not exists idx_audit_log_table on audit_log(table_name, at desc);

alter table audit_log enable row level security;

drop policy if exists "Roles con apartado roles ven el registro de actividad" on audit_log;
create policy "Roles con apartado roles ven el registro de actividad" on audit_log for select
  using (has_admin_section('roles'));

-- Sin políticas de escritura: nadie desde la app puede insertar, editar ni
-- borrar el registro (solo el trigger, que corre como dueño).
revoke insert, update, delete, truncate on audit_log from anon, authenticated;

create or replace function audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  j jsonb;
  o jsonb;
  changed_cols text[];
begin
  if tg_op = 'DELETE' then
    j := to_jsonb(old);
  else
    j := to_jsonb(new);
  end if;

  if tg_op = 'UPDATE' then
    o := to_jsonb(old);
    select array_agg(k order by k) into changed_cols
    from jsonb_object_keys(j) k
    where k <> 'updated_at' and (j -> k) is distinct from (o -> k);
    -- Si lo único que cambió fue updated_at, no vale la pena registrarlo.
    if changed_cols is null then
      return new;
    end if;
  end if;

  insert into audit_log (actor, table_name, action, row_id, label, changed)
  values (
    auth.email(),
    tg_table_name,
    tg_op,
    coalesce(j ->> 'id', j ->> 'property_id'),
    left(coalesce(j ->> 'name', j ->> 'title', j ->> 'reference', j ->> 'key_label', j ->> 'address', j ->> 'email', j ->> 'doc_type', j ->> 'slug', j ->> 'id'), 120),
    changed_cols
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- El trigger no necesita que nadie pueda llamarla a mano.
revoke execute on function audit_row_change() from public, anon, authenticated;

-- Se instala en las tablas de negocio que existan (si alguna aún no existe en
-- tu base, se omite sin error).
do $$
declare
  t text;
begin
  foreach t in array array[
    'properties', 'property_advisors', 'property_types', 'zones', 'advisors', 'amenities_catalog',
    'clients', 'client_documents', 'client_links', 'perfilamientos', 'perfilamientos_comprador',
    'prospectos', 'contact_messages', 'testimonials', 'valuation_estimates', 'property_visits',
    'property_report_links', 'liquidaciones', 'ventas', 'property_budgets', 'property_log',
    'remodel_projects', 'agenda_citas', 'agenda_expedientes', 'secretaria_llaves', 'secretaria_documentos',
    'construccion_proyectos', 'materials_catalog', 'labor_catalog', 'admin_roles', 'admin_access'
  ]
  loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists trg_audit_row_change on %I', t);
      execute format('create trigger trg_audit_row_change after insert or update or delete on %I for each row execute function audit_row_change()', t);
    end if;
  end loop;
end;
$$;

