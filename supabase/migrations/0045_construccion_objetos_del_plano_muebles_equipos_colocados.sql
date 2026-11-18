-- ─────────────────────────────────────────────
-- Construcción · objetos del plano (2026-09-23) — muebles/equipos colocados
-- en el mapa (cocina, sala, recámara…). Se guardan con coordenadas absolutas
-- en metros. habitacion_id es opcional (objeto suelto / exterior).
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

create table if not exists construccion_objetos (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references construccion_proyectos(id) on delete cascade,
  habitacion_id uuid references construccion_habitaciones(id) on delete set null,
  tipo text not null,
  x numeric not null,
  z numeric not null,
  ancho numeric not null,
  largo numeric not null,
  rot_deg numeric not null default 0
);

create index if not exists idx_construccion_objetos_proyecto on construccion_objetos(proyecto_id);

alter table construccion_objetos enable row level security;

drop policy if exists "Authenticated manage construccion_objetos" on construccion_objetos;
create policy "Authenticated manage construccion_objetos" on construccion_objetos for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

