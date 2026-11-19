# Auditoría del sitio y del panel — áreas de oportunidad

**406 puntos nuevos**, numerados del 101 al 506 para que continúen tu lista de 100. Ninguno repite lo que ya está en ella; cuando un punto toca un tema de tu lista, aclara qué parte es distinta.

Revisión del 18 de noviembre de 2026 sobre la rama actual: lectura del código (sitio, panel, funciones de `api/`, funciones de Supabase, `schema.sql`, CI), el sitio compilado abierto en Chromium en computadora (1366×800) y teléfono (390×844), revisión automática de accesibilidad con axe en 36 pantallas públicas y del panel, más compilación, linter, pruebas y verificación de tipos.

**Estado al revisar:** 1,209 pruebas pasan, la compilación funciona (con un aviso de bloques de más de 500 kB), el linter da 0 errores y 19 avisos, y la verificación de tipos de los archivos TS pasa. En el navegador no hubo errores de JavaScript en ninguna pantalla en modo demostración. (Las fotos de Unsplash no cargaron porque el entorno de prueba no tiene salida a ese dominio; no se cuenta como hallazgo.)

Los puntos con ⚠️ son los que recomiendo atender primero: fallas de seguridad, pérdida de datos o de prospectos, o errores que el cliente ve.


## Resumen

| Categoría | Puntos | Números |
|---|---:|---|
| Seguridad y privacidad | 28 | 101–128 |
| Errores de funcionamiento | 57 | 129–185 |
| SEO, vista previa y medición | 28 | 186–213 |
| Rendimiento | 25 | 214–238 |
| Accesibilidad | 25 | 239–263 |
| Diseño del sitio público | 60 | 264–323 |
| Diseño del panel | 14 | 324–337 |
| Utilidad para clientes (sitio público) | 69 | 338–406 |
| Utilidad para asesores (panel) | 70 | 407–476 |
| Sistema, datos y desarrollo | 30 | 477–506 |
| **Total** | **406** | 101–506 |


## Lo más urgente

- **101.** `enviar-correo` (Edge Function) solo exige "un JWT válido" y la llave anon clásica del sitio público lo es: cualquiera puede mandar correos con el remitente de la empresa a quien quiera.
- **102.** La política `Public can read active properties` es `using (true)`: cualquiera lee TODAS las propiedades, incluidas las desactivadas/borradores, con `select *` desde la API pública.
- **103.** `Public can read active advisors` es `using (true)` y la ficha pide `advisors(*)`: teléfono, correo y WhatsApp personales de todos los asesores (incluso inactivos) quedan expuestos en la API pública, aunque la ficha ya no los muestra a propósito.
- **104.** Chat: el límite diario del chat es global: alguien que rote el `sessionId` (lo genera el navegador) agota el cupo del día y apaga el chat para todos.
- **105.** Exportar CSV no neutraliza celdas que empiezan con `= + - @`: un nombre capturado en un formulario público como `=HYPERLINK(...)` se ejecuta como fórmula al abrirlo en Excel.
- **106.** /admin/panel (Panel principal con cifras de todo el negocio) no tiene `RequireSection`: cualquier rol lo abre por URL.
- **107.** El panel principal descarga la tabla completa de clientes (descifrada, con datos personales) solo para contarla; igual prospectos, mensajes, citas y ventas.
- **108.** Si la compresión no reduce el tamaño o falla, la foto se sube tal cual con sus metadatos EXIF (puede incluir la ubicación GPS y el modelo del teléfono).
- **109.** La hoja membretada `plantilla_acl.pdf` es pública en /plantilla_acl.pdf: cualquiera puede descargarla y usarla para falsificar documentos con el membrete.
- **129.** Chat: `onLead` no revisa el error del insert en `prospectos`: si falla, el bot igual dice "ya quedó registrado" y el prospecto se pierde.
- **130.** Ficha: a una propiedad vendida se le puede pedir visita: la tarjeta "Agendar visita" se muestra siempre (solo la barra móvil se oculta).
- **131.** Listado: la tarjeta de alertas usa `key={JSON.stringify(criteria)}`: cada tecla en un filtro la vuelve a montar y borra lo que la persona estaba escribiendo en su nombre/WhatsApp.
- **132.** Formularios: contacto y solicitud de visita comparten la llave `acl_contact_last_submit`: tras mandar uno, el otro queda bloqueado 60 s con "espera un minuto".
- **133.** Las listas del panel (mensajes, prospectos, clientes, visitas, citas) piden `select("*")` sin límite: Supabase corta en 1,000 filas por omisión y lo de más ya no aparece, sin aviso.
- **134.** Si el navegador bloquea el almacenamiento (Safari con cookies bloqueadas), `localStorage.getItem` en `ThemeContext` lanza al arrancar y el sitio entero queda en blanco.
- **135.** "Propiedades disponibles" mezcla vendidas y apartadas (el filtro solo revisa `active`), ordenadas por fecha; tampoco hay filtro de estatus para el cliente.
- **136.** La firma en /firmar muestra el PDF en un `<iframe>`: Chrome en Android no muestra PDFs embebidos y Safari en iPhone solo la primera página; la mayoría firma desde el teléfono.
- **137.** El encabezado, el pie y el chat quedan fuera del `ErrorBoundary` (solo envuelve el contenido): un error en cualquiera de ellos deja la página entera en blanco.
- **186.** El sitemap declara `xmlns="https://www.sitemaps.org/..."`; el espacio de nombres válido es `http://www.sitemaps.org/schemas/sitemap/0.9`.
- **187.** La vista previa de WhatsApp/Facebook de /naves-industriales dice "Este apartado estará disponible próximamente" aunque ya haya naves publicadas.

## Seguridad y privacidad (101–128)

101. ⚠️ `enviar-correo` (Edge Function) solo exige "un JWT válido", y la llave anon clásica (la que va dentro del sitio público) es un JWT válido; si el proyecto usa esa llave y no la nueva "publishable", basta con ella. Cualquiera puede mandar correos con HTML y adjuntos arbitrarios a cualquier destinatario desde avisos@aclpropiedades.com (relevo abierto para phishing). Validar que el JWT sea de un usuario del staff (`auth.getUser`, rol) y limitar destinatarios/frecuencia. `supabase/functions/enviar-correo/index.ts`
102. ⚠️ La política `Public can read active properties` es `using (true)`: cualquiera lee TODAS las propiedades, incluidas las desactivadas/borradores, con `select *` desde la API pública. Además la ficha `/propiedades/:id` muestra propiedades con `active = false`. `supabase/schema.sql:83`, `PropertyDetail.jsx`
103. ⚠️ `Public can read active advisors` es `using (true)` y la ficha pide `advisors(*)`: teléfono, correo y WhatsApp personales de todos los asesores (incluso inactivos) quedan expuestos en la API pública, aunque la ficha ya no los muestra a propósito. `schema.sql:82`, `supabaseBackend.js:117`
104. ⚠️ Chat: el límite diario del chat es global: alguien que rote el `sessionId` (lo genera el navegador) agota el cupo del día y apaga el chat para todos. Limitar también por IP. `api/chat.js`
105. ⚠️ Exportar CSV no neutraliza celdas que empiezan con `= + - @`: un nombre capturado en un formulario público como `=HYPERLINK(...)` se ejecuta como fórmula al abrirlo en Excel. `src/lib/csvExport.js`
106. ⚠️ /admin/panel (Panel principal con cifras de todo el negocio) no tiene `RequireSection`: cualquier rol lo abre por URL.
107. ⚠️ El panel principal descarga la tabla completa de clientes (descifrada, con datos personales) solo para contarla; igual prospectos, mensajes, citas y ventas. Usar consultas de conteo. `AdminDashboard.jsx`
108. ⚠️ Si la compresión no reduce el tamaño o falla, la foto se sube tal cual con sus metadatos EXIF (puede incluir la ubicación GPS y el modelo del teléfono). Quitar EXIF siempre. `imageCompression.js`
109. ⚠️ La hoja membretada `plantilla_acl.pdf` es pública en /plantilla_acl.pdf: cualquiera puede descargarla y usarla para falsificar documentos con el membrete. Moverla a almacenamiento privado.
110. `/api/chat` devuelve `err.message` del proveedor al visitante (filtra detalles internos). `api/chat.js`
111. /alertas/baja/:token pasa por `PublicLayout`, que manda la ruta completa con el token a Google Analytics (las demás rutas con token lo evitan a propósito). `App.jsx`
112. Las cubetas públicas `property-images`, `advisor-photos`, `blog-images` y `property-360` no tienen límite de tamaño ni tipos permitidos (las privadas sí). `schema.sql:100-126, 5107`
113. No hay aviso de cookies ni modo de consentimiento antes de cargar Google Analytics y el mapa de Google embebido (LFPDPPP; visitantes de EE. UU. por naves industriales).
114. El mapa de la ficha marca el punto exacto de la casa: para vendedores es un riesgo (robos en casas vacías). Ofrecer "ubicación aproximada" (círculo de 300 m) por propiedad.
115. Los mensajes de error de `/api/analytics-summary` también regresan `err.message` crudo.
116. El enlace de baja de alertas, las selecciones y los informes viajan como URL con token sin caducidad visible para el cliente; mostrar "este enlace vence el…" y permitir revocarlo desde el panel donde falte.
117. `Seo` no permite marcar `noindex`: el 404, /favoritos, /comparar y la ficha "no encontrada" quedan indexables.
118. Los leads no guardan la fuente (utm, referrer, QR, portal): el QR ya agrega `utm_source=qr`, pero ese dato nunca llega a Mensajes ni Prospectos.
119. El aviso de privacidad no menciona el chat con inteligencia artificial (y que el texto se procesa con un proveedor externo), WhatsApp, la firma electrónica (trazo, IP, huella del documento) ni las transferencias a proveedores fuera de México.
120. La política de un solo `CRON_SECRET` compartido por todas las funciones programadas: si se filtra uno, se pueden disparar todas.
121. Faltan reglas de retención: cuánto tiempo se guardan INE, CURP, conversaciones del chat y mensajes después de cerrar el trámite, y una tarea que los borre.
122. No hay herramienta para atender derechos ARCO (exportar o borrar todo lo de una persona por teléfono/correo).
123. `/api/nearby-places` acepta cualquier coordenada del mundo: cualquiera puede usarlo como intermediario gratuito de Overpass y hacer que bloqueen la IP. Limitarlo a La Laguna.
124. `record_property_view` acepta cualquier `visitor_id` inventado: con un script se infla el "N personas la vieron" y las vistas del informe al vendedor. Limitar por IP o firmar el id.
125. El chat no avisa, antes de que la persona escriba su teléfono, que la conversación la procesa un servicio de IA ni enlaza al aviso de privacidad.
126. `contact_messages` no limita el tamaño de nombre, mensaje ni del JSON `details` que inserta el público, ni valida `channel`: un bot puede guardar megabytes por envío.
127. No hay página de Términos y condiciones de uso del sitio (solo aviso de privacidad y carta de derechos).
128. El flujo de GitHub "Novedades" guarda la llave `service_role` (acceso total a la base) en los secretos del repositorio solo para insertar una fila; usar una función con permiso mínimo.

## Errores de funcionamiento (129–185)

129. ⚠️ Chat: `onLead` no revisa el error del insert en `prospectos`: si falla, el bot igual dice "ya quedó registrado" y el prospecto se pierde. `api/chat.js`
130. ⚠️ Ficha: a una propiedad vendida se le puede pedir visita: la tarjeta "Agendar visita" se muestra siempre (solo la barra móvil se oculta). `PropertyDetail.jsx`
131. ⚠️ Listado: la tarjeta de alertas usa `key={JSON.stringify(criteria)}`: cada tecla en un filtro la vuelve a montar y borra lo que la persona estaba escribiendo en su nombre/WhatsApp. `Properties.jsx`
132. ⚠️ Formularios: contacto y solicitud de visita comparten la llave `acl_contact_last_submit`: tras mandar uno, el otro queda bloqueado 60 s con "espera un minuto". `ContactForm.jsx`, `ScheduleVisitCard.jsx`
133. ⚠️ Las listas del panel (mensajes, prospectos, clientes, visitas, citas) piden `select("*")` sin límite: Supabase corta en 1,000 filas por omisión y lo de más ya no aparece, sin aviso. `supabaseBackend.js:912, 937, 1647, 1892, 2425`
134. ⚠️ Si el navegador bloquea el almacenamiento (Safari con cookies bloqueadas), `localStorage.getItem` en `ThemeContext` lanza al arrancar y el sitio entero queda en blanco. `ThemeContext.jsx`
135. ⚠️ "Propiedades disponibles" mezcla vendidas y apartadas (el filtro solo revisa `active`), ordenadas por fecha; tampoco hay filtro de estatus para el cliente. Igual los conteos del inicio y del menú cuentan vendidas como "disponibles". `supabaseBackend.js:189`
136. ⚠️ La firma en /firmar muestra el PDF en un `<iframe>`: Chrome en Android no muestra PDFs embebidos y Safari en iPhone solo la primera página; la mayoría firma desde el teléfono. El proyecto ya trae `pdfjs-dist` para dibujarlo página por página. Igual en la vista previa de documentos del panel.
137. ⚠️ El encabezado, el pie y el chat quedan fuera del `ErrorBoundary` (solo envuelve el contenido): un error en cualquiera de ellos deja la página entera en blanco. `App.jsx`
138. Chat: la búsqueda del bot filtra `active` pero no `status`: puede recomendar propiedades vendidas o apartadas. `api/chat.js`
139. Ficha: "Volver a propiedades" siempre lleva a /propiedades: desde un terreno o una nave regresa a un listado donde ese tipo ni aparece. Usar el listado de origen o `navigate(-1)`. `PropertyDetail.jsx`
140. Ficha: si falla la red al cargar la ficha, se muestra "Propiedad no encontrada" (no hay `catch` ni estado de error). Igual en el blog. `PropertyDetail.jsx`, `BlogPost.jsx`
141. Ficha: el mapa usa `lat/lng` sin validar: con coordenadas vacías o nulas `FitBounds` arma límites inválidos y el centro queda en `[null,null]`. `PropertyMap.jsx`
142. Listado: si la consulta falla, la lista se queda con los resultados anteriores y sin aviso (no hay `catch`). `Properties.jsx`
143. Listado: cada tecla en precio/superficie/zona dispara una consulta nueva (sin espera de 300 ms). Con Supabase son 7 consultas por escribir "1500000". `Properties.jsx`
144. Listado: el filtro de zona es texto libre pero el backend exige coincidencia exacta: "senderos" o "Senderos" sin el prefijo de ciudad dan 0 resultados. `PropertyFilters.jsx`
145. Listado: al cambiar de página no se sube al inicio de los resultados: la persona queda viendo el pie de página. `Properties.jsx`
146. Inicio: el panel "Naves Industriales" del inicio solo revisa si el tipo está activo, no si tiene propiedades: el menú lo esconde pero el inicio lleva a un listado vacío. `SplitHero.jsx`
147. Inicio: las tarjetas de categoría dicen "0 propiedades" mientras cargan los conteos (`count ?? 0`). `Home.jsx`
148. Inicio: `getProperties` del inicio no tiene `catch` (error no manejado; los conteos se quedan en null). `Home.jsx`
149. Formularios: `localStorage.getItem` fuera de `try` en Contacto, Solicitud de contacto y Visita: con almacenamiento bloqueado el botón no hace nada (excepción no capturada). `ContactForm.jsx`, `ContactRequestCard.jsx`, `ScheduleVisitCard.jsx`
150. Formularios: fecha mínima de la solicitud de visita en UTC (`toISOString`): después de las 18:00 en Torreón el calendario ya no deja elegir "hoy". `ScheduleVisitCard.jsx:182`
151. Firma: en /firmar/:token el botón de idioma "ES" es invisible (texto oscuro sobre encabezado oscuro, contraste 1.03:1). `PublicSign.jsx`
152. Firma: /firmar/:token no pone título de pestaña (se queda el genérico del sitio). `PublicSign.jsx`
153. Panel: todas las pantallas del panel tienen el mismo título de pestaña ("ACL Propiedades | Inmobiliaria en..."): con varias pestañas abiertas no se distinguen.
154. Panel: una dirección inexistente dentro de /admin (p. ej. /admin/prospecto) saca al asesor al 404 del sitio público, con menú y pie del sitio.
155. Panel: al iniciar sesión siempre se va a /admin: el enlace profundo que traía la persona (aviso de WhatsApp a un prospecto) se pierde. `AdminLogin.jsx`
156. El tema se guarda en `localStorage` en el primer render aunque la persona nunca lo haya elegido: desde la primera visita ya no sigue el modo claro/oscuro del sistema. Guardar solo al tocar el botón y ofrecer "Automático".
157. El código de la propiedad (ACL-1001) no aparece en la ficha ni en la tarjeta, aunque el sitio ofrece "Buscar por código": el cliente no tiene cómo citarlo por teléfono.
158. Una propiedad rentada solo puede marcarse "vendida" (el estatus solo admite disponible/apartada/vendida): falta "rentada", "en pausa" y "retirada". `schema.sql:44`
159. `sessionStorage` sin `try` en `main.jsx` (recarga tras despliegue): en navegadores con almacenamiento bloqueado truena antes de montar la app.
160. Las partículas de temporada salen también en /firmar, /documentos, /visita y /seleccion (solo se excluyen /admin e /informe): distraen en una firma legal.
161. El formulario de Contacto y la solicitud de visita no tienen `autocomplete` en nombre, correo y teléfono: en el celular no se autollenan (los demás formularios sí lo tienen).
162. El buscador por código no tiene `catch`: con error de red el botón se queda "buscando". `SearchBar.jsx`, `PropertyFilters.jsx`
163. El buscador del inicio navega a `/propiedades?` con signo colgando cuando no hay filtros y no valida mínimo > máximo (tampoco en superficie).
164. "Nosotros" no tiene `catch` al pedir asesores; la calculadora tampoco al pedir zonas y tipos.
165. `TrustStats` formatea cifras con el idioma del navegador (`toLocaleString()` sin idioma), no con el del sitio.
166. El contenido envuelto en `Reveal` arranca invisible (opacidad 0) hasta que entra en pantalla: al volver de una ficha o al imprimir, las tarjetas aparecen vacías un momento. Quitarlo de las tarjetas del listado.
167. El `.ics` de la visita usa hora "flotante" (sin zona): alguien con el teléfono en otra zona horaria (compradores de naves en EE. UU.) la ve corrida.
168. Tras iniciar sesión, un error de red y una contraseña incorrecta muestran el mismo mensaje.
169. Unas 20 pantallas del panel cargan datos sin `catch` (Zonas, Roles, Testimonios, Blog, Novedades, Asesores, Desarrollos, Plantillas, Materiales, Remodelaciones, Construcción, Expedientes de agenda, Historial de propiedad, formularios de cliente, asesor, cita y desarrollo): si falla la red se quedan en "Cargando…" para siempre.
170. Fechas formateadas con el idioma del navegador (`toLocaleString()` sin idioma) en Agenda, Expedientes, Documentos del cliente, Avance de remodelación, Portal y el PDF de expediente de avalúo: salen en formato de EE. UU. si la computadora está en inglés.
171. Hay 8 `window.prompt` en el panel (además de los `confirm/alert` ya contados): en la app instalada en iPhone pueden no mostrarse y no se pueden validar.
172. Las amenidades y los tipos de propiedad se capturan en un solo idioma: en inglés el filtro y la ficha muestran "Alberca", "Seguridad 24h".
173. Fotos HEIC (iPhone desde computadora) que el navegador no puede decodificar se suben sin convertir y no se ven en Chrome ni Android.
174. PNG con transparencia (planos, logotipos) se convierten a JPEG con fondo negro.
175. Los órdenes por precio y por superficie no tienen desempate (solo "más recientes" usa `id`): con precios iguales, una propiedad puede repetirse o saltarse entre páginas. `supabaseBackend.js:119`
176. Las vistas de "N personas la vieron" cuentan también al equipo (asesores enseñando la ficha) y a los robots que ejecutan JavaScript.
177. La vista Lista/Mapa no se guarda en la URL: al volver de una ficha abierta desde el mapa regresa a la lista.
178. El chat usa `crypto.randomUUID()` incluso en su respaldo de error: en iPhone con iOS anterior a 15.4 lanza excepción y, por lo anterior, tumba la página.
179. Más textos fijos en español además de los ejemplos de la lista: etiquetas del formulario de propiedad ("Título", "Precio (MXN)", "Estacionamientos", "Dirección", "Latitud", "Longitud"), del formulario de asesor, de Liquidación (7), Mi perfil (5) y Construcción (3); mensajes `alert` como "Error al guardar"; el 404 ("La página que buscas no existe", "Página no encontrada"), la descripción del inicio, "Navegación principal", "Ubicación ACL Propiedades", "Cambiar idioma / Switch language", "Torreón, Coahuila" en pie y Nosotros, "Construcción" en el panel, y la página sin conexión.
180. `ShareButton` arma el enlace con `window.location.origin`: si alguien comparte desde un dominio de vista previa de Vercel, el enlace que circula es el de prueba.
181. En /naves-industriales no se puede filtrar renta o venta (`showOperation` se apaga en apartados de un solo tipo), aunque muchas naves se rentan y la ficha técnica ya distingue el precio de renta. `Properties.jsx`
182. El formulario de Contacto no valida el teléfono (acepta "abc" o 3 dígitos), a diferencia de los demás formularios.
183. La hora de la solicitud de visita es un campo libre (`type="time"` sin `step`): permite 13:07 o 3:00 a. m.; ofrecer intervalos de 30 min dentro del horario de oficina.
184. Cuando el chat llega a su límite (429) muestra "Algo salió mal"; decir que se alcanzó el límite y ofrecer WhatsApp directamente.
185. "Buscar por código" exige escribir "ACL-1001" completo: con solo "1001" dice que no existe. Aceptar el número solo.

## SEO, vista previa y medición (186–213)

186. ⚠️ El sitemap declara `xmlns="https://www.sitemaps.org/..."`; el espacio de nombres válido es `http://www.sitemaps.org/schemas/sitemap/0.9`. Google lo marca como error de espacio de nombres. `api/sitemap.js`
187. ⚠️ La vista previa de WhatsApp/Facebook de /naves-industriales dice "Este apartado estará disponible próximamente" aunque ya haya naves publicadas. `middleware.js`
188. El sitemap omite /vende-tu-casa, /comparar-creditos, /aviso-de-privacidad, /carta-de-derechos y desarrollos aparte; incluye /naves-industriales aunque esté en "Próximamente".
189. 12 páginas públicas no tienen `<h1>` (el título usa `<h2>`): /propiedades, /terrenos, /naves-industriales, /contacto, /calculadora, /nosotros, /favoritos, /comparar, /aviso-de-privacidad, /carta-de-derechos, /propiedades/zona/* y /documentos/*.
190. En el inicio, el `<h1>` aparece después de dos `<h2>` del hero dividido.
191. El título del inicio queda "Inicio | ACL Propiedades": se pierde el título de index.html ("Inmobiliaria en La Comarca Lagunera"), que es el que posiciona.
192. Título y descripción de la ficha tienen "en" fijo en español (`Casa en Venta — …`) y en inglés salen mezclados.
193. JSON-LD de la ficha: `geo` con `null` si no hay coordenadas, `addressLocality` recibe la colonia (no la ciudad), falta `addressRegion`, y "apartada" se marca como `OutOfStock`.
194. El JSON-LD de migas siempre dice "Propiedades" aunque sea un terreno o una nave, y no cambia de idioma.
195. El JSON-LD del blog no trae `publisher` con logotipo ni `mainEntityOfPage`.
196. `og:url` incluye los parámetros de la URL (filtros, utm del QR).
197. La descripción meta no se borra al pasar a una página que no manda una: queda la de la página anterior.
198. `middleware.js` no cubre /desarrollos/:slug, /blog/:slug, /propiedades/zona/:ciudad, /calculadora, /vende-tu-casa ni /comparar-creditos: al compartirlas por WhatsApp no sale título ni imagen.
199. Las páginas por ciudad solo traen el listado y una franja de cifras: contenido delgado para Google. Agregar texto propio, colonias, precios promedio y preguntas frecuentes por ciudad.
200. El blog no tiene categorías, etiquetas, autor, tiempo de lectura, artículos relacionados ni paginación.
201. El cuerpo del blog solo admite párrafos: sin subtítulos, listas, enlaces internos ni imágenes.
202. El blog solo existe en español: el visitante en inglés ve artículos en español.
203. Toda ruta desconocida responde 200 con la SPA (404 suave).
204. La meta descripción de `index.html` y la del inicio anuncian naves industriales aunque estén en "Próximamente".
205. La imagen de vista previa de una ficha es la foto completa (hasta 1920 px): WhatsApp no muestra imágenes pesadas. Servir una de 1200×630 de menos de 300 kB y declarar `og:image:width/height`. `middleware.js`
206. Sitemap de imágenes (`image:image`) con las fotos de cada propiedad para aparecer en Google Imágenes.
207. `robots.txt` tampoco bloquea /alertas/baja/, /favoritos ni /comparar (además de las rutas que ya están en la lista).
208. Falta `og:locale` (es_MX / en_US) en las etiquetas para compartir.
209. Un enlace viejo a una propiedad vendida o borrada debería redirigir a la zona o tipo equivalente (hoy muestra "no encontrada" o la ficha vendida).
210. Los textos para Google y para compartir están en tres lugares (`index.html`, `middleware.js` y cada página) y ya no coinciden entre sí (la descripción del inicio es distinta en los tres).
211. El título y la vista previa de una propiedad vendida siguen diciendo "Casa en Venta — $precio" (se arman con la operación, no con el estatus).
212. El sitemap incluye propiedades vendidas sin límite de tiempo: Google sigue mandando gente a fichas vendidas; quitarlas del sitemap (o `noindex`) después de unas semanas.
213. Sin píxel de Meta ni etiqueta de conversión de Google Ads (con consentimiento) para medir y redirigir campañas pagadas.

## Rendimiento (214–238)

214. La pantalla de carga se muestra 1.5 s fijos en cada visita, aunque la página ya esté lista (también al abrir enlaces de firma o documentos). `main.jsx`
215. Las traducciones en inglés y español (~3,200 textos cada una, 105 kB comprimidos) se descargan en la primera visita; cargar solo el idioma activo.
216. `dataStore` mete al paquete público el backend de demostración, los datos semilla con fotos de Unsplash y el código de sincronización de Construcción (`objetos`), aunque el sitio use Supabase: 204 kB. Importar el backend local solo en modo demo.
217. `supabaseBackend` importa `construccion/sync` de forma directa: el visitante del inicio descarga geometría de planos.
218. App, Header, Home, SearchBar y Properties piden `getPropertyTypes()` cada uno: hasta 4 consultas iguales por página.
219. Favoritos y Comparar piden cada propiedad por separado (`getPropertyById` × N); usar un filtro por lista de ids.
220. La ficha descarga todas las propiedades del mismo tipo solo para elegir 4 similares.
221. Las páginas por ciudad descargan el catálogo completo dos veces (resumen de mercado + filtro de ciudad).
222. Los fondos del inicio (2 paneles a 1400 px, 4 categorías a 900 px) son `background-image` en CSS: no se pueden cargar diferido ni tienen `srcset`.
223. La siguiente foto del visor no se precarga: cada deslizamiento espera la descarga.
224. `vercel.json` no da caché larga e inmutable a `/assets/*` (archivos con hash).
225. El mapa usa directamente `tile.openstreetmap.org` (política de uso de OSM no permite tráfico comercial intenso y no hay respaldo); usar un proveedor con llave (MapTiler, Stadia, Mapbox).
226. `AuthProvider` envuelve el sitio público: cada visitante inicializa la sesión de Supabase Auth sin necesitarla.
227. La foto de reemplazo cuando una propiedad no tiene imágenes viene de `placehold.co` (servicio externo, en inglés). `Gallery.jsx`
228. `sitemap.xml` consulta Supabase en cada visita del robot: agregar `s-maxage` para que la caché del CDN lo sirva.
229. "Mensajes" descarga todas las propiedades y todos los prospectos en cada visita, solo para cruzarlos.
230. Faltan índices para lo que más se consulta: `properties(status)`, `properties(price)`, `properties(created_at)`, `contact_messages(created_at)`, `prospectos(created_at)` y `prospectos(phone)` (detección de duplicados).
231. Cargar el mapa de Contacto solo al hacer clic ("Ver mapa"): hoy siempre baja el iframe de Google con sus cookies.
232. La sección de videos del inicio carga metadatos de todos los videos al entrar; cargar al hacerse visibles.
233. Las respuestas del middleware a los robots de vista previa no traen `Cache-Control`: cada vista previa de WhatsApp consulta Supabase.
234. Se cargan 7 archivos de fuente (Rajdhani 500/600/700 e Inter 400/500/600/700): reducir pesos o usar la versión variable de Inter.
235. Abrir un recorrido 360° descarga 910 kB de three.js + drei (240 kB comprimidos), no los ~150 kB que dice el comentario; un visor ligero de panorámicas pesa una fracción. `Panorama360.jsx`
236. Las funciones de Vercel no fijan región (`regions` en `vercel.json`): conviene ponerlas en la misma región que Supabase para no sumar latencia en cada consulta.
237. La "Guía del comprador" se genera en el navegador con pdf-lib (425 kB de código) cada vez que alguien la descarga; servir un PDF ya hecho.
238. La misma plantilla pesa 3.7 MB y se descarga completa cada vez que se genera un informe o una valuación en PDF (en el teléfono, con datos móviles); optimizarla a menos de 300 kB.

## Accesibilidad (239–263)

239. Panel: el buscador global pone `aria-expanded` en un `<input>` sin `role="combobox"` (error crítico de accesibilidad en todas las pantallas). `AdminGlobalSearch.jsx`
240. Panel: en Roles, los `<select>` de cada fila no tienen etiqueta (crítico). `AdminRoles.jsx`
241. El verde de "Disponible" (#1e8e5a sobre su fondo) da 3.56:1 en la ficha y 4.14:1 sobre blanco en tarjetas; no llega a 4.5:1. Igual en el panel (propiedades y zonas).
242. "Apartada" en el mapa de unidades de desarrollos: 2.64:1 (74 celdas). `development.css`
243. Las notas del comparador de créditos (#b7791f sobre blanco): 3.64:1.
244. Los días de otros meses en el calendario de la Agenda: 2.47:1.
245. El botón principal (`.btn-primary`) es un degradado: el texto blanco sobre el extremo claro (#2f9bdc) queda ~3:1, y en modo oscuro (#6cc4f2) ~2:1.
246. `--color-danger` y `--color-success` no se redefinen en modo oscuro: rojo #c0392b sobre fondo #0a1120 queda ~3.3:1.
247. Los enlaces dentro de texto no se subrayan (`a { text-decoration: none }` global): en el aviso de privacidad, los consentimientos y el blog no se distinguen del texto.
248. `.btn` no tiene estilo `:focus-visible`: al navegar con teclado no se ve en qué botón estás (solo los campos de formulario tienen contorno).
249. Los marcadores del mapa (Leaflet) no tienen nombre accesible; las gráficas de Reportes usan `aria-label` en `div` sin rol.
250. El chat no anuncia las respuestas (la lista no es `aria-live`) y el indicador "escribiendo" no se lee.
251. Tarjetas de propiedad: el favorito y el comparar son `<button>` dentro de un `<a>` (HTML inválido) y la tarjeta tiene 3 enlaces a la misma ficha (foto, título, "Ver detalle"): 5 tabulaciones por tarjeta.
252. Los grupos de casillas y radios (amenidades del filtro, "¿Cómo te avisamos?") usan `<label>` sin control en lugar de `<fieldset>`/`<legend>`.
253. En el pie, los títulos son `<h4>` saltando niveles; el inicio de sesión del panel no tiene `<main>`.
254. Tablas del panel con encabezados vacíos (`<th>` sin texto) y zonas con desplazamiento horizontal que no se pueden enfocar con teclado (Prospectos, Visitas, Gastos, Reportes).
255. El foto de asesor en la tarjeta repite su nombre en el `alt` justo al lado del nombre; debería ir `alt=""`.
256. El texto alternativo de la foto principal es "Título - imagen 1": no describe la foto. Permitir capturar una descripción por foto.
257. Animaciones (Reveal, partículas de temporada, crecer del hero, spinner) no respetan `prefers-reduced-motion` en todos los casos; solo la transición de página lo hace.
258. Varias áreas táctiles miden menos de 32 px (entre 15 y 35 por página en el sitio público).
259. El botón "Comparar" en tarjeta y ficha es un cuadro vacío sin texto: nadie adivina qué hace.
260. El crecimiento del hero y el zoom del visor no respetan `prefers-reduced-motion` (Reveal y partículas sí).
261. Errores de formulario sin `aria-describedby` ni foco en el primer campo con error; los mensajes de éxito no son `role="status"`: un lector de pantalla no se entera de nada al enviar.
262. El menú móvil del sitio no se cierra con Escape ni tocando fuera, no bloquea el desplazamiento del fondo y su etiqueta sigue diciendo "Abrir menú" cuando está abierto. `Header.jsx`
263. Al cambiar a inglés, `<html lang>` sigue en "es": los lectores de pantalla leen el inglés con voz en español y Google recibe un idioma equivocado.

## Diseño del sitio público (264–323)

264. El inicio abre con dos paneles a pantalla completa ("Propiedades" / "Naves Industriales") y el buscador queda debajo del pliegue; en teléfono son 92 % de la pantalla sin buscador, sin teléfono ni propuesta de valor.
265. Si las naves están en "Próximamente", la mitad del primer pantallazo del inicio anuncia algo que no existe.
266. El inicio en teléfono mide ~8,700 px: demasiadas secciones (hero doble, destacadas, videos, categorías, cifras, vistas, testimonios, reseñas, blog).
267. En /propiedades el bloque "Torres y desarrollos" ocupa toda la primera pantalla; filtros y resultados quedan abajo. En escritorio es una tarjeta sola con un hueco enorme a la derecha.
268. El logotipo del encabezado mide ~50 px de ancho: casi ilegible.
269. El encabezado no tiene teléfono ni botón de WhatsApp/contacto visible.
270. El menú no tiene "Desarrollos", "Terrenos" (cuando hay) ni "Favoritos" con texto; "Comparar" solo aparece si hay algo agregado.
271. El botón flotante del chat tapa texto de la ficha en teléfono (queda encima del bloque de pago mensual).
272. La página de un desarrollo mide ~12,000 px en teléfono: agregar índice o pestañas (modelos, unidades, ubicación, avances).
273. La fecha de entrega de un desarrollo se muestra tal cual se guardó (p. ej. "2027-06-01"), sin formato. `Development.jsx`
274. Precio de renta sin "/mes": una renta de $15,000 se ve igual que una venta.
275. La tarjeta no tiene foto de reemplazo cuando falta `main_image`: queda un hueco.
276. El estatus de cualquier valor que no sea disponible/apartada se pinta rojo de "vendida" (p. ej. un estatus nuevo).
277. "Nosotros" son tres tarjetas de misión/visión/valores; faltan historia, años, operaciones cerradas, certificaciones (AMPI, Infonavit), fotos de la oficina y del equipo trabajando.
278. El pie dice "locales comerciales", pero el sitio no tiene esa categoría.
279. El pie no enlaza a Blog, Terrenos, Naves, Desarrollos ni Favoritos.
280. La página 404 y los estados vacíos usan el mismo texto gris centrado que "Cargando…".
281. `p { color: muted }` global: descripciones largas y blog se leen en gris.
282. `ul { list-style: none }` global: cualquier lista dentro de contenido (privacidad, blog) pierde viñetas.
283. `.btn { white-space: nowrap }`: textos largos en inglés desbordan en teléfono.
284. Las páginas usan `minHeight: 100vh`; en Safari móvil la barra de direcciones hace que el contenido brinque. Usar `100dvh`.
285. No hay estilos de impresión para la ficha (solo 2 archivos tienen `@media print`): imprimirla saca menú, chat y mapa roto.
286. El buscador del inicio y los filtros del listado son dos interfaces diferentes para lo mismo, con campos distintos.
287. El filtro "Más filtros" arranca abierto (`<details open>`), así que no oculta nada.
288. "Limpiar" del filtro siempre está activo, aunque no haya filtros, y también reinicia el orden.
289. El selector de tipo del buscador muestra tipos desactivados.
290. El menú de compartir en escritorio (`<details>`) no se cierra al hacer clic fuera ni después de copiar.
291. "Copiar enlace" copia el bloque completo con emojis, no solo el enlace.
292. En la tarjeta, si la propiedad no tiene zona se ve "· " suelto.
293. El selector de idioma muestra el idioma actual ("ES") en vez del que vas a activar: mucha gente lo lee como "cambiar a español".
294. 19 valores distintos de `z-index` (de 1 a 9999) sin escala: chat, mapa en pantalla completa, visor y encabezado compiten. Definir capas como variables.
295. `theme-color` tiene un solo valor: la barra del navegador queda azul aunque el sitio esté en modo oscuro.
296. Cuando las reseñas de Google no están configuradas, el inicio muestra un bloque difuminado de "Próximamente": se ve inacabado; mejor ocultarlo.
297. Migas de pan visibles (Inicio › Terrenos › Torreón › Ficha) en ficha y listados; hoy solo existen en el JSON-LD.
298. En laptop (1366×800) la primera pantalla de la ficha es solo la galería: título, precio y estatus quedan debajo.
299. El ícono de "WhatsApp" en Contacto y el pie es un auricular de teléfono: no se reconoce como WhatsApp.
300. En Contacto, teléfono y correo se ven como texto normal: convertirlos en botones grandes "Llamar" y "WhatsApp".
301. La tarjeta del formulario de Contacto se estira hasta la altura del mapa y deja un hueco blanco bajo el botón.
302. Los testimonios del inicio no llevan a una página con todos ni a la ficha de Google.
303. La foto principal de la ficha no tiene contador visible ("1/12") fuera del visor.
304. Tarjetas del listado: las fotos de la galería no muestran cuántas hay (p. ej. "📷 12").
305. Leyenda de colores de los marcadores del mapa (casa, departamento, nave, terreno usan azules parecidos).
306. El mapa en modo oscuro sigue con mosaicos claros que deslumbran.
307. El campo de precio en el buscador del inicio usa `placeholder="$10,000,000"`: parece un valor ya puesto.
308. El formulario de alerta en la ficha y el de contacto piden los mismos datos dos veces en la misma página.
309. El comparador de créditos trae "Hombre" preseleccionado en sexo (afecta el cálculo de Infonavit): dejarlo sin valor para que la persona lo elija.
310. La calculadora usa un solo deslizador de 30 a 5,000 m² con pasos de 5: en el teléfono es casi imposible atinar a 120 m².
311. Las preguntas frecuentes de la ficha repiten los datos que están arriba (precio, m², recámaras); permitir preguntas propias por propiedad (¿se acepta crédito?, ¿cuánto es el mantenimiento?).
312. La ficha tiene dos llamados casi iguales al comparador de créditos (en el bloque de precio y en una tarjeta más abajo).
313. Tras enviar Contacto, el formulario vacío sigue en pantalla con un aviso verde pequeño; no hay "Enviar otro" ni siguiente paso (Vende tu casa sí lo tiene).
314. La página "Sin conexión" solo está en español y habla de "tus datos siguen guardados" (texto del panel), pero también la ven los clientes del sitio; agregarle el teléfono de la oficina.
315. El inicio no tiene ningún bloque para vendedores ("¿Quieres vender? Te decimos cuánto vale"), aunque los vendedores son la fuente del inventario.
316. El inicio no muestra los desarrollos/torres ni invita a las herramientas (comparador de créditos, guía del comprador).
317. Mostrar en la tarjeta de visita de la ficha la foto y el nombre del asesor que atenderá (sin teléfono), para darle cara humana.
318. En el encabezado del teléfono caben cuatro botones redondos (favoritos, tema, idioma, menú) y el logotipo queda diminuto; mover tema e idioma dentro del menú.
319. La ficha en teléfono pone el bloque de pago mensual con texto de 3 renglones de aclaraciones antes de las características: resumirlo y llevar la aclaración a un ícono de información.
320. Las tarjetas de categoría del inicio repiten la información del hero dividido y del buscador (tres formas de elegir tipo en la misma pantalla).
321. El precio tachado de rebaja no dice cuánto bajó ni en qué porcentaje.
322. La zona del buscador y del filtro es un `<datalist>`: en iPhone se ve como sugerencias sobre el teclado, poco descubribles; usar un selector con búsqueda.
323. El formulario de alerta del listado aparece también debajo de 24 resultados y de la paginación, donde casi nadie llega; mostrarlo después de la primera fila o cuando hay pocos resultados.

## Diseño del panel (324–337)

324. En teléfono, las tarjetas de cifras del panel van una por renglón (9 tarjetas ≈ 1,000 px); usar 2 columnas.
325. En Prospectos (teléfono) cinco botones grandes (Nuevo, Seleccionar, Importar, Importar desde visitas, Exportar) ocupan media pantalla antes de la lista; agrupar en un menú "⋯".
326. El buscador y el selector de asesor de Prospectos en teléfono tienen estilo nativo del navegador, distinto al resto.
327. "Exportar CSV" aparece deshabilitado sin decir por qué.
328. El botón flotante "+" tapa la columna de acciones ("Más") de la última fila de las tablas en escritorio.
329. En Propiedades, "Activo" parece un botón (píldora con borde) pero es solo una etiqueta; "Estado" es texto plano.
330. El aviso "Toca respaldar" del panel usa un enlace sin estilo de enlace y más grande que el texto.
331. Las cifras del panel no comparan contra el mes anterior ni enlazan a la lista filtrada.
332. El respaldo vive dentro de "Roles y accesos": nadie lo busca ahí. Moverlo a una sección de configuración.
333. Agrupación del menú poco intuitiva: Blog, Testimonios y Visitas dentro de "Clientes"; Zonas y Asesores dentro de "Propiedades"; Agenda dentro de "Oficina".
334. En el panel en teléfono el buscador muestra "Buscar cliente, prop…" cortado: usar un ícono de lupa y un texto corto.
335. El menú lateral del panel no muestra quién inició sesión ni con qué rol.
336. Las pantallas internas del panel (editar propiedad, documentos del cliente, bitácora) no tienen migas ni botón "Volver" consistente.
337. En las tablas del panel, los botones "Editar / Enviar / Más" ocupan un tercio del ancho: usar íconos con texto al pasar el cursor o mover acciones al menú "Más".

## Utilidad para clientes (sitio público) (338–406)

338. Sección propia de Rentas (/rentas) con filtros de renta: precio mensual, amueblado, mascotas, depósito, plazo mínimo y fecha de disponibilidad. Hoy la renta es solo una opción del filtro "Operación".
339. Precio por m² visible en terrenos, casas y departamentos (hoy solo en naves) y orden "menor precio por m²".
340. Filtro "Solo con precio rebajado" y orden "Recién publicadas / Rebajadas" (la etiqueta de rebaja ya existe).
341. Separar m² de terreno y m² de construcción en la propiedad (hoy hay un solo campo `area_m2`), que es como se anuncian las casas en México.
342. Cuota de mantenimiento mensual para casas en privada y departamentos.
343. Datos de terreno: frente × fondo, uso de suelo, topografía, servicios disponibles.
344. Etiquetas de crédito en la propiedad: "Acepta Infonavit / Fovissste / bancario / contado".
345. Mostrar "Publicada hace X días" y "Actualizada el…" en la ficha.
346. Similares por rango de precio (±20 %) y recámaras, no solo por tipo y zona.
347. Varias zonas a la vez en el filtro (hoy es una sola, por texto).
348. Avisar en la ficha cuando la propiedad ya está apartada o vendida con una franja clara y sugerencias similares arriba, no solo la etiqueta.
349. El comparador debería incluir precio por m², pago mensual estimado, amenidades, antigüedad y mantenimiento, y resaltar el mejor valor de cada renglón.
350. En Favoritos: botón "Pedir información de todas" o "Agendar visita a varias" en un solo paso, y nota personal por propiedad.
351. El chat no sabe en qué propiedad está la persona: mandarle la ficha actual como contexto.
352. Las respuestas del chat son texto plano: convertir los códigos de propiedad que menciona en enlaces a la ficha.
353. Botón "Nueva conversación" en el chat y conservar el historial al cambiar de pestaña.
354. El WhatsApp de la ficha abre el número de la oficina, no el del asesor de la propiedad: rutear al asesor asignado (o por turnos) ahorra un paso de reenvío.
355. El botón de WhatsApp de la ficha (escritorio) exige nombre y teléfono antes de abrir el chat, mientras la barra móvil abre directo: unificar (abrir directo y registrar el clic).
356. La solicitud de visita exige correo y teléfono; la de contacto solo teléfono. Pedir lo mínimo (nombre y WhatsApp) en todas.
357. Formulario de contacto: agregar "¿Qué buscas? Comprar / Vender / Rentar / Invertir" para rutearlo.
358. Mostrar al enviar un formulario cuánto tarda en responder un asesor ("te escribimos en menos de 2 h hábiles") y un siguiente paso (ver similares, agendar).
359. "Vende tu casa" es solo un formulario: falta explicar el proceso, qué incluye (fotos, publicación, informe semanal al vendedor que ya existe), comisión y preguntas frecuentes.
360. "Vende tu casa" no permite "Quiero rentar mi propiedad"; los dueños que rentan no tienen entrada.
361. "Vende tu casa" pide m² de terreno como obligatorio (muchos dueños no lo saben); y no pide recámaras, baños, antigüedad ni estado de conservación.
362. La calculadora usa el precio por m² de construcción con un factor fijo para terrenos, aunque cada zona ya tiene `land_price_per_m2`.
363. La calculadora termina en la cifra, sin botón para pedir la estimación formal o hablar con un asesor.
364. Calculadora y "Vende tu casa" responden lo mismo ("¿cuánto vale?") con dos herramientas distintas; unificarlas.
365. El comparador de créditos no incluye Fovissste, Cofinavit ni Unamos Créditos, aunque el sitio anuncia asesoría Fovissste.
366. Enlace a "Consulta tus puntos Infonavit / precalificación" con su explicación, junto al comparador.
367. "Agregar al calendario" de la visita solo descarga `.ics`; agregar botón directo de Google Calendar.
368. Mostrar horario de sábado (si hay visitas en sábado) y "Abierto ahora / Cerrado" en Contacto; hoy dice "Lunes a viernes" dos veces.
369. La dirección en Contacto no es enlace a "Cómo llegar" y el mapa embebido busca por nombre del negocio, no por coordenadas o ficha de Google.
370. El sitio no menciona los servicios de remodelación y construcción que la empresa sí opera en el panel (Obra): falta una página de servicios.
371. Casa abierta: publicar fechas de "open house" en la ficha y en el inicio.
372. Programa de referidos ("Recomienda a alguien que venda y gana…") con su formulario.
373. Boletín mensual del mercado lagunero (correo) desde el blog y el pie.
374. Testimonios en video y ligados a la propiedad que compraron.
375. Página por asesor con su foto, reseñas y propiedades asignadas.
376. Precio en dólares aproximado y m² en pies cuadrados para naves industriales (clientes de nearshoring).
377. Mostrar en naves datos que pide el sector: potencia eléctrica (kVA), andenes, altura, distancia a carretera/aduana, parque industrial.
378. Blog: botones de compartir, artículos relacionados y un bloque "Propiedades relacionadas" al final.
379. "Vistos recientemente" no tiene botón para borrar el historial.
380. En el visor no hay botón de descargar ni de compartir la foto actual.
381. El visor no se puede cerrar deslizando hacia abajo en el teléfono (gesto esperado).
382. Mostrar recámaras y baños también en la vista de mapa (el globo solo trae precio y m²).
383. Capa satelital opcional en el mapa (para terrenos es casi obligatoria).
384. El buscador del inicio no recuerda la última búsqueda ni sugiere las zonas más buscadas.
385. La ficha no dice si la propiedad está en fraccionamiento cerrado/privada (dato clave en Torreón); agregarlo como dato con filtro.
386. Fichas de departamento sin piso, elevador ni cajones asignados.
387. Al pedir información de una propiedad apartada, ofrecer "avísame si se libera" (la alerta de precio solo aplica a disponibles).
388. Recordar nombre y teléfono del visitante entre formularios (con su permiso) para no volver a teclearlos.
389. Después de agendar una visita, ofrecer agendar otra propiedad similar el mismo día con el mismo asesor.
390. "Guía del comprador" sin versión de vendedor ni de inversionista.
391. Glosario de términos (avalúo, escrituración, ISR por venta, enganche, gastos notariales) enlazado desde fichas y calculadoras.
392. Calculadora de gastos de escrituración (notario, ISAI/traslado de dominio de Coahuila y Durango) como herramienta pública.
393. Calculadora de rentabilidad para inversionistas (renta estimada vs precio, plusvalía de la zona).
394. El sitio no explica los costos para el comprador (comisión 0 % para comprador, gastos notariales aproximados).
395. El chat no ofrece botones de inicio ("Busco casa en Torreón", "Quiero vender", "Hablar con un asesor"): la gente no sabe qué preguntarle.
396. El zoom del visor de fotos amplía al centro y no deja moverse por la imagen ampliada.
397. Comparación compartible por enlace (`/comparar?ids=…`) para mandarla a la pareja o al asesor.
398. Barra flotante "Comparar (2)" en el listado cuando hay propiedades seleccionadas; hoy solo se nota en el ícono del encabezado.
399. "N propiedades nuevas desde tu última visita" en el listado (se puede guardar la fecha de la última visita en el navegador).
400. Enlace "Reportar un error en esta publicación" (precio incorrecto, ya vendida, fotos equivocadas) en la ficha.
401. El listado no muestra cuántas propiedades hay por zona en el filtro ("Senderos (4)"), lo que evita búsquedas sin resultados.
402. Al no haber resultados, sugerir quitar el filtro más restrictivo ("Sin el precio máximo hay 7") en lugar de solo ofrecer WhatsApp.
403. El aviso de "Propiedad no encontrada" no sugiere similares ni conserva la búsqueda: es un callejón sin salida para enlaces viejos compartidos por WhatsApp.
404. Mostrar en la ficha la fecha de la última actualización de precio ("Bajó $150,000 hace 5 días"); hoy solo se ve el precio tachado.
405. En Favoritos, avisar cuando una propiedad guardada bajó de precio o ya se vendió (hoy solo cambia la etiqueta pequeña).
406. La página de un desarrollo solo tiene botón de WhatsApp: no hay formulario ni agenda de visita a la sala de ventas, y el interés no queda registrado en Mensajes como en la ficha de propiedad.

## Utilidad para asesores (panel) (407–476)

407. Panel: "Mensajes" dice "enviados desde el formulario de contacto", pero ahí caen solicitudes de visita, WhatsApp, alertas, estimaciones y comparador; tampoco hay filtro por canal ni búsqueda. `AdminMessages.jsx`
408. Captura de ubicación con mapa o búsqueda por dirección en el formulario de propiedad (hoy se escriben latitud y longitud a mano); `src/lib/geocode.js` ya existe.
409. Aviso al salir de un formulario con cambios sin guardar (no hay `beforeunload` ni bloqueo de navegación en ningún formulario).
410. Revisión de precio sospechoso al guardar (p. ej. $2,450 en una venta o $15,000,000 en una renta).
411. Columnas en Propiedades: asesor, días publicada, vistas (ya se registran con `record_property_view`) e interesados.
412. Pasar a "archivada" automáticamente una propiedad vendida después de N días (hoy sigue "Activa" y publicada como vendida para siempre).
413. En el prospecto faltan: tipo de crédito, monto preaprobado, urgencia (plazo de compra) y varias zonas de interés.
414. Permisos de solo lectura por sección (hoy un rol ve y edita todo o nada).
415. Filtro por canal y búsqueda en Mensajes (solicitud, WhatsApp, alerta, estimación, comparador).
416. Las alertas que se dan de alta también crean un mensaje cada una: agrupar o marcar como informativas para no llenar la bandeja.
417. El formulario de asesor pide WhatsApp "formato 521XXXXXXXXXX", mientras el resto del sistema arma los enlaces con 52 + 10 dígitos: normalizar el número al guardar y no pedir formato.
418. Blog: faltan campo de URL editable (slug), título y descripción para Google, vista previa, programar publicación y versión en inglés.
419. Testimonios: sin foto, fecha, propiedad relacionada ni origen (Google, WhatsApp); importar los de Google Reviews ya conectados.
420. Marca de agua opcional con el logotipo en las fotos públicas (los portales y otros asesores copian las fotos).
421. Reordenar las fotos de una propiedad (hoy solo se elige portada y se borran; el orden es el de subida).
422. Plantillas de descripción por tipo de propiedad para que todas las fichas sigan la misma estructura.
423. Revisión ortográfica y de mayúsculas en títulos ("CASA EN VENTA!!!") antes de publicar.
424. Historial de precios visible en el panel con gráfica (ya existe `previous_price` y `property_changes`).
425. Estado "en negociación" o "con oferta" entre disponible y apartada.
426. Datos del propietario ligados a la propiedad (cliente vendedor) visibles desde la ficha del panel con un toque.
427. Vista de mapa en el listado del panel para ver inventario por zona.
428. Marcar mensajes como spam y bloquear número/correo.
429. Recordatorio cuando un mensaje lleva más de 2 h sin atender.
430. Próximo paso obligatorio al cambiar de etapa (fecha y acción).
431. Agenda: avisar de empalmes al capturar una cita a mano en el panel (la reserva en línea ya los evita).
432. Agenda: considerar el tiempo de traslado entre citas de distintas zonas al proponer horarios (la duración ya existe).
433. Agenda: color por tipo de cita (visita, firma, avalúo, entrega).
434. Agenda: citas recurrentes (juntas semanales, guardias).
435. Clientes: etiquetas libres (inversionista, primera vivienda, reubicación) y búsqueda por etiqueta.
436. Clientes: cumpleaños y aniversario de compra con recordatorio para seguimiento posventa.
437. Clientes: semáforo del expediente (completo, falta INE, falta comprobante) en la lista.
438. Documentos: vencimiento de documentos (comprobante de domicilio de más de 3 meses, constancia fiscal vieja) con aviso.
439. Firmas: recordatorio automático a quien no ha firmado y estado "visto / no visto".
440. Reportes: exportar a Excel con formato (no solo CSV) y programar envío mensual por correo a dirección.
441. Reporte por fuente: cuántas ventas vinieron de sitio, Facebook, portales, referidos, letrero/QR.
442. Simulador Infonavit del panel y comparador público hacen cálculos parecidos con pantallas distintas: un solo motor y una sola interfaz.
443. Zonas: el precio por m² se captura a mano; sugerirlo a partir de las ventas reales cerradas en esa zona (ya existen `ventas`).
444. Zonas: registrar la fecha de la última actualización del precio por m² y avisar si tiene más de 6 meses.
445. Asesores: foto obligatoria para aparecer en "Nosotros".
446. Búsqueda global: incluir citas, mensajes y documentos, no solo clientes, propiedades y teléfonos.
447. Atajos de teclado documentados (ya existe "/" para buscar): N para nuevo, G+P para prospectos, etc.
448. Modo "presentación" para mostrar una propiedad al cliente en la tableta sin datos internos.
449. Imprimir la ficha de visita del día (dirección, llaves, contacto del dueño) desde "Mi día".
450. Inspecciones: comparar entrada contra salida en rentas (fotos lado a lado).
451. Construcción y remodelación: compartir avance con el cliente por enlace (como el informe del vendedor).
452. Materiales: alerta de precio cuando un material sube más de X % respecto a la última compra.
453. Las decoraciones de temporada (calaveras, murciélagos, confeti) solo se apagan con `?temporada=ninguna` en la URL; no hay interruptor en el panel.
454. Borrar una propiedad es definitivo (borra en cascada visitas, bitácora y cambios): agregar papelera o "archivar" en lugar de borrar.
455. No hay forma de destacar a mano una propiedad en el inicio (las destacadas se eligen solas por rebaja y fecha); útil para exclusivas o desarrollos.
456. No hay una sección de configuración del negocio (teléfono, dirección, horarios, redes, textos del inicio): todo está en código y requiere un despliegue para cambiar un horario.
457. Los textos del sitio (hero, nosotros, misión) solo se editan en los JSON de traducción; un editor sencillo en el panel evitaría depender de un programador.
458. Al cambiar el precio, preguntar si se avisa a los interesados (ya existe la alerta de baja de precio; hacerlo explícito y mostrar a cuántos les llegará).
459. Al marcar una propiedad como vendida, pedir los datos de la venta (precio final, fecha, asesor) en el mismo paso para que Reportes y "días para vender" no dependan de capturarlo aparte.
460. Plantilla de mensaje para avisar al dueño cada cambio de estatus de su propiedad.
461. Vista "Mis propiedades" para el asesor con sus pendientes por propiedad (fotos faltantes, informe del mes, llaves).
462. Indicador de propiedades sin asesor asignado.
463. Al desactivar un asesor, avisar qué citas futuras, prospectos y propiedades se quedan huérfanos.
464. Preferencias de notificación por usuario (qué avisos quiere por push, correo o WhatsApp).
465. Tablero del dueño de la inmobiliaria: margen por operación (comisión − gastos de la liquidación) por mes.
466. Registro de operaciones compartidas con otras inmobiliarias o asesores externos (porcentaje, contacto).
467. Generar el texto de la publicación en inglés además de español (el generador de anuncios ya existe).
468. Etiquetar fotos por espacio (cocina, recámara, fachada) para ordenar la galería y alimentar el texto alternativo.
469. Detección de fotos repetidas o muy oscuras al subirlas (ya existe `imageQuality.js` para documentos; reutilizarlo en fotos de propiedad).
470. Recordatorio de actualizar fotos de propiedades con más de 6 meses publicadas.
471. Novedades del sitio no avisa dentro del panel cuando hay una entrada nueva sin leer.
472. Reportes de ventas sin comparación entre periodos (este mes contra el mismo mes del año anterior).
473. Las plantillas de mensajes de WhatsApp viven en código (`messageTemplates.js`): hacerlas editables desde el panel.
474. Clientes y Prospectos son dos listas de personas separadas: la misma persona se captura dos veces y el panel muestra "Clientes 0" aunque haya prospectos. Unificar en un solo contacto con etapas.
475. El formulario de propiedad no tiene enlace "Ver en el sitio" ni vista previa de cómo se verá la ficha antes de publicar.
476. Contador de caracteres y longitud recomendada en la descripción de la propiedad (la meta descripción se corta a 155 caracteres).

## Sistema, datos y desarrollo (477–506)

477. Chat: `chat_rate_limits` crece sin límite (no hay limpieza programada).
478. `whatsapp` está repetido en la expresión de bots. `middleware.js:27`
479. `updated_at` de propiedades se llena con el reloj del navegador del asesor, no con un disparador en la base: cambios hechos por otros caminos (venta, lote) no lo actualizan y el `lastmod` del sitemap queda mal.
480. Correo HTML del enlace de visita con comentario copiado de otro proyecto ("hora de pared del consultorio"): revisar que no haya más textos heredados. `supabase/functions/_shared/visitEmail.js`
481. El valor interno de la operación "venta" es `compra` (se migró así): confunde a quien mantenga el código y a quien lea la base. Renombrar a `venta`.
482. Hay dos funciones `slugify` con reglas distintas (guion bajo en `format.js`, guion en `zoneLandingPages.js`).
483. El CI instala dependencias dos veces (`test` y `e2e`) y descarga Chromium en cada corrida sin caché.
484. El CI no cancela corridas viejas del mismo PR (`concurrency`) ni fija las acciones por SHA.
485. Ningún paso revisa vulnerabilidades de dependencias (`npm audit` o similar).
486. El linter deja pasar 19 avisos (dependencias de efectos, parámetros sin usar, exportaciones mixtas en contextos); hacer que el CI falle con avisos nuevos.
487. Los cuatro contextos (`Auth`, `Theme`, `Favorites`, `Compare`) exportan hooks y componentes en el mismo archivo: rompe la recarga en caliente en desarrollo.
488. No hay `engines` en `package.json` ni `.nvmrc`: el CI usa Node 22 pero nada obliga a usarlo localmente.
489. Sin formateador (Prettier/Biome) ni `.editorconfig` ni ganchos de pre-commit.
490. Dependencias solo de servidor (`@anthropic-ai/sdk`, `@napi-rs/canvas`, `google-auth-library`) viven en `dependencies` junto con las del navegador; separarlas o documentarlo para no importarlas por error en el cliente.
491. `@napi-rs/canvas` es binario nativo pesado para funciones serverless: revisar si sigue usándose.
492. El README pesa 145 kB en un solo archivo; separarlo en `docs/` por módulo (instalación, panel, base de datos, funciones).
493. No hay pruebas de componentes (Vitest corre en entorno `node`); solo lógica y e2e. Agregar Testing Library para los formularios críticos.
494. No hay reporte de cobertura de pruebas.
495. El flujo "Registrar cambio en Novedades" copia el cuerpo completo del PR (markdown, enlaces internos) a `site_updates`; resumirlo o limpiar el texto.
496. Las funciones de WhatsApp usan `Deno.env.get(...)!`: si falta la variable, truenan sin mensaje claro en vez de responder "no configurado".
497. `index.html` no tiene `<noscript>` ni contenido de respaldo: sin JavaScript la página queda en blanco.
498. El manifiesto bloquea la orientación vertical (`portrait`): en tableta horizontal la app instalada no gira.
499. Las cinco páginas con token repiten el mismo patrón de carga, error y encabezado; un componente `TokenPage` común evitaría que una se quede atrás (p. ej. /firmar sin título).
500. `localBackend.js` y `supabaseBackend.js` duplican reglas de negocio (validaciones, cálculos) que pueden divergir; mover las reglas a `lib/` compartido y dejar los backends solo con acceso a datos.
501. Borrar una propiedad deja en Storage sus fotos, videos (hasta 100 MB cada uno) y fotos 360°; solo se limpian los comprobantes de bitácora. `supabaseBackend.js:389`
502. El registro de vistas vive dentro del componente del indicador (`RecentViewsBadge`): si alguien quita el indicador, se deja de registrar la vista y se pierden los datos para el informe del vendedor.
503. `book_visit` está definida en `schema.sql` y en `agendar-visita.sql`: la versión que queda depende del orden en que se ejecuten a mano.
504. La zona se guarda como texto en cada propiedad: renombrar una zona actualiza propiedades en una segunda consulta (sin transacción) y no toca las alertas de clientes ni las preferencias de prospectos, que dejan de coincidir. Usar el id de zona. `supabaseBackend.js:514`
505. No hay pruebas automáticas de las políticas RLS contra una base real (p. ej. pgTAP): un cambio de política que abra datos no lo detecta ninguna prueba.
506. Las ciudades del pie y de las páginas por zona están fijas en código (`ZONE_LANDING_CITIES`): una ciudad nueva (p. ej. Matamoros, Francisco I. Madero) requiere programador.
