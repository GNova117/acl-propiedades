# Seguridad y privacidad: puntos 101–121 de la auditoría

Estado de cada punto y lo que hay que hacer **a mano** para que surta efecto. El código ya está en la rama; la migración y la función de correo no se aplican solos.

## Orden de despliegue

1. **Publicar el sitio** (merge a `main`). Ya pide solo columnas públicas de asesores y lee el contacto del equipo, de las selecciones y del enlace de registro por funciones nuevas, así que funciona igual con la base vieja y con la nueva.
2. **Desplegar las funciones de Edge** (`supabase functions deploy <nombre>`): `enviar-correo`, `depurar-papeleria` (nueva) y las 12 que dispara la base (`agenda-recordatorio-30min`, `agenda-recordatorio-cliente`, `agenda-resumen-diario`, `alertas-propiedades`, `enviar-push`, `errores-aviso`, `mensaje-contacto-whatsapp`, `portal-avisos`, `reporte-semanal`, `seguimientos-resumen-diario`, `visita-correo`, `visita-recordatorios`). Las doce aceptan el secreto por función **y** el maestro mientras `CRON_ACCEPT_SHARED_SECRET` no valga `false`, así que desplegarlas antes de la base no rompe nada.
3. **Aplicar las migraciones 0118 a 0123** (`npm run db:migrate`, o pegar cada archivo de `supabase/migrations/` en el SQL Editor; son re-ejecutables):
   - `0118` seguridad de lectura pública, correo del staff, límites por IP y cubetas (101–104, 112).
   - `0119` apartado `membrete` (109).
   - `0120` ubicación aproximada (114).
   - `0121` vigencia de enlaces con token y contacto del asesor por función (116).
   - `0122` secretos por función programada (120).
   - `0123` papelería de 3 años y trabajo mensual de depuración (121).
4. **Roles y accesos → activar «Plantilla membretada»** en el rol de los asesores (el Administrador ya la trae). Quien no la tenga sigue generando PDF, pero sobre una hoja en blanco.
5. **Probar**: enviar un informe por correo desde Visitas con un asesor; generar un PDF con un asesor con y sin el apartado; abrir `/nosotros`, un enlace de selección y uno de registro sin sesión (deben mostrar el contacto del asesor).
6. **Cuando todo funcione, apagar la transición del punto 120**: `supabase secrets set CRON_ACCEPT_SHARED_SECRET=false`. Desde ahí solo valen los secretos por función.
7. **La depuración (121) arranca como simulacro.** Revisa la tarjeta «Papelería de clientes» en Roles y accesos después de la primera corrida (día 1 de cada mes) y, si la lista es la esperada, actívala: `supabase secrets set RETENTION_PURGE_ENABLED=true`.

## Hecho

| # | Qué cambió |
|---|---|
| 101 | `enviar-correo` ahora exige un usuario real (no la llave anon) con el apartado `visitas` o `gastos`, un solo destinatario válido, solo PDF como adjunto, tamaños acotados y 30 envíos por hora por usuario (tabla `email_send_log`). Lógica con pruebas en `supabase/functions/enviar-correo/handler.js`. |
| 102 | Política de `properties` y `property_advisors`: el público solo lee las activas; el personal con sesión sigue viendo todas. La ficha trata una propiedad desactivada como "no encontrada" para quien no tenga sesión, y la vista previa del personal lleva `noindex`. |
| 103 | `advisors`: el público solo lee asesores activos y solo `id, name, photo_url, bio, active, show_in_team, created_at`. El teléfono, correo y WhatsApp salen por `team_advisors()` (solo equipo publicado, para `/nosotros`) y `selection_advisor(token)` (para quien tiene el enlace de una selección, también vencida, como antes). El panel sigue viendo todo. |
| 104 | El chat limita además por IP (80 por hora, 200 por día; ajustable con `CHAT_IP_HOURLY_LIMIT` y `CHAT_IP_DAILY_LIMIT`), guardada como huella HMAC, no en claro. Si falta la columna `ip_hash` el tope se omite y todo sigue como antes. |
| 105 | Exportar CSV antepone `'` a celdas de texto que empiezan con `= + - @`, tabulador o retorno. Los números no se tocan. |
| 108 | Las fotos reescaladas se usan siempre (aunque no pesen menos), así que pierden el EXIF. Límite: una foto que el navegador no puede decodificar (HEIC fuera de Safari) se sube tal cual. |
| 110, 115 | `/api/chat` y `/api/analytics-summary` ya no devuelven `err.message`; el detalle queda en los registros del servidor. |
| 111 | Google Analytics recibe `/alertas/baja/:token` sin el token (y `page_location` explícito). |
| 112 | Las cubetas públicas aceptan solo imágenes y con tope de tamaño (15 MB; 30 MB en 360°). Solo afecta subidas nuevas. |
| 113 | Aviso de cookies (aceptar / rechazar, y "Preferencias de cookies" en el pie): Google Analytics solo se carga si se acepta. Solo aparece si el sitio tiene `VITE_GA_MEASUREMENT_ID`. El mapa de Google de Contacto se carga solo al pulsar "Ver mapa". |
| 117 | `Seo` acepta `noindex`; lo usan el 404, Favoritos, Comparar, la baja de alertas, una ficha o artículo "no encontrado" y una ficha desactivada. |
| 119 | Aviso de privacidad ampliado (datos que se recaban, proveedores y transferencias fuera de México, asistente con IA, firma electrónica, cookies). **Pide revisión de quien lleve lo legal antes de publicarlo**: describe lo que hace el sistema, pero el texto es mío. |

Además: el chat ya no le dice a la persona "quedó registrado" si el prospecto no se guardó (punto 129 de la auditoría).

## Hechos en la segunda tanda (109, 114, 116, 120, 121)

| # | Qué cambió |
|---|---|
| 109 | `plantilla_acl.pdf` ya no es público: vive en `server/assets/` y solo la entrega `/api/plantilla` (dentro de `api/media.js`, porque el plan Hobby de Vercel permite 12 funciones por despliegue y ya estábamos en el tope) a quien tenga sesión **y** el apartado `membrete` en su rol. Sin acceso, los 17 generadores de PDF dibujan el mismo contenido sobre una hoja carta en blanco (ayudante único en `src/lib/letterhead.js`). **Efecto a la vista:** la Guía del comprador y el documento firmado que baja un cliente salen sin membrete. |
| 114 | Casilla «Ubicación aproximada» en el formulario de la propiedad. Con ella, las coordenadas exactas se guardan aparte (`property_exact_location`, solo roles con Propiedades) y `properties.lat/lng` —lo que lee el público— queda difuminado (hasta ~350 m, estable por propiedad). En el sitio: círculo de 500 m en el mapa, solo la zona (sin calle), sin «Cómo llegar», Street View, Waze ni tiempo de traslado, y sin `streetAddress` en el JSON-LD. **Limitación:** el campo «Dirección» se publica tal cual; en estas propiedades hay que capturar solo la colonia. |
| 116 | Las páginas de firma, documentos, registro y el informe del vendedor dicen «Este enlace vence el …» (la selección ya lo hacía). El enlace del informe ya no dura para siempre: 180 días desde que se crea o regenera (`property_report_links.expires_at`; los que ya existían cuentan desde la migración). Revocar desde el panel ya existía en selecciones, firmas, portal, registro e informe. La página de registro dejó de leer el teléfono del asesor de la tabla (la migración 0118 lo cierra): ahora llega con el estado del enlace. El enlace de la cita (`/visita/`) no vence por tiempo: depende de la fecha de la visita y el cliente puede cancelarla. |
| 120 | Cada función programada tiene su secreto, derivado por HMAC-SHA256 del `CRON_SECRET` con el nombre de la función. La base lo calcula con `cron_secret_for('<función>')` y reescribe sola los 9 trabajos de pg_cron y las 6 funciones de trigger que mandaban el maestro; el maestro ya no viaja en ninguna llamada y el de una función no abre otra. Para probar una función a mano: `echo -n "enviar-push" \| openssl dgst -sha256 -hmac "$CRON_SECRET"`. |
| 121 | La papelería de clientes (`client_documents` y los expedientes de avalúo de la Agenda) se conserva **3 años desde la última actividad con el cliente** (lo más reciente entre alta/edición, documento capturado, movimiento del trámite y última cita). `papeleria_vencida()` lista lo vencido; la función `depurar-papeleria` corre el día 1 de cada mes y borra primero el archivo y luego la fila. **Es un simulacro hasta activar `RETENTION_PURGE_ENABLED=true`.** No toca al cliente, sus ventas ni su historial. |

La parte de SQL de 114, 116, 120 y 121 (y la de 101 a 104 y 112) se probó contra un Postgres 16 real con las pruebas de `supabase/testdb/tests/` (09 a 13): permisos de lectura pública y por rol, difuminado estable, vencimientos, secretos derivados, cálculo de los 3 años en los bordes (2 años 11 meses no vence, 3 años 1 mes sí).

## Revisados y no cambiados

- **106 (`/admin/panel` sin `RequireSection`)**: era un falso positivo mío. Cada bloque del panel principal solo pide sus datos si el rol tiene ese apartado (`hasSection`), así que un rol sin apartados ve el panel vacío, no cifras del negocio.
- **107 (descargar tablas completas para contarlas)**: sigue pendiente, pero no es una fuga: solo se piden las tablas de los apartados que el rol ya tiene. Es un tema de rendimiento (consultas de conteo).

## Fuera de alcance de la regla de 3 años (lo que NO se depura)

Los chats con el asistente no se guardan en el servidor (solo un registro con huella de IP para los límites), y los mensajes de contacto, prospectos y contratos firmados no tienen regla de retención todavía: la indicación fue solo para la papelería de clientes.
