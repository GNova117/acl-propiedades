-- ─────────────────────────────────────────────
-- Construcción · croquis a borrador con IA (2026-10-02) — api/sketch-to-plan.js
-- le pide a Claude (visión, sin búsqueda web) que transcriba los cuartos de la
-- foto de un croquis a mano. Esta tabla NO guarda la imagen ni el resultado,
-- solo una fila por consulta (quién y cuándo) para el tope diario — mismo
-- propósito que el conteo de market_snapshots en api/market-comps.js, pero
-- sin nada que mostrar en pantalla (no hay caché: cada croquis es distinto).
-- Requiere el apartado 'construccion' bajo el JWT de quien llama (igual que
-- market-comps exige 'valuacion'), no solo estar autenticado.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────
create table if not exists construccion_sketch_usage (
  id uuid primary key default gen_random_uuid(),
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists idx_construccion_sketch_usage_created on construccion_sketch_usage(created_at desc);

alter table construccion_sketch_usage enable row level security;

drop policy if exists "Rol con apartado construccion usa sketch_usage" on construccion_sketch_usage;
create policy "Rol con apartado construccion usa sketch_usage" on construccion_sketch_usage for all
  using (has_admin_section('construccion')) with check (has_admin_section('construccion'));

