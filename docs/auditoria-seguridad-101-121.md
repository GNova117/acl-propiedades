# Seguridad y privacidad: puntos 101–121 de la auditoría

Estado de cada punto y lo que hay que hacer **a mano** para que surta efecto. El código ya está en la rama; la migración y la función de correo no se aplican solos.

## Orden de despliegue

1. **Publicar el sitio** (merge a `main`). Ya pide solo las columnas públicas de los asesores y lee el contacto del equipo y de las selecciones por funciones nuevas, así que funciona igual con la base vieja y con la nueva.
2. **Aplicar la migración `supabase/migrations/0118_seguridad_lectura_publica_correo_del_staff_y_limites_por_ip.sql`** (con `npm run db:migrate` o pegándola en el SQL Editor de Supabase). Es re-ejecutable. Hace los puntos 102, 103, 104 y 112 y crea la tabla del 101.
3. **Desplegar la función** `enviar-correo` (`supabase functions deploy enviar-correo`), con "Enforce JWT Verification" activado como hasta ahora. Usa `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY`, que Supabase inyecta; no hay variables nuevas.
4. **Probar** con la sesión de un asesor: Visitas → enviar informe por correo, y Gastos → enviar desglose. Con la llave anon (por ejemplo con `curl`) debe responder 401.

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

## Revisados y no cambiados

- **106 (`/admin/panel` sin `RequireSection`)**: era un falso positivo mío. Cada bloque del panel principal solo pide sus datos si el rol tiene ese apartado (`hasSection`), así que un rol sin apartados ve el panel vacío, no cifras del negocio. Lo único visible para todos es el resumen de Analytics, y está así a propósito (comentado en el código).
- **107 (descargar tablas completas para contarlas)**: sigue pendiente, pero no es una fuga: solo se piden las tablas de los apartados que el rol ya tiene. Es un tema de rendimiento (consultas de conteo) y conviene hacerlo junto con el punto de paginar las listas.

## Pendientes que necesitan una decisión

- **109 (`plantilla_acl.pdf` pública)**: la usan los PDF que se arman en el navegador. Si alguna página sin sesión la necesita (informe del vendedor) no puede ir a almacenamiento privado. Es una hoja con logotipo y membrete: falsificar con ella no requiere el archivo. ¿Se mueve de todos modos (para el panel) o se deja?
- **114 (ubicación aproximada)**: ocultar el punto en el mapa no basta, porque `lat`/`lng` exactos siguen en la API pública. Hay que decidir si se difuminan en la base (por ejemplo, redondear a ~300 m al publicar y guardar las exactas aparte).
- **116 (enlaces con token sin caducidad visible)**: es trabajo de interfaz en cada página con token; se puede hacer junto con "revocar desde el panel".
- **120 (un solo `CRON_SECRET`)**: separarlo implica cambiar cada tarea de `pg_cron` y su función a la vez, y volver a sembrar los secretos en Vault.
- **121 (retención)**: hay que fijar cuánto tiempo se guarda cada cosa (INE, CURP, chat, mensajes) antes de programar el borrado.
