# Auditoría: puntos 221–300 (séptima tanda)

Esta tanda avanza lo que se puede arreglar sin decisiones de negocio ni rediseño. Lo que **no** se hizo queda listado abajo con su motivo.

## Despliegue

1. Publicar el sitio (merge a `main`).
2. **Aplicar la migración 0129** (`npm run db:migrate` o SQL Editor; es re-ejecutable): solo agrega índices.

## Hecho

| # | Qué cambió |
|---|---|
| 223 | El visor de fotos precarga la siguiente y la anterior: ya no cada deslizamiento espera la descarga. |
| 224 | `vercel.json`: `/assets/*` (archivos con hash) con caché de un año e inmutable. |
| 227, 275 | Foto de reemplazo propia (`public/sin-foto.svg`, sin texto ni servicio externo) en la ficha y en la tarjeta; antes `placehold.co` en inglés y, en la tarjeta, un hueco. |
| 228 | `sitemap.xml` con `s-maxage`: la caché del CDN lo sirve y el robot no consulta Supabase cada vez. |
| 230 | Migración 0129: índices en `properties(active, status)`, `(price)`, `(created_at)`, `contact_messages(created_at)`, `prospectos(created_at)` y `(phone)`. |
| 231 | Ya estaba resuelto: el mapa de Contacto solo carga al pulsar «Ver mapa». |
| 232 | Los videos del inicio piden sus metadatos cuando la tarjeta está por verse. |
| 233 | Las vistas previas del middleware llevan `Cache-Control` (5–10 min en navegador y CDN). |
| 239 | Ya estaba resuelto: el buscador global del panel es un `combobox`. |
| 240 | Los `<select>` de cada fila de Roles y accesos tienen nombre accesible (campo + correo). |
| 241–246 | Ya estaban resueltos en la renovación visual: los colores de texto, éxito y peligro tienen versión oscura y una prueba de contraste (`contrast.test.js`) los vigila. |
| 247 | Los enlaces dentro de un párrafo y del cuerpo del blog van subrayados. |
| 248 | Enfoque visible con teclado en todos los controles (`:focus-visible`), no solo en campos de formulario. |
| 262 | El menú del teléfono se cierra con Escape, bloquea el desplazamiento del fondo y su etiqueta pasa a «Cerrar menú» al abrirse. |
| 263 | Ya estaba resuelto en la tanda 201–220: `<html lang>` sigue al idioma. |
| 273 | La fecha de entrega de un desarrollo sale como «junio de 2027» (un texto libre se respeta). |
| 274 | Una renta muestra «/mes» junto al precio, en tarjeta y ficha. |
| 278 | El pie ya no habla de «locales comerciales». |
| 279 | El pie enlaza a Terrenos, Favoritos y Blog. |
| 282 | Las listas del cuerpo del blog conservan sus viñetas y números. |
| 283 | En teléfono el texto largo de un botón baja de renglón en lugar de desbordar. |
| 284 | `min-height: 100dvh` además de `100vh` (la barra de direcciones de Safari móvil ya no hace brincar el contenido). |
| 292 | La tarjeta ya no muestra «· » suelto cuando no hay zona. |
| 293 | El botón de idioma muestra el idioma **al que se cambia** («EN» en español) y su nombre accesible empieza con ese texto («EN · Switch to English»). |
| 295 | `theme-color` sigue al tema: la barra del navegador del teléfono ya no queda azul en modo oscuro. |
| 307 | El máximo del buscador dice «Sin límite» en lugar de «$10,000,000», que parecía un valor ya puesto. |
| 309 | El comparador de créditos ya no trae «Hombre» preseleccionado. |

## Pendiente (no hecho) y por qué

- **Rediseño del inicio y del encabezado** (264–270, 272, 277, 286, 296, 297, 298, 300–302, 313–320): son decisiones de diseño y contenido; conviene verlas con maqueta antes de cambiar.
- **Accesibilidad que toca varias pantallas** (249–261, 285): botones dentro de enlaces en las tarjetas, `fieldset`/`legend` en grupos de casillas, `aria-describedby` y foco en errores, `aria-live` del chat, tablas del panel, áreas táctiles, textos alternativos por foto. Merecen una tanda propia con revisión pantalla por pantalla.
- **Rendimiento que exige cambiar estructura** (221, 222, 226, 229, 234, 235, 237, 238): páginas por ciudad que bajan el catálogo dos veces, fondos como `background-image`, `AuthProvider` en el sitio público, fuentes, three.js del recorrido 360°, PDFs pesados.
- **236** (región de las funciones de Vercel): hace falta saber en qué región está tu proyecto de Supabase.
- **225** (proveedor de mapas con llave): hace falta que contrates MapTiler, Stadia o Mapbox.
- Resto de 280–339 (estilos de impresión, mapa oscuro, panel en teléfono, rentas, precio por m², etc.): pendientes de priorizar.

## Pruebas

- Unitarias: 1,959. Se actualizaron los e2e del botón de idioma (ahora `.lang-toggle`, muestra el idioma destino).
