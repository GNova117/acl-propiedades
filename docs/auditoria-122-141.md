# Auditoría: puntos 122–141 (segunda tanda)

Estado de cada punto y lo que hay que hacer **a mano**. El código está en la rama; las migraciones y los secretos no se aplican solos.

## Orden de despliegue

1. **Publicar el sitio** (merge a `main`). Todo lo del navegador y de `api/` funciona con la base vieja, salvo lo marcado «necesita migración».
2. **Aplicar las migraciones 0124 y 0125** (`npm run db:migrate`, o pegar cada archivo de `supabase/migrations/` en el SQL Editor; son re-ejecutables).
3. **Novedades sin llave maestra (128):**
   1. En Supabase → Vault, crea el secreto `novedades_token` con un valor largo y aleatorio (mínimo 20 caracteres).
   2. En GitHub → Settings → Secrets and variables → Actions, crea `SUPABASE_URL`, `SUPABASE_ANON_KEY` (la llave pública que ya usa el sitio) y `NOVEDADES_TOKEN` (el mismo valor del Vault).
   3. Abre un PR de prueba y confirma que aparece la entrada en Novedades.
   4. **Solo entonces borra el secreto viejo `SUPABASE_SERVICE_ROLE_KEY`** del repositorio. Si esa llave estuvo en GitHub, considera rotarla.
4. **Roles y accesos:** el Administrador ya trae `membrete` y `arco`. Para que alguien más atienda solicitudes ARCO, activa «Derechos ARCO» en su rol. (Los apartados nuevos aparecen en Roles y accesos gracias a este PR: `membrete` no estaba en la lista y el casillero no se veía.)
5. **Términos y condiciones (127): hace falta que lo revise un abogado.** El texto es un borrador razonable, no asesoría legal. Está en `src/i18n/locales/{es,en}.json` bajo `terms`.

## Hecho

| # | Qué cambió |
|---|---|
| 122 | Herramienta **Derechos ARCO** en el panel (`/admin/arco`, apartado `arco`). Se busca a la persona **solo por teléfono (10 dígitos) o correo completo**, nunca por nombre. Muestra lo que hay en mensajes de contacto, prospectos, alertas, citas, visitas, apartados y clientes; permite **descargar una copia** (acceso) y **borrar/anonimizar** (cancelación). Los **clientes no se borran**: su papelería se conserva 3 años (punto 121) y se avisan como «retenidos». La contraseña del portal y el NSS nunca se exportan. También se quita el nombre del registro de actividad. Cada solicitud queda en `arco_requests` con huella SHA-256 (sin el dato en claro). Migración 0125, prueba SQL `15_derechos_arco.sql`. Rectificación y oposición se atienden con las pantallas de siempre. |
| 123 | `/api/nearby-places` solo responde para coordenadas dentro de México **y** cerca de una propiedad publicada (se consulta la base); ya no sirve de intermediario gratuito de Overpass para cualquier punto del mundo. Si la base no se puede consultar, queda solo la validación de la caja. |
| 124 | `record_property_view` guarda la huella de la IP (no la IP) y no cuenta más de 40 vistas nuevas por IP por hora. Migración 0124. |
| 125 | El chat muestra, antes de escribir, que es una IA, que un proveedor externo procesa lo que se escriba, y enlaza al aviso de privacidad. |
| 126 | `contact_messages` limita nombre (200), correo (254), teléfono (40), mensaje (5,000), `details` (16 KB) y valida `channel`. Migración 0124 (`NOT VALID`: no revisa lo viejo). |
| 127 | Página `/terminos-y-condiciones`, enlace en el pie y en el mapa del sitio (borrador, ver arriba). |
| 128 | El flujo de GitHub «Novedades» ya no usa `service_role`: llama a `registrar_novedad(token, …)`, que solo inserta en `site_updates` y solo con el secreto de Vault. Migración 0124. |
| 129 | Ya estaba corregido en `main`. |
| 130 | La ficha de una propiedad vendida cambia «Agendar visita» por «Esta propiedad ya se vendió» con enlace a las disponibles. |
| 131 | La tarjeta de alertas del listado ya no se vuelve a montar con cada tecla de un filtro (no pierde lo que la persona escribía). |
| 132 | Contacto, solicitud de visita y alertas llevan cada uno su propio reloj de reenvío (`src/lib/rateLimitStore.js`); mandar uno ya no bloquea al otro. |
| 133 | Las listas del panel (mensajes, prospectos, clientes, visitas y citas) piden por páginas de 1,000 con `fetchAll`; ya no se cortan en 1,000 filas sin avisar. Prueba `fetchAll.test.js`. |
| 134 | `ThemeContext` tolera un navegador que bloquea el almacenamiento (Safari con cookies bloqueadas): el sitio ya no queda en blanco. |
| 135 | El listado trae filtro de estatus (por omisión: disponibles y apartadas; «Solo disponibles»; «Incluir vendidas»). Los conteos del inicio y del menú ya no cuentan vendidas. Migración 0124. |
| 136 | En teléfono o pantalla táctil, `/firmar` y la vista previa de documentos dibujan **todas las páginas** del PDF con pdf.js (carga bajo demanda). En escritorio sigue el visor nativo; si pdf.js falla, cae al visor nativo. |
| 137 | El encabezado, el pie y el chat tienen su propio `ErrorBoundary`: un error en uno ya no deja la página en blanco. |
| 138 | El chat del asistente solo recomienda propiedades `disponible`. |
| 139 | Ya estaba corregido en `main`. |
| 140 | Si falla la red al cargar una ficha o un artículo, se muestra «No se pudo cargar» con botón de reintentar, no «no encontrada». |
| 141 | El mapa ignora las propiedades sin coordenadas (nulas o vacías) en vez de armar límites inválidos; si ninguna tiene, se centra en Torreón. |

## Pruebas

- Unitarias: `npm test` (1,912+).
- SQL real (Postgres 16): `DATABASE_URL=… node scripts/testDb.mjs` — 15 de 15, incluye `14_limites_y_novedades.sql` y `15_derechos_arco.sql`.
- e2e nuevo: `e2e/auditoria-122-141.spec.js` (filtro de estatus, ficha vendida, términos, aviso de IA).
- El visor de PDF se verificó en un navegador real: en un iPhone emulado dibuja las 3 páginas; en escritorio usa el iframe.
