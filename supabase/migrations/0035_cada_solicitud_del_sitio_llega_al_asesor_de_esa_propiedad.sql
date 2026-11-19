-- ─────────────────────────────────────────────
-- Cada solicitud del sitio llega al asesor de esa propiedad
-- (2026-09-17). Hasta ahora un contact_message no sabía de qué propiedad
-- venía: el título iba dentro del texto y el aviso por WhatsApp llegaba
-- siempre a los mismos números de oficina. Se agrega property_id (lo
-- llenan la tarjeta "¿Te interesa esta propiedad?" y "Agendar visita" de
-- la ficha pública; los mensajes del formulario de Contacto lo dejan en
-- null a propósito, son generales).
--
-- El asesor NO se copia en una columna: se deriva de property_advisors al
-- momento de leer/avisar. Si mañana se reasigna la propiedad, el mensaje
-- viejo apunta a quien la lleva hoy, que es a quien hay que buscar para
-- darle seguimiento. `on delete set null` conserva el mensaje aunque se
-- borre la propiedad (perder el dato de contacto de un interesado sería
-- peor que perder el vínculo).
--
-- Quién VE qué no cambia: cualquier correo con el apartado 'mensajes'
-- sigue viendo la bandeja completa (decisión explícita del negocio) — la
-- columna "Propiedad / asesor" y el filtro por asesor de /admin/mensajes
-- son de UI, no de RLS. Si algún día se quiere aislar de verdad por
-- asesor, el patrón a copiar es el de agenda_citas (my_advisor_id()).
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

alter table contact_messages add column if not exists property_id uuid references properties(id) on delete set null;

create index if not exists idx_contact_messages_property on contact_messages(property_id);

-- Mismo trigger de siempre, pero ahora resuelve los teléfonos de los
-- asesores de la propiedad y se los pasa a la función en el body. Se hace
-- aquí (y no dentro de la Edge Function) porque el trigger ya está en la
-- base con permisos para leerlo, y así la función sigue sin consultar
-- Supabase. Prefiere el WhatsApp del asesor sobre su teléfono normal,
-- ignora asesores inactivos y a los que no tienen ningún número.
create or replace function notify_new_contact_message() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  advisor_phones jsonb := '[]'::jsonb;
begin
  if new.property_id is not null then
    select coalesce(jsonb_agg(numero), '[]'::jsonb) into advisor_phones
    from (
      select coalesce(nullif(btrim(a.whatsapp), ''), nullif(btrim(a.phone), '')) as numero
      from property_advisors pa
      join advisors a on a.id = pa.advisor_id
      where pa.property_id = new.property_id
        and a.active
    ) s
    where numero is not null;
  end if;

  perform net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/mensaje-contacto-whatsapp',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key'),
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'agenda_cron_secret')
    ),
    body := jsonb_build_object(
      'name', new.name,
      'phone', new.phone,
      'message', new.message,
      'advisorPhones', advisor_phones
    )
  );
  return new;
end;
$$;

