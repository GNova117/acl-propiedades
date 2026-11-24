-- ─────────────────────────────────────────────
-- Estimación de valor · ligada a cliente y propiedad (2026-09-25).
-- Si el cliente o la propiedad se borra, la estimación se conserva (queda
-- solo con su referencia). (bloque re-ejecutable)
-- ─────────────────────────────────────────────
alter table valuation_estimates add column if not exists client_id uuid references clients(id) on delete set null;
alter table valuation_estimates add column if not exists property_id uuid references properties(id) on delete set null;
create index if not exists idx_valuation_estimates_client on valuation_estimates(client_id);

