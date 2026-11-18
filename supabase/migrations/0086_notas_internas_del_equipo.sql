-- ─────────────────────────────────────────────
-- Notas internas del equipo (2026-10-15)
-- Comunicación interna simple sobre un cliente, prospecto o propiedad: una
-- nota de texto, con quién la escribió y a quién etiqueta (mentions, correos
-- de asesores) para que quede visible quién debería verla — sin manejar aquí
-- el envío de la notificación en sí (eso ya es responsabilidad de
-- push_subscriptions / las Edge Functions existentes, fuera de este cambio).
-- Visible/editable por cualquier cuenta autenticada, igual que otras tablas
-- de uso interno del equipo (p. ej. zones, advisors): no se gatea por un
-- apartado nuevo porque ya se monta solo dentro de pantallas que sí lo están
-- (ficha de cliente, prospecto o propiedad).
-- ─────────────────────────────────────────────

create table if not exists internal_notes (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('client', 'prospect', 'property')),
  entity_id uuid not null,
  author_email text not null,
  body text not null,
  mentions text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_internal_notes_entity on internal_notes(entity_type, entity_id);

alter table internal_notes enable row level security;

drop policy if exists "Authenticated manage internal_notes" on internal_notes;
create policy "Authenticated manage internal_notes" on internal_notes for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

