# Lo que falta para poner en marcha el PR #42 (en orden)

Supuesto: **producción tiene todo lo que había en `main`** (hasta «Selección de propiedades en un solo enlace»). Si no es así, avísame antes de correr nada.

## 1. SQL (Supabase → SQL Editor)

Archivo: **`supabase/pendiente-de-aplicar.sql`** — pégalo **completo** y ejecútalo **una vez** (es re-ejecutable: si se corta, lo vuelves a correr entero).

Trae, en orden: Listado y ficha · Avisos por correo al cliente del portal · Encuesta tras la visita · Ofertas y apartados + calendario de la Agenda · Contratos, comisiones y fusión de prospectos · Freno de envíos públicos · Verificación en dos pasos y dispositivos · Monitoreo de errores (programa un cron cada 30 min) · Tiempo real · Conteo por tipo.

Verificado contra un Postgres 16 real: se aplica sobre el estado de `main`, una segunda pasada no falla y pasan las pruebas de SQL. **No verificado contra tu Supabase real.**

Después, **una sola vez**, desde tu computadora (necesita `psql` y la cadena de conexión «Session pooler»):

```bash
export DATABASE_URL='postgresql://postgres.…@…pooler.supabase.com:5432/postgres'
npm run db:migrate -- baseline --through 0114   # marca las migraciones como aplicadas, SIN ejecutarlas
npm run db:migrate -- status                    # debe decir 114 aplicadas, 0 pendientes
```

(De ahí en adelante el SQL nuevo va como migración: `npm run migration:new -- "Qué hace"`.)

## 2. Supabase (panel)

1. **Authentication → Multi-Factor:** activar **TOTP**. Sin esto, «Seguridad → verificación en dos pasos» no funciona.
2. **Edge Functions:**
   - **Nuevas** (con la verificación de JWT **desactivada**, `--no-verify-jwt`): `errores-aviso`, `portal-avisos`.
   - **Nueva** (con JWT activado, la llama el panel): `invitar-usuario`.
   - **Volver a desplegar** (cambió la plantilla de correo): `visita-correo`, `visita-recordatorios`, `alertas-propiedades`, `reporte-semanal`, `enviar-correo`.
3. **Secretos de las funciones:** ya deben existir `CRON_SECRET`, `RESEND_API_KEY`. Agregar/revisar: `SITE_URL` (`supabase secrets set SITE_URL=https://tu-dominio`), opcional `RESEND_FROM` (con el dominio verificado en Resend) y `ERRORS_REPORT_TO` (a quién avisar de errores; por omisión, los administradores).
4. **Vault** (para los crons nuevos): deben existir `project_url`, `publishable_key` y `agenda_cron_secret` (ya los usan los avisos anteriores).

## 3. Vercel (variables de entorno)

| Variable | Para qué | ¿Obligatoria? |
|---|---|---|
| `SITE_URL` y `VITE_SITE_URL` | Dirección pública (sitemap, vistas previas, canonical). Solo cambian cuando compres el dominio propio. | No (usa la de Vercel) |
| `VITE_LINKEDIN_URL`, `VITE_INSTAGRAM_URL` | Iconos del pie del sitio | No (sin ellas no aparecen) |
| `VITE_GOOGLE_REVIEW_URL` | Invitar a reseñar en Google a quien califica 4 o 5 | No |
| `VITE_HERO_IMAGE_URL`, `VITE_HERO_VIDEO_URL`, `VITE_HERO_POSTER_URL` | Foto o video propio en la portada | No (necesita material tuyo) |
| `VITE_IDLE_LOGOUT_MINUTES` | Minutos de inactividad antes de cerrar sesión del panel (30 por omisión; 0 la apaga) | No |

Después de cambiar variables, **redesplegar**.

## 4. GitHub

1. **Secretos** (Settings → Secrets and variables → Actions) para los respaldos: `SUPABASE_DB_URL` (Session pooler), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `BACKUP_PASSPHRASE` (guárdala también en tu gestor de contraseñas: sin ella no se abren los respaldos).
2. **Correr «Respaldo» a mano una vez** (Actions → Respaldo → Run workflow) y confirmar que termina en verde y deja el artefacto. Es la prueba real; todavía no se ha corrido.
3. **Dependabot** ya está configurado: solo hay que revisar y aceptar sus PRs (lunes).
4. Los trabajos de CI `sql` y `lighthouse` ya corrieron en este PR; `lighthouse` pasa tras corregir la ficha.

## 5. Google Analytics

Admin → Eventos → **marcar como «evento clave»** los que quieras contar como conversión: `generate_lead`, `contact_whatsapp`, `contact_phone`, `visit_booked`, `visit_requested`.

## 6. Pruebas manuales recomendadas antes de confiar

- Entrar al panel, **activar la verificación en dos pasos** con tu teléfono, cerrar sesión y volver a entrar.
- Mandarte **un correo de cada tipo** (confirmación de visita, recordatorio, aviso de alerta, resumen semanal, aviso de errores) y revisar que lleguen con el diseño de ACL.
- Provocar un error de prueba y ver que aparece en `/admin/errores` y llega el correo.
- Abrir el sitio con el Analytics real y comprobar que los mapas, el geocodificador y las rutas siguen cargando (se endureció la política de seguridad y esos servicios externos no se pudieron probar desde aquí). Si algo no carga, el remedio inmediato está en `vercel.json` (cambiar `Content-Security-Policy` a `Content-Security-Policy-Report-Only`).
- Instalar el sitio en un teléfono («ACL Propiedades») y abrir una propiedad por su enlace nuevo.

## 7. Decisiones y cosas del negocio

- **Comprar y apuntar el dominio propio** (luego `SITE_URL`/`VITE_SITE_URL` y `RESEND_FROM`).
- **Direcciones reales** de LinkedIn e Instagram.
- **Fotos o video propios de La Laguna** para la portada.
- **Aviso de privacidad:** el registro de errores guarda el navegador y la ruta (sin parámetros) de quien visita; conviene que quien lleve lo legal lo revise.
- **Crear un proyecto de Supabase aparte (staging)** para probar Auth/MFA, Realtime, Storage y correos antes de producción (guía en `docs/migraciones-y-pruebas-de-sql.md`).
- Si alguien pierde el teléfono con la verificación en dos pasos, **no hay códigos de recuperación**: un administrador debe quitarle el factor desde el panel de Supabase.

## 8. Lo que NO se hizo (queda como trabajo futuro)

Bandeja de WhatsApp en el panel (29) · Publicación en portales (43) · Páginas generadas en el servidor (77) · Avisos push para clientes (parte del 99) · Turnstile (82) · Fotos AVIF (88) · Sincronización de dos vías con Google Calendar (35) · Cerrar un dispositivo por uno (85) · Subir fotos en «Vende tu casa» · Revisión de tipos de todo el JavaScript (93, solo 134 archivos) · Las 167 etiquetas del panel que siguen solo en español.
