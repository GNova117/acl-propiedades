-- ─────────────────────────────────────────────
-- Plantillas de documentos personalizadas (2026-10-15)
-- El generador de documentos (/admin/documentos-legales) solo tenía 3 tipos
-- fijos (recibo de apartado, autorización de venta, carta oferta), definidos
-- en código. Esta tabla deja que el equipo cree sus propios tipos de
-- documento desde el admin, con marcadores como {{cliente.nombre}} o
-- {{propiedad.precio}} que se rellenan al generar el PDF — sin que un
-- desarrollador tenga que tocar código para cada documento nuevo.
-- custom_fields: arreglo de { key, label, type } para datos que no vienen
-- de un cliente/propiedad/asesor ya capturado (type: text | number | date).
-- Mismo apartado que Documentos legales, para no abrir un permiso nuevo.
-- ─────────────────────────────────────────────

create table if not exists document_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  body text not null,
  custom_fields jsonb not null default '[]',
  requires_signatures boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table document_templates enable row level security;

drop policy if exists "Rol con apartado documentos_legales maneja document_templates" on document_templates;
create policy "Rol con apartado documentos_legales maneja document_templates" on document_templates for all
  using (has_admin_section('documentos_legales')) with check (has_admin_section('documentos_legales'));

