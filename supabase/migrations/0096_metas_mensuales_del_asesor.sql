-- ─────────────────────────────────────────────
-- Metas mensuales del asesor (2026-10)
-- ─────────────────────────────────────────────
-- Una fila por asesor con su meta mensual (se repite cada mes hasta que la
-- cambie): contactos, visitas, prospectos nuevos y ventas; 0 = sin meta en eso.
-- Cada asesor lee y edita solo la suya (my_advisor_id(), el asesor vinculado a
-- su login en /admin/roles). El avance se calcula en el navegador con datos que
-- ya existen (src/lib/goals.js); aquí no se guarda nada más. Re-ejecutable. Sin
-- correrlo, "Mi mes" se muestra sin meta y guardar avisa que falta la tabla.
create table if not exists advisor_goals (
  advisor_id uuid primary key references advisors(id) on delete cascade,
  contacts int not null default 0 check (contacts between 0 and 9999),
  visits int not null default 0 check (visits between 0 and 9999),
  new_prospects int not null default 0 check (new_prospects between 0 and 9999),
  sales int not null default 0 check (sales between 0 and 9999),
  updated_at timestamptz not null default now()
);

alter table advisor_goals enable row level security;

drop policy if exists "Asesor ve y edita su meta" on advisor_goals;
create policy "Asesor ve y edita su meta" on advisor_goals for all
  using (my_advisor_id() is not null and my_advisor_id() = advisor_id)
  with check (my_advisor_id() is not null and my_advisor_id() = advisor_id);

