-- ─────────────────────────────────────────────
-- Bandeja de "Mensajes de contacto" en el admin (/admin/mensajes). Hasta
-- ahora contact_messages solo se podía insertar (público) y leer
-- (cualquier autenticado) — no había forma de marcarlos como atendidos ni
-- borrarlos. Se agrega un estado simple (nuevo/atendido, no un historial)
-- y las políticas de update/delete que faltaban, al mismo nivel de
-- confianza que ya tenía el select ('authenticated', sin has_admin_section
-- — mismo criterio que Propiedades/Zonas: no hay RFC/CURP/dinero aquí,
-- solo nombre/correo/teléfono/mensaje de quien llenó el formulario público).
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

alter table contact_messages add column if not exists status text not null default 'nuevo';

drop policy if exists "Authenticated update contact messages" on contact_messages;
create policy "Authenticated update contact messages" on contact_messages for update
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated delete contact messages" on contact_messages;
create policy "Authenticated delete contact messages" on contact_messages for delete
  using (auth.role() = 'authenticated');

update admin_roles
set sections = array_append(sections, 'mensajes')
where slug = 'admin' and not ('mensajes' = any(sections));

