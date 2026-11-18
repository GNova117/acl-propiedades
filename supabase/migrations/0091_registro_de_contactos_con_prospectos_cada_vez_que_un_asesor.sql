-- ─────────────────────────────────────────────
-- Registro de contactos con prospectos (2026-10-19): cada vez que un asesor
-- marca "Registrar contacto" en Prospectos queda una fila aquí (canal, nota
-- opcional, quién y cuándo) — es el historial que se ve al editar el
-- prospecto. Además de esta fila, la app actualiza prospectos.last_contact_at,
-- la etapa (nuevo → contactado) y el próximo seguimiento.
-- Cada asesor ve y registra contactos solo de SUS prospectos (las políticas
-- preguntan a prospectos, que ya aplica su propio RLS). Es un historial: nadie
-- edita ni borra filas desde la app (se borran solas con el prospecto).
-- actor lo llena la base con el correo de quien registra y la política exige
-- que coincida, para que nadie firme un contacto a nombre de otra persona.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

create table if not exists prospecto_contactos (
  id bigint generated always as identity primary key,
  prospecto_id uuid not null references prospectos(id) on delete cascade,
  channel text not null check (channel in ('llamada', 'whatsapp', 'correo', 'presencial')),
  note text,
  at timestamptz not null default now(),
  actor text default auth.email()
);

create index if not exists idx_prospecto_contactos_prospecto on prospecto_contactos(prospecto_id, at desc);

alter table prospecto_contactos enable row level security;

drop policy if exists "Ver contactos de mis prospectos" on prospecto_contactos;
create policy "Ver contactos de mis prospectos" on prospecto_contactos for select
  using (exists (select 1 from prospectos p where p.id = prospecto_contactos.prospecto_id));

drop policy if exists "Registrar contactos de mis prospectos" on prospecto_contactos;
create policy "Registrar contactos de mis prospectos" on prospecto_contactos for insert
  with check (
    actor is not distinct from auth.email()
    and exists (select 1 from prospectos p where p.id = prospecto_contactos.prospecto_id)
  );

revoke all on prospecto_contactos from anon;
revoke update, delete, truncate on prospecto_contactos from authenticated;

