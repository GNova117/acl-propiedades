-- ─────────────────────────────────────────────
-- Agenda: lugar de la cita
-- ─────────────────────────────────────────────
-- Dirección o referencia de la cita. Alimenta el enlace "Cómo llegar" (Google
-- Maps) y el archivo de calendario (.ics) de la Agenda. Re-ejecutable; correrlo
-- antes de desplegar no es indispensable: sin la columna, guardar una cita sin
-- lugar sigue funcionando (el campo solo se manda cuando se captura).
alter table agenda_citas add column if not exists lugar text;

