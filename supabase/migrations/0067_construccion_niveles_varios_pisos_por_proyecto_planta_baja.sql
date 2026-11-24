-- ─────────────────────────────────────────────
-- Construcción · niveles (2026-10-02) — varios pisos por proyecto (planta baja,
-- planta alta…). `construccion_niveles` + `nivel_id` en cuartos y objetos.
-- Los proyectos que ya existen NO necesitan migración: sus cuartos quedan con
-- nivel_id nulo y la pantalla les crea "Planta baja" al abrirlos (se guarda en
-- el siguiente cambio). Mismo acceso que el resto de construccion_*.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────
create table if not exists construccion_niveles (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references construccion_proyectos(id) on delete cascade,
  nombre text not null,
  orden int not null default 0
);

create index if not exists idx_construccion_niveles_proyecto on construccion_niveles(proyecto_id);

alter table construccion_habitaciones add column if not exists nivel_id uuid references construccion_niveles(id) on delete set null;

do $$
begin
  if to_regclass('public.construccion_objetos') is not null then
    execute 'alter table construccion_objetos add column if not exists nivel_id uuid references construccion_niveles(id) on delete set null';
  end if;
end $$;

alter table construccion_niveles enable row level security;

drop policy if exists "Authenticated manage construccion_niveles" on construccion_niveles;
create policy "Authenticated manage construccion_niveles" on construccion_niveles for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

