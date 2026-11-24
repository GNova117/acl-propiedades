-- ─────────────────────────────────────────────
-- Secretaría (2026-09-24) — bitácora de control de llaves y bitácora de
-- entradas/salidas de documentos. Solo internas: RLS con el apartado
-- 'secretaria' (asignable desde /admin/roles).
-- ─────────────────────────────────────────────
create table if not exists secretaria_llaves (
  id uuid primary key default gen_random_uuid(),
  logged_at timestamptz not null default now(), -- fecha y hora de entrega
  address text not null,                        -- dirección / casa
  key_label text not null,                      -- ID / nombre de la llave (ej. P-01)
  receiver_name text not null,
  receiver_phone text,
  signed_delivery boolean not null default false,
  returned_at timestamptz,                      -- null = la llave sigue prestada
  signed_reception boolean not null default false,
  notes text,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists idx_secretaria_llaves_fecha on secretaria_llaves(logged_at desc);

create table if not exists secretaria_documentos (
  id uuid primary key default gen_random_uuid(),
  logged_at timestamptz not null default now(),
  doc_type text not null,                       -- escrituras, contrato, etc.
  property_client text not null,                -- propiedad / cliente
  movement text not null check (movement in ('entrada', 'salida')),
  person_name text not null,                    -- quien entrega / recoge
  person_id text,                               -- identificación / contacto
  signed boolean not null default false,        -- firma de conformidad
  secretary_name text,                          -- responsable en Secretaría
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists idx_secretaria_documentos_fecha on secretaria_documentos(logged_at desc);

alter table secretaria_llaves enable row level security;
alter table secretaria_documentos enable row level security;

drop policy if exists "Rol con apartado secretaria maneja secretaria_llaves" on secretaria_llaves;
create policy "Rol con apartado secretaria maneja secretaria_llaves" on secretaria_llaves for all
  using (has_admin_section('secretaria')) with check (has_admin_section('secretaria'));

drop policy if exists "Rol con apartado secretaria maneja secretaria_documentos" on secretaria_documentos;
create policy "Rol con apartado secretaria maneja secretaria_documentos" on secretaria_documentos for all
  using (has_admin_section('secretaria')) with check (has_admin_section('secretaria'));

update admin_roles
set sections = array_append(sections, 'secretaria')
where slug = 'admin' and not ('secretaria' = any(sections));

