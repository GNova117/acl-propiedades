-- ─────────────────────────────────────────────
-- Agenda por asesor: cada asesor ve solo sus propias citas; un correo con
-- el apartado 'agenda' pero SIN asesor vinculado (admin_access.advisor_id
-- null) ve las de todos — así "administración" no es un rol especial, es
-- simplemente un acceso al que no se le vinculó ningún asesor. Vincular un
-- correo a un asesor se hace desde /admin/roles (nueva columna "Asesor" en
-- la tabla de accesos).
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

alter table admin_access add column if not exists advisor_id uuid references advisors(id) on delete set null;

create table if not exists agenda_citas (
  id uuid primary key default gen_random_uuid(),
  advisor_id uuid not null references advisors(id) on delete cascade,
  client_id uuid references clients(id) on delete set null,
  titulo text not null,
  fecha date not null,
  hora time,
  actividades text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists agenda_expedientes (
  id uuid primary key default gen_random_uuid(),
  cita_id uuid not null references agenda_citas(id) on delete cascade,
  file_path text not null,
  file_name text,
  created_at timestamptz not null default now()
);

create index if not exists idx_agenda_citas_advisor on agenda_citas(advisor_id);
create index if not exists idx_agenda_citas_fecha on agenda_citas(fecha);
create index if not exists idx_agenda_expedientes_cita on agenda_expedientes(cita_id);

alter table agenda_citas enable row level security;
alter table agenda_expedientes enable row level security;

-- security definer, mismo motivo que has_admin_section: consultar
-- admin_access desde las políticas de agenda_citas sin recursión.
create or replace function my_advisor_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select advisor_id from admin_access where email = auth.email();
$$;

drop policy if exists "Ver citas propias o todas con agenda" on agenda_citas;
create policy "Ver citas propias o todas con agenda" on agenda_citas for select
  using (has_admin_section('agenda') and (my_advisor_id() is null or my_advisor_id() = advisor_id));

drop policy if exists "Crear citas propias o todas con agenda" on agenda_citas;
create policy "Crear citas propias o todas con agenda" on agenda_citas for insert
  with check (has_admin_section('agenda') and (my_advisor_id() is null or my_advisor_id() = advisor_id));

drop policy if exists "Editar citas propias o todas con agenda" on agenda_citas;
create policy "Editar citas propias o todas con agenda" on agenda_citas for update
  using (has_admin_section('agenda') and (my_advisor_id() is null or my_advisor_id() = advisor_id))
  with check (has_admin_section('agenda') and (my_advisor_id() is null or my_advisor_id() = advisor_id));

drop policy if exists "Borrar citas propias o todas con agenda" on agenda_citas;
create policy "Borrar citas propias o todas con agenda" on agenda_citas for delete
  using (has_admin_section('agenda') and (my_advisor_id() is null or my_advisor_id() = advisor_id));

drop policy if exists "Gestionar expedientes de citas propias o todas" on agenda_expedientes;
create policy "Gestionar expedientes de citas propias o todas" on agenda_expedientes for all
  using (
    has_admin_section('agenda') and exists (
      select 1 from agenda_citas c
      where c.id = agenda_expedientes.cita_id
        and (my_advisor_id() is null or my_advisor_id() = c.advisor_id)
    )
  )
  with check (
    has_admin_section('agenda') and exists (
      select 1 from agenda_citas c
      where c.id = agenda_expedientes.cita_id
        and (my_advisor_id() is null or my_advisor_id() = c.advisor_id)
    )
  );

-- Bucket PRIVADO, mismo patrón que client-documents/remodel-progress. Sin
-- aislamiento por asesor a nivel de Storage (igual que client-documents):
-- cualquier correo con el apartado 'agenda' puede leer/subir cualquier
-- objeto del bucket — el aislamiento real de "solo mis citas" vive en las
-- políticas de agenda_citas/agenda_expedientes de arriba, no aquí.
insert into storage.buckets (id, name, public)
values ('agenda-expedientes', 'agenda-expedientes', false)
on conflict (id) do nothing;

drop policy if exists "Rol con apartado agenda ve expedientes" on storage.objects;
create policy "Rol con apartado agenda ve expedientes" on storage.objects
  for select using (bucket_id = 'agenda-expedientes' and has_admin_section('agenda'));

drop policy if exists "Rol con apartado agenda sube expedientes" on storage.objects;
create policy "Rol con apartado agenda sube expedientes" on storage.objects
  for insert with check (bucket_id = 'agenda-expedientes' and has_admin_section('agenda'));

drop policy if exists "Rol con apartado agenda borra expedientes" on storage.objects;
create policy "Rol con apartado agenda borra expedientes" on storage.objects
  for delete using (bucket_id = 'agenda-expedientes' and has_admin_section('agenda'));

update admin_roles
set sections = array_append(sections, 'agenda')
where slug in ('admin', 'asesores') and not ('agenda' = any(sections));

