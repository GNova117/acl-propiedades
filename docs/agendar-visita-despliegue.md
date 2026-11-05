# Agendar visita con horarios reales — despliegue y configuración

Todo lo que hay que hacer **una sola vez** para activar el proyecto (fases 1 a 6) en tu Supabase real.
Ningún valor secreto va en este repo (es público): donde ves `<...>` o `re_xxx...`, pon el tuyo.

> **Nada cambia en el sitio hasta que activas el horario de un asesor** (paso 5). Puedes hacer los pasos 1 a 4
> con calma: las propiedades siguen mostrando el formulario de siempre.

## Resumen

| # | Qué | Dónde | Tiempo |
|---|---|---|---|
| 0 | Revisar requisitos | SQL Editor | 2 min |
| 1 | Ejecutar el SQL | SQL Editor — archivo `supabase/agendar-visita.sql` | 3 min |
| 2 | Desplegar 5 Edge Functions | Terminal (Supabase CLI) | 5 min |
| 3 | Secretos de las funciones | Terminal o Dashboard | 3 min |
| 4 | Prueba de humo de las funciones | Terminal | 2 min |
| 5 | Activar el horario de un asesor (piloto) | Panel `/admin` | 2 min |
| 6 | Prueba de punta a punta | Sitio + panel | 15 min |

---

## 0. Requisitos (revisión rápida)

Pega esto en **Supabase → SQL Editor** y compara con lo esperado. Solo lee, no cambia nada.

```sql
-- Extensiones: deben salir pg_cron, pg_net y pgcrypto (3 filas)
select extname from pg_extension where extname in ('pg_cron', 'pg_net', 'pgcrypto');

-- Secretos de Vault (SOLO los nombres): deben salir los 3
-- (los creó el bloque de "Avisos de agenda por WhatsApp"; si faltan, mira la nota de abajo)
select name from vault.decrypted_secrets where name in ('project_url', 'publishable_key', 'agenda_cron_secret');

-- Tablas previas: todo debe salir en true
select to_regclass('public.prospectos') is not null        as prospectos,
       to_regclass('public.property_visits') is not null    as visitas,
       to_regclass('public.agenda_citas') is not null       as agenda,
       to_regclass('public.contact_messages') is not null   as mensajes,
       to_regclass('public.property_advisors') is not null  as asesores_propiedad;

-- Columnas previas: deben salir reminder_sent_at, client_reminder_sent_at y lugar (agenda_citas)
-- y channel, details y property_id (contact_messages)
select table_name, column_name from information_schema.columns
where table_schema = 'public'
  and ((table_name = 'agenda_citas' and column_name in ('reminder_sent_at', 'client_reminder_sent_at', 'lugar'))
    or (table_name = 'contact_messages' and column_name in ('channel', 'details', 'property_id')));
```

**Si faltan secretos de Vault** (`project_url`, `publishable_key`, `agenda_cron_secret`): significa que los avisos
de Agenda por WhatsApp nunca se configuraron. Se crean una sola vez en el SQL Editor con
`select vault.create_secret('<valor>', 'project_url');` (y lo mismo para los otros dos). `project_url` es
`https://<tu-proyecto>.supabase.co`, `publishable_key` es la llave pública (anon/publishable) del proyecto y
`agenda_cron_secret` es una frase larga y aleatoria que **debe ser idéntica** al secreto `CRON_SECRET` del paso 3.

**Si faltan tablas o columnas:** tu base no está al día con `supabase/schema.sql`; ejecuta primero lo que falte de ese archivo.

---

## 1. Ejecutar el SQL

1. Abre **`supabase/agendar-visita.sql`** (en este repo).
2. Cópialo **completo** → **Supabase → SQL Editor → New query** → pega → **Run**.
3. Es **re-ejecutable**: si algo se interrumpe, vuelve a correrlo entero. No duplica nada.

Crea: 4 tablas (`advisor_visit_settings`, `advisor_availability`, `advisor_time_off`, `visit_booking_attempts`),
columnas nuevas en `agenda_citas` y `property_visits`, 13 funciones, 3 triggers y 1 job de `pg_cron`
(`visita-recordatorios`, cada 15 minutos). No toca datos existentes: las citas que ya tenías quedan como
`confirmada` / `admin`.

**Verifica** (debe salir todo lo indicado):

```sql
select proname from pg_proc
where proname in ('get_visit_slots','book_visit','get_booking','get_booking_slots','reschedule_booking',
                  'cancel_booking','confirm_booking_attendance','visit_promote_prospect','notify_visit_email')
order by 1;                                            -- 9 filas

select tgname from pg_trigger
where tgname in ('trg_notify_visit_email','trg_agenda_citas_reset_reminders','trg_agenda_citas_sync_prospect');  -- 3 filas

select jobname, schedule, active from cron.job where jobname = 'visita-recordatorios';   -- */15 * * * *  | true
```

---

## 2. Desplegar las Edge Functions

Desde la raíz del repo, con la [Supabase CLI](https://supabase.com/docs/guides/cli) instalada:

```bash
supabase login
supabase link --project-ref <tu-project-ref>        # el ref está en Project Settings → General

# Dos funciones NUEVAS
supabase functions deploy visita-correo         --no-verify-jwt
supabase functions deploy visita-recordatorios  --no-verify-jwt

# Tres funciones de Agenda que CAMBIARON (ahora ignoran citas canceladas; la tercera cubre visitas del sitio)
supabase functions deploy agenda-recordatorio-cliente --no-verify-jwt
supabase functions deploy agenda-recordatorio-30min   --no-verify-jwt
supabase functions deploy agenda-resumen-diario       --no-verify-jwt
```

- **`--no-verify-jwt` es obligatorio**: estas funciones las llama la base de datos (no un navegador) y se
  protegen con su propio `x-cron-secret`, igual que las demás de Agenda. Sin la bandera, el gateway rechaza
  la llamada con 401 antes de que corra el código.
- **Orden:** el SQL del paso 1 va **antes** que las 3 funciones de Agenda (filtran por la columna nueva
  `status`; sin ella fallarían).
- Las dos funciones nuevas usan código común de `supabase/functions/_shared/`; la CLI lo incluye sola, no hay
  que desplegarlo aparte.
- Sin la CLI: **Dashboard → Edge Functions → New function** y, en cada una, **Verify JWT = off**. La CLI es
  mucho más cómoda porque sube el código compartido.

---

## 3. Secretos de las funciones

Los secretos de Edge Functions son **del proyecto** (los comparten todas las funciones). Primero mira cuáles ya hay:

```bash
supabase secrets list
```

El resumen semanal y las alertas ya usan casi todo; probablemente solo tengas que revisar.

| Secreto | ¿Obligatorio? | Valor | Notas |
|---|---|---|---|
| `RESEND_API_KEY` | **Sí** | `re_...` (Resend → API Keys) | La misma de `enviar-correo` y las alertas. Sin ella, `visita-correo` y `visita-recordatorios` responden 500 y **no se manda ningún correo** (la reserva sí funciona). |
| `CRON_SECRET` | **Sí** | La misma frase que guardaste en Vault como `agenda_cron_secret` | Ya existe si funcionan los avisos de Agenda. Si no coincide, las llamadas de la base reciben 401. |
| `SITE_URL` | Recomendado | `https://tu-dominio.com` (sin `/` al final) | De aquí sale el enlace de cada correo (`/visita/<token>`). Por omisión usa `https://acl-propiedades.vercel.app`: **ponlo si tu dominio real es otro**. |
| `RESEND_FROM` | Opcional | `ACL Propiedades <avisos@aclpropiedades.com>` | Remitente. Por omisión usa ese mismo valor. |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Automáticos | — | Los inyecta Supabase; no los pongas tú. |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` | Ya existen | — | Solo los usa el recordatorio de WhatsApp (`agenda-recordatorio-cliente`), sin cambios. |

Para poner o cambiar uno:

```bash
supabase secrets set RESEND_API_KEY=<re_tu_llave>
supabase secrets set SITE_URL=https://<tu-dominio>
supabase secrets set RESEND_FROM="ACL Propiedades <avisos@aclpropiedades.com>"
```

(O en el Dashboard: **Edge Functions → Secrets**.) Los cambios de secretos se aplican en segundos; no hace falta redesplegar.

**En Resend** (resend.com): el dominio del remitente (`aclpropiedades.com`) debe aparecer como **Verified**
(registros SPF y DKIM en tu DNS). Si no está verificado, Resend rechaza los envíos con 403.

> 🔒 No pegues la API key en el chat, en un issue ni en el repo. Solo en la terminal o en el Dashboard.

**No hay que cambiar nada** en Vercel (el sitio no usa variables nuevas) ni en Meta (no hay plantillas nuevas de
WhatsApp: se sigue usando `recordatorio_cita_cliente`). `VITE_GA_MEASUREMENT_ID` sigue siendo opcional: si lo
tienes, ahora también registra los eventos `visit_slot_selected` y `visit_booked`.

---

## 4. Prueba de humo de las funciones

Comprueba que están desplegadas y que aceptan tu `CRON_SECRET`. Como todavía no hay reservas del sitio, **no manda ningún correo** (esta función solo manda recordatorios de visitas reservadas que estén en su ventana):

```bash
export PROJECT_URL="https://<tu-proyecto>.supabase.co"
export CRON_SECRET="<la-misma-frase-de-vault>"

curl -s -X POST "$PROJECT_URL/functions/v1/visita-recordatorios" \
  -H "x-cron-secret: $CRON_SECRET" -H "Content-Type: application/json" -d '{}'
# Esperado: {"results":{}}        (sin visitas en ventana de recordatorio todavía)

curl -s -o /dev/null -w "%{http_code}\n" -X POST "$PROJECT_URL/functions/v1/visita-recordatorios" \
  -H "x-cron-secret: incorrecto" -d '{}'
# Esperado: 401                   (rechaza un secreto equivocado)
```

| Respuesta | Qué significa |
|---|---|
| `{"results":{}}` | ✅ Desplegada, secreto correcto y Resend configurado |
| `401 unauthorized` | `CRON_SECRET` distinto del que usas aquí → revísalo (paso 3) |
| `{"error":"RESEND_API_KEY no configurado"}` | Falta ese secreto (paso 3) |
| `404` | La función no está desplegada (paso 2) |

---

## 5. Activar el horario de un asesor (piloto)

Hazlo con **uno o dos asesores** primero. Hasta que alguien lo active, ninguna ficha ofrece horarios.

1. Entra al panel con el rol de oficina → **Propiedades → Asesores** → editar un asesor
   (o el propio asesor, desde **Mi perfil**).
2. Baja a **"Horario para recibir visitas"** → marca **"Permitir que los clientes agenden visitas en línea"**.
3. Pon el horario semanal (por omisión conviene lun–sáb 10:00–18:00), la duración de cada visita (60 min),
   la anticipación mínima (2 h) y los días hacia adelante (14). Revisa la vista previa → **Guardar**.

Permisos por rol (**Roles y accesos**): el editor necesita el apartado **`agenda`**; registrar visitas
(`/admin/visitas`), **`visitas`**; ver el prospecto que se crea, **`prospectos`**; las métricas, **`prospectos`**
más **`agenda`**.

---

## 6. Prueba de punta a punta

Con un correo **tuyo** y, si puedes, en una ventana privada del navegador:

| # | Haz esto | Debe pasar |
|---|---|---|
| 1 | Ficha de una propiedad **de ese asesor** → **Agendar visita** → elige día y hora → tus datos → **Confirmar visita** | Pantalla "¡Tu visita está agendada!". En 1–2 min llega el correo **"Tu visita está agendada"** con el `.ics` adjunto |
| 2 | Panel → **Agenda** | La cita aparece con "Sitio web" y "Sin confirmar asistencia" |
| 3 | Panel → **Mensajes** | Llegó el aviso (y, si está configurado, el WhatsApp al asesor y a la oficina) |
| 4 | Panel → **Prospectos** | Hay un prospecto "interesado", fuente "Visita agendada en el sitio", con seguimiento el **día siguiente** a la visita |
| 5 | Abre el enlace del correo → **Confirmo que asistiré** | La Agenda muestra "Cliente confirmó" |
| 6 | **Cambiar horario** → otro horario | Correo "Cambiamos tu visita" con `.ics` actualizado; en Mensajes, "Visita reprogramada por el cliente"; el seguimiento del prospecto se mueve |
| 7 | **Cancelar visita** | Correo "Visita cancelada"; en Mensajes, "Visita cancelada por el cliente"; el seguimiento pasa a mañana |
| 8 | Reserva otra para ≥ 27 h adelante y otra para ≥ 5 h adelante | Recibes el recordatorio de ~24 h (con botón de confirmar) y el de ~2 h (con mapa). *No se manda recordatorio de una visita agendada o movida hace menos de 3 h* |
| 9 | Agenda → **Realizada** → "Registrar visita" | El formulario abre prellenado; al guardar, la cita queda "Visita registrada" y el prospecto se actualiza |
| 10 | **Estadísticas del embudo** | Aparece el bloque "Visitas agendadas desde el sitio" con la asistencia |

Cuando termines, borra de la Agenda y de Prospectos lo que creaste para la prueba.

---

## Si algo no funciona

Primero mira si el trigger llegó a la función:

```sql
-- Últimas llamadas que la base hizo a las funciones (status_code 200 = bien)
select id, status_code, left(content::text, 200) as respuesta, created
from net._http_response order by created desc limit 10;

-- ¿Corre el cron de recordatorios?
select jobid, status, return_message, start_time from cron.job_run_details order by start_time desc limit 10;
```

Y los registros de la función: **Dashboard → Edge Functions → `visita-correo` (o `visita-recordatorios`) → Logs**.

| Síntoma | Causa probable | Arreglo |
|---|---|---|
| La reserva funciona pero **no llega el correo** | Falta `RESEND_API_KEY`, o el dominio no está verificado en Resend, o cayó en spam | Paso 3; mira el log de `visita-correo` |
| `status_code` 401 en `net._http_response` | `CRON_SECRET` ≠ `agenda_cron_secret` de Vault | Haz que sean la misma frase |
| `status_code` 404 | `visita-correo` no está desplegada | Paso 2 |
| El enlace del correo apunta a otro dominio | `SITE_URL` sin poner o mal puesto | Paso 3 |
| En los logs de Postgres: `notify_visit_email: no se pudo encolar el correo` | Falta un secreto de Vault o `pg_net` apagado | Paso 0. La reserva **no** se afecta |
| Las funciones de Agenda dan error de columna `status` | Se desplegaron antes que el SQL | Corre el SQL (paso 1) y vuelve a desplegarlas |
| El visitante no ve horarios en la ficha | Ningún asesor de esa propiedad tiene el horario activado (o no tiene ventanas) | Paso 5 |

## Cómo apagarlo (sin borrar datos)

```sql
-- Dejar de ofrecer reservas en el sitio (vuelve el formulario de siempre)
update advisor_visit_settings set enabled = false;

-- Dejar de mandar correos de confirmación y cambios
drop trigger if exists trg_notify_visit_email on agenda_citas;

-- Dejar de mandar recordatorios por correo
select cron.unschedule('visita-recordatorios');
```

Volver a ejecutar `supabase/agendar-visita.sql` recrea el trigger y el cron.

## Cosas que conviene saber

- Las visitas **reservadas antes** de la fase 6 no tienen prospecto ligado (solo las nuevas).
- Los correos van en **español**.
- Las visitas que el equipo crea a mano en la Agenda **no** mandan correo (solo las reservadas desde el sitio).
- Cada correo de recordatorio se manda **una sola vez**; si falla el envío, se reintenta en la siguiente corrida (cada 15 min).
- Para volver a generar `supabase/agendar-visita.sql` tras un cambio en `schema.sql`, copia el bloque final de
  `schema.sql` (desde "Agendar visita con horarios reales") debajo del encabezado; la prueba
  `supabase/agendarVisitaSql.test.js` avisa si se desfasan.
