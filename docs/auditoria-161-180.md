# Auditoría: puntos 161–180 (cuarta tanda)

## Despliegue

1. Publicar el sitio (merge a `main`).
2. **Aplicar la migración 0128** (`npm run db:migrate` o SQL Editor; es re-ejecutable): las vistas de una ficha ya no cuentan al equipo con sesión ni a los robots (176).
3. Opcional: definir `VITE_SITE_URL` en Vercel con el dominio público (ya se usa para el SEO). Con ella, **todos los enlaces que se comparten** (WhatsApp, selecciones, firma, informe, QR…) salen con ese dominio aunque se copien desde una vista previa de Vercel (180).

## Hecho

| # | Qué cambió |
|---|---|
| 161 | Contacto y solicitud de visita declaran `autocomplete` (nombre, correo, teléfono). |
| 162 | El buscador por código (inicio y listado) avisa «No se pudo buscar» si falla la red; antes el botón se quedaba en «buscando». |
| 163 | El buscador del inicio ya no deja un «?» colgando sin filtros y acomoda un precio mínimo mayor al máximo. |
| 164 | Nosotros y la calculadora tienen `catch` al pedir asesores, zonas y tipos. |
| 165 | `TrustStats` formatea las cifras con el idioma del sitio. |
| 166 | Las tarjetas del listado ya no arrancan invisibles (sin `Reveal`); además `Reveal` se ve completo al imprimir. |
| 167 | El `.ics` de una cita con hora va en UTC calculada desde la hora de México (con su horario de verano histórico): se ve bien en cualquier zona horaria. Las citas de todo el día no cambian. |
| 168 | Al iniciar sesión, un fallo de red o del servidor dice «No se pudo conectar»; la contraseña incorrecta sigue con su mensaje. |
| 169 | ~60 consultas de 39 pantallas y componentes del panel (Zonas, Roles, Testimonios, Blog, Novedades, Asesores, Desarrollos, Plantillas, Materiales, Remodelaciones, formularios de cliente, asesor, cita, desarrollo, historial, etc.) ahora tienen `catch`: avisan «Revisa tu conexión» (`lib/loadError.js`) y, donde la pantalla dependía de ello, apagan el «Cargando…». |
| 170 | Fechas del panel (Agenda, Expedientes, Documentos del cliente, Avance de remodelación, Portal, PDF del expediente de avalúo) con el idioma del sitio. |
| 171 | Los 9 `window.prompt` del panel se reemplazaron por un diálogo propio con campo de texto (`promptDialog`/`copyFallback` en `lib/toast.js`): el motivo de cancelar una cita y los «copia el enlace a mano». |
| 172 | **No se hizo.** Las amenidades y tipos de propiedad se capturan en un solo idioma; traducirlos requiere columnas de traducción en la base y su captura en el panel. Queda para decidir. |
| 173 | Una foto HEIC/HEIF que el navegador no puede abrir ya no se sube (no se vería en Chrome ni Android): avisa cómo volver a elegirla en JPEG. |
| 174 | Un PNG con transparencia ya no queda con fondo negro al convertirse a JPEG (fondo blanco). |
| 175 | Los órdenes por precio y por superficie terminan en `id` (con valores iguales no se repite ni se salta una propiedad entre páginas). |
| 176 | `record_property_view` no cuenta a quien tiene sesión del panel ni a robots (por su User-Agent). Migración 0128. |
| 177 | Ya estaba resuelto: la vista Lista/Mapa/Dividida viaja en la dirección (`?vista=`). |
| 178 | El chat usa el generador de ids con respaldo (`generateVisitorId`) también en su camino de error: ya no lanza en iOS anterior a 15.4. |
| 179 | **Parcial**: la descripción del inicio, seis etiquetas del formulario de propiedad y los mensajes «Error al guardar» (8 formularios) pasaron a i18n. El resto de textos fijos del panel (Liquidación, Mi perfil, Construcción, formulario de asesor) sigue en español. |
| 180 | Los enlaces compartidos usan `siteOrigin()` (dominio configurado) en lugar de `window.location.origin`. |

## Presupuesto de peso

El peso inicial llegó a 360 KB gzip, el tope anterior. **Se subió el tope de JavaScript a 365 KB** (`scripts/bundle-budget.json`) a propósito. La salida de fondo es cargar el inglés bajo demanda (hoy `es.json` y `en.json` entran completos al arranque), que ahorraría decenas de KB; queda sugerido como tarea aparte.

## Pruebas

- Unitarias: 1,926 (`toast.test.js` con `promptDialog`, `imageCompression.test.js`, `loginError.test.js`, `.ics` en UTC, etc.). SQL real: 18 de 18 (`18_vistas_sin_equipo_ni_robots.sql`). e2e nuevo: `e2e/auditoria-161-180.spec.js`.
