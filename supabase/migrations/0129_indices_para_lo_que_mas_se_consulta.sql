-- ─────────────────────────────────────────────
-- Índices para lo que más se consulta (2026-11-26)
-- · properties: el listado público filtra por activa + estatus y ordena por fecha o precio; el panel ordena por fecha.
-- · contact_messages y prospectos: las listas del panel ordenan por fecha de creación (y las limpiezas diarias de 0127 las recorren).
-- · prospectos(phone): detección de duplicados y búsqueda por teléfono.
-- Son solo índices (no cambian datos); `if not exists` los hace re-ejecutables.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

create index if not exists idx_properties_active_status on properties(active, status);
create index if not exists idx_properties_price on properties(price);
create index if not exists idx_properties_created_at on properties(created_at desc);
create index if not exists idx_contact_messages_created_at on contact_messages(created_at desc);
create index if not exists idx_prospectos_created_at on prospectos(created_at desc);
create index if not exists idx_prospectos_phone on prospectos(phone);
