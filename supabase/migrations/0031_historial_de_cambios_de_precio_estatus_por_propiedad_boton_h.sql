-- ─────────────────────────────────────────────
-- Historial de cambios de precio/estatus por propiedad (botón "Historial"
-- en /admin/propiedades y /admin/naves-industriales). Se registra con un
-- trigger after update en properties, no desde el código del admin — así
-- queda capturado sin importar qué pantalla hizo el cambio, y no se puede
-- omitir por accidente. security definer + auth.email() por el mismo
-- motivo que has_admin_section()/my_advisor_id(): adentro del trigger
-- necesita insertar en property_changes aunque quien hizo el update no
-- tenga permiso de insert ahí directamente (no hay política de insert
-- para 'authenticated' a propósito, así el historial no se puede editar
-- ni borrar desde la app, solo lo escribe el trigger).
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

create table if not exists property_changes (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  changed_by text,
  field text not null,
  old_value text,
  new_value text,
  created_at timestamptz not null default now()
);

create index if not exists idx_property_changes_property on property_changes(property_id);

alter table property_changes enable row level security;

drop policy if exists "Authenticated read property_changes" on property_changes;
create policy "Authenticated read property_changes" on property_changes for select
  using (auth.role() = 'authenticated');

create or replace function log_property_changes() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor text := auth.email();
begin
  if new.price is distinct from old.price then
    insert into property_changes (property_id, changed_by, field, old_value, new_value)
    values (new.id, actor, 'price', old.price::text, new.price::text);
  end if;
  if new.status is distinct from old.status then
    insert into property_changes (property_id, changed_by, field, old_value, new_value)
    values (new.id, actor, 'status', old.status, new.status);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_log_property_changes on properties;
create trigger trg_log_property_changes
after update on properties
for each row execute function log_property_changes();

