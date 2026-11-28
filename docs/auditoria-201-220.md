# Auditoría: puntos 201–220 (sexta tanda)

## Resultado principal: el sitio baja 100 KB de JavaScript al abrirse

El peso inicial pasó de **360 KB a 260 KB** (gzip). Salió del paquete inicial el backend de demostración con sus datos y fotos (216), el inglés (215) y la geometría de Construcción (217). El tope del presupuesto (`scripts/bundle-budget.json`) bajó de 365 a **275 KB** para conservar la ganancia.

## Despliegue

Sin migraciones ni pasos manuales: publicar el sitio (merge a `main`). El inglés y el backend de demostración quedan como archivos aparte que solo se descargan cuando hacen falta. Si en algún momento se despliega **sin** las variables de Supabase, el sitio sigue funcionando en modo demostración (descarga el backend local al arrancar).

## Hecho

| # | Qué cambió |
|---|---|
| 201 | El cuerpo del blog admite `## subtítulo`, `### subtítulo menor`, listas (`- ` y `1. `), `[enlaces](/ruta o https://…)`, `![imágenes](https://…)` y `**negritas**` (`lib/blogMarkdown.js`). Sin HTML crudo (se pinta con elementos de React) y los enlaces `javascript:` se descartan. Un artículo de solo párrafos se ve igual que antes. |
| 202 | A quien navega en inglés se le avisa que los artículos están solo en español, y el texto del artículo lleva `lang="es"`. No se tradujeron los artículos. |
| 203 | **No se hizo.** Una ruta desconocida responde 200 con la aplicación (404 «suave»); responder 404 de verdad exige listar en el servidor todas las rutas válidas, y se desactualiza con cada página nueva. La pantalla sí dice «404» y lleva `noindex`. |
| 204 | La descripción de `index.html` y la del inicio ya no anuncian naves industriales. |
| 205 | Las imágenes de vista previa propias ya eran de 1200 × 630 (`/api/og` y la de la marca); ahora se declara `og:image:width/height` (en el middleware y en `Seo`). Las imágenes de fuera (portada de un artículo) no declaran tamaño. |
| 206 | El sitemap incluye hasta 10 fotos por propiedad (`image:image`) para Google Imágenes (`server/sitemapXml.js`, con pruebas). |
| 207 | `robots.txt` bloquea también `/comparar` y `/alertas/`. |
| 208 | Ya estaba resuelto: `Seo` pone `og:locale` (`es_MX` / `en_US`). |
| 209 | Una propiedad que ya no existe manda al listado de su tipo (terreno → `/terrenos`, nave → `/naves-industriales`) según el título de la dirección. Una vendida sigue mostrando su ficha con «ya se vendió» y sugerencias. |
| 210 | Los textos del inicio salen de un solo lugar (`lib/siteCopy.js`), usado por el middleware; una prueba comprueba que `index.html` y el español del inicio digan lo mismo. |
| 211 | El título de una propiedad vendida o rentada dice «Vendida · Casa en Torreón» (también la vista previa de WhatsApp), no «en Venta — $precio». |
| 212 | Las propiedades vendidas o rentadas salen del sitemap 45 días después de su último cambio. |
| 213 | **No se hizo.** El píxel de Meta y la etiqueta de conversión de Google Ads necesitan los identificadores de las cuentas publicitarias; cuando los tengas se agregan detrás del aviso de cookies (ya existe el consentimiento para Google Analytics). |
| 214 | La pantalla de carga de 1.5 s solo sale la primera vez de la sesión y nunca en el panel ni en los enlaces privados (firma, documentos, visita, registro, informe, opinión, selección). |
| 215 | **Inglés bajo demanda**: solo el español viaja en el paquete inicial; el inglés se baja con `?lang=en`, con el idioma guardado o al tocar el botón de idioma (antes de cambiar, para que no haya parpadeo en español). |
| 216 | El backend de demostración (localStorage) y sus datos semilla con fotos solo se importan si no hay Supabase configurado. |
| 217 | La sincronización de Construcción (planos, geometría) se baja solo al entrar a esa pantalla del panel. |
| 218 | Los tipos de propiedad se piden una sola vez cuando varias piezas de la pantalla los piden a la vez (antes hasta 4 consultas iguales); se suelta el resultado al editar tipos. |
| 219 | Favoritos, Comparar, Selección y «Vistos recientemente» piden sus propiedades en una sola consulta y en el orden de la lista (antes una por propiedad). |
| 220 | La ficha ya no baja todo el catálogo del mismo tipo para elegir 4 similares: pide las de la misma zona (5) y, si faltan, 8 del tipo. |

## Pruebas

- Unitarias 1,950+ (parser del blog, reglas del sitemap, copia del inicio, inglés bajo demanda, consultas compartidas, enlace de propiedad inexistente, horas de visita…). e2e nuevo: `e2e/auditoria-201-220.spec.js` (inglés desde el primer pintado, botón de idioma, pantalla de carga, título de vendida, robots, favoritos).
