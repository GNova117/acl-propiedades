-- ─────────────────────────────────────────────
-- Prospectos ligados a cliente y a mensaje + canal de los mensajes (2026-09-25)
-- - prospectos.client_id: el cliente en que se convirtió el prospecto.
-- - prospectos.message_id (único): mensaje del sitio del que salió, para no
--   pasarlo a prospecto dos veces.
-- - contact_messages.channel: 'formulario' (Contacto), 'solicitud' (pedir que
--   me contacten en una propiedad) o 'whatsapp' (botón de WhatsApp de la ficha).
--   El insert público sigue igual (with check (true)); los mensajes viejos
--   quedan como 'formulario'.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────
alter table prospectos add column if not exists client_id uuid references clients(id) on delete set null;
alter table prospectos add column if not exists message_id uuid unique references contact_messages(id) on delete set null;
alter table contact_messages add column if not exists channel text not null default 'formulario';

