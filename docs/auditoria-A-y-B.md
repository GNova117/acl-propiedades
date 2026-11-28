# Tanda «A y B» (pendientes sin SQL)

Primera pasada por los grupos A (diseño/decisión) y B (construibles sin SQL) de `docs/pendientes-para-el-final.md`. Para los puntos de diseño se tomó una decisión razonable por omisión; se pueden ajustar después sin tocar datos.

## Despliegue

Solo publicar el sitio (merge a `main`). Sin migraciones nuevas.

## Hecho

| # | Qué cambió |
|---|---|
| 381 | El visor de fotos se cierra deslizando hacia abajo (en el teléfono). |
| 402 | Cuando no hay resultados, el listado sugiere el filtro que más resultados devuelve al quitarlo («Quitar “Precio máx.”: 7 resultados»). |
| 403 | Una propiedad «no encontrada» muestra propiedades disponibles del mismo tipo que sugiere la dirección. |
| 409 | Aviso al salir con cambios sin guardar en los formularios del panel (propiedad, cliente, prospecto, cita, asesor, blog). |
| 431 | Al guardar una cita que se empalma con otra del mismo día se pide confirmar. |
| 445 | «Nosotros» solo muestra asesores con foto; el formulario del asesor avisa que la foto es necesaria. |
| 463 | Al desactivar a un asesor se avisa cuántas propiedades y prospectos tiene asignados. |
| 447 | Atajos de teclado en el panel: «G» y luego D, H, P, C, A, M u O (inicio, Mi día, Prospectos, Clientes, Agenda, Mensajes, Propiedades); no se activan al escribir. Documentados en la Ayuda. |
| 368 | Contacto dice «Abierto ahora» o «Cerrado ahora» según la hora de Torreón (no la del visitante). |
| 378 | Cada artículo del blog tiene el botón «Compartir». |
| 383 | El mapa del listado deja elegir entre calles y satélite (Esri); el filtro del modo oscuro ya solo aplica a las calles. |
| 404 | La ficha dice «Bajó $X (N %) hace N días» junto al precio anterior tachado. |
| 405 | Favoritos avisa cuántas de tus guardadas bajaron de precio o ya no están disponibles. |
| 406 | La página de un desarrollo trae el formulario de contacto (con el desarrollo ya mencionado en el mensaje). |
| 408 | En el formulario de propiedad, «Buscar en el mapa» ubica la dirección (Nominatim, solo al pulsar) y llena latitud y longitud. |
| 411 | La lista de propiedades del panel muestra el asesor («Ana y 1 más») y cuántos días lleva publicada. |
| 421 | Las fotos de una propiedad se reordenan con ◀ ▶; la foto principal sigue siendo la misma al moverlas. |
| 416 | Mensajes: casilla «Ocultar alertas de búsqueda (N)» (apagada de inicio; dice cuántas hay). |
| 430 | Al avanzar un prospecto de etapa sin seguimiento vigente, el sistema programa el siguiente según la etapa (nuevo 1 día, contactado 2, interesado 3, negociación 2) y lo avisa. |
| 437 | La lista de clientes trae el semáforo del expediente (completo / faltan N datos, con el detalle al pasar el cursor). |
| 446 | La búsqueda global también encuentra citas de la agenda, desarrollos y artículos del blog. |
| 461 | «Solo mis propiedades» en la lista del panel (para quien tiene un asesor ligado). |
| 351 | El chat sabe qué ficha tienes abierta: manda el código y el servidor lo resuelve (solo propiedades públicas) para que «esta casa» tenga sentido. |
| 357 | Contacto trae «¿Qué buscas?» (comprar, rentar, vender, rentar mi propiedad, otro); el motivo viaja como prefijo del mensaje. |
| 360 | «Vende tu casa» ofrece «¿Prefieres rentarla?», que abre Contacto con ese motivo ya elegido. |
| 388 | Los formularios del sitio (Contacto, solicitud de contacto, visita) recuerdan nombre, correo y teléfono después de enviar (solo en el navegador de esa persona). |
| 389 | Tras agendar una visita (o pedirla) aparece «Agendar otra visita», con los datos ya recordados. |
| 396 | Ya estaba resuelto: el visor de fotos acerca con pellizco y recorre la foto con el dedo o el cursor. |
| 440 | Las listas de Propiedades, Clientes, Prospectos y Visitas se exportan también a **Excel de verdad** (.xlsx, sin librerías: números como números, teléfonos como texto, encabezado en negritas y fijo). |
| 448 | Modo presentación (`?presentacion=1`, botón en la ficha): sin encabezado, pie, chat ni formularios, con botón para salir. |
| 449 | «Mi día»: «Imprimir hoja del día» con hora, qué, dónde, contacto y notas de cada visita que falta. |
| 469 | Al subir fotos de una propiedad se avisa de las muy oscuras, muy quemadas o repetidas (en el navegador, solo aviso). |
| 470 | La lista del panel marca «Revisar fotos: N meses sin cambios» en propiedades disponibles sin tocar en 6 meses o más. |
| 472 | Reportes de ventas compara contra el mismo periodo del año anterior (cuántas ventas y volumen, con porcentaje). |
| 376 | Naves: la ficha técnica muestra también los pies cuadrados («≈ 21,528 ft²»). El precio en dólares **no** se hizo: necesita un tipo de cambio que tú definas (ver pendientes). |
| 427 | El listado del panel tiene «Ver en mapa» con todas las propiedades filtradas. |
| 442 | Un solo motor de créditos (`lib/loanMath.js`: pago mensual y su inverso) para el simulador Infonavit del panel, el comparador público y el «desde $X al mes» de las tarjetas. La interfaz sigue siendo de dos pantallas (decisión de diseño en el grupo A). |
| 443 | Zonas sugiere el precio por m² (construido y terreno) con la mediana de lo vendido en la zona (mínimo 3 ventas), con botón «Usar». |
| 467 | El generador de anuncios tiene selector de idioma (español o inglés); en inglés se siguen verificando precio, recámaras, baños y m² contra la ficha (sin convertir a dólares ni pies²). |
| 480 | Revisados los textos heredados: solo quedaba «consultorio» en un comentario de `visitEmail.js`. |
| 482 | Un solo módulo de «slugs» (`lib/slug.js`): `keySlug` (guion bajo, llaves) y `urlSlug` (guion, direcciones); las tres copias lo usan. |
| 486 | El lint del CI falla si aparece un aviso nuevo (tope en 24, los de hoy). |
| 490–491 | Dependencias solo de servidor documentadas (`docs/dependencias-servidor.md`) y una prueba que falla si `src/` las importa; `@napi-rs/canvas` sigue en uso (vistas previas y QR). |
| 502 | La vista de una propiedad se registra con un hook aparte (`usePropertyViews`); el indicador solo muestra el número. |
| 503 | Ya estaba cubierto: `agendar-visita.sql` es copia exacta de `schema.sql` y una prueba falla si dejan de coincidir. |
| 487 | Los cuatro contextos de React (Auth, Tema, Favoritos y Comparar) separan el hook y el contexto (`useAuth.js`, etc.) del componente proveedor: ya no rompen la recarga en caliente y el lint bajó de 24 a 20 avisos (el tope del CI también). |
| 492 | El README (226 kB) pasó a 13 kB: el detalle de las funciones se separó por tema en `docs/readme/` (7 archivos; se verificó que no se perdió ninguna línea). |
| 493 | Pruebas de componentes con Testing Library + jsdom: el formulario de Contacto (validación, anti-spam, motivo, datos recordados, tope de un envío por minuto), la tarjeta «¿Te interesa esta propiedad?» y el hook de páginas privadas. |
| 494 | `npm run test:coverage` (73 % de líneas, 86 % de funciones, 89 % de ramas en `lib`, servidor y funciones de Supabase) y el CI deja el resumen en cada corrida. |
| 499 | Las páginas con enlace secreto (firma, documentos, visita, informe, opinión, selección, registro y baja de alertas) comparten un solo hook (`usePrivatePage`): no se indexan ni se archivan, **no mandan la dirección como «referrer»** (antes la visita, los documentos, la baja de alertas y la firma no lo hacían). La firma ya traía su `noindex` y su título con `<Seo>`; solo se le agregó el «referrer». |
| 501 | Al borrar una propiedad también se borran sus fotos (con sus copias en varios tamaños), videos, fotos 360° y plano de Storage (antes solo los comprobantes de la bitácora). |
| 450 | «Comparar inspecciones» (en la lista de inspecciones): dos inspecciones lado a lado con qué empeoró, qué mejoró y las fotos de cada una; sugiere las dos más recientes de la propiedad. |
| 452 | Al editar un material, si un precio sube más de 15 % se pide confirmar (con el antes, el después y el porcentaje). Es contra el precio que tenía al abrirlo: el catálogo no guarda las compras (el historial de compras queda para el grupo C). |
| 465 | Reportes de ventas → Utilidad: tabla «Utilidad por mes» (ventas, volumen, utilidad de la oficina y margen sobre lo liquidado, con las ventas aún sin liquidar señaladas). |
| 505 | Nueva prueba de SQL (`20_politicas_rls.sql`, corre en el CI contra Postgres de verdad): toda tabla pública tiene RLS; un visitante anónimo y una sesión sin apartados no ven mensajes, prospectos, clientes, ventas, liquidaciones, bitácora ni llaves; el anónimo no puede cambiar ni borrar lo de otros. Se comprobó que falla si se apaga la RLS de una tabla o se abre una política. |
| 179 (parte) | Traducidos al inglés los textos fijos de Liquidación (14), Mi perfil (5), el formulario de asesor y la lista de asesores. **Construcción** queda en español por una decisión que ya estaba documentada en el código (herramienta interna para personal hispanohablante). **Secretaría** (toda la pantalla) sigue sin traducir: es un trabajo aparte de unas 100 cadenas. |
| 229 | «Mensajes» ya no baja el catálogo completo de propiedades ni todos los prospectos: pide solo código, título, precio y asesores de cada propiedad (`getPropertyRefs`) y solo los ids de los mensajes ya convertidos en prospecto (`getPromotedMessageIds`). |
| 226 | El sitio público ya no inicializa la sesión de Supabase Auth: `AuthProvider` vive solo dentro del panel (`AuthShell`, que envuelve las rutas `/admin/*`). La ficha pregunta si hay sesión solo cuando la propiedad está desactivada (`useHasSession`). El JS inicial bajó de 265.7 a 260.6 KB. Una prueba vigila que `main.jsx` y las piezas públicas no vuelvan a pedir la sesión. |
| 221 | Las páginas de ciudad y colonia piden solo 7 columnas de las propiedades activas para su resumen de mercado (`getMarketRows`), no el catálogo completo con fotos. |
| 234 | Inter pasa a una sola fuente variable (48 KB en lugar de 97 KB). |
| 203 | Se mantiene la decisión de la tanda 201–220: no se responde 404 real a rutas desconocidas (exigiría listar en el servidor todas las rutas válidas y se desactualiza con cada página nueva); la pantalla dice «404» y lleva `noindex`. |
| 250 | El chat anuncia sus respuestas (la lista es `role="log"` con `aria-live`) y el indicador «escribiendo» es un `status`. |
| 252 | Las amenidades del filtro y «¿Cómo te avisamos?» son `<fieldset>` con `<legend>` (se anuncian como grupo) y se ven igual que antes. |
| 253 | El pie usa `<h2>` en lugar de `<h4>` (sin saltar niveles) y el inicio de sesión del panel tiene `<main>`. |
| 255 | La foto del asesor en su tarjeta lleva `alt=""` (su nombre ya está al lado). |
| 257, 260 | `prefers-reduced-motion`: el hero (crecer y zoom), la pantalla de carga y el spinner (que gira más despacio) respetan la preferencia. El visor de fotos, Reveal y las partículas ya la respetaban. |
| 261 | Contacto y la tarjeta «¿Te interesa?»: cada campo con error apunta a su mensaje (`aria-describedby`), al enviar con errores el foco va al primer campo con error y el aviso de éxito ya era `status`. El resto de formularios queda para otra pasada con el mismo helper (`lib/formErrors.js`). |
| 276 | Un estatus que no es disponible, apartada, vendida o rentada sale en gris neutro (`badge-neutral`), no con el rojo de «vendida». |
| 287 | «Más filtros» arranca cerrado y se abre solo si ya hay aplicado alguno de los de adentro (superficie, recámaras, baños, estacionamientos o amenidades). |
| 289 | El buscador del inicio y el listado ya no ofrecen tipos de propiedad desactivados. |
| 290 | El menú de compartir en escritorio se cierra al tocar fuera, con Escape (devuelve el foco al botón) y al elegir una opción; tras copiar el enlace muestra «Enlace copiado» un momento y se cierra. |
| 299 | Ya estaba resuelto: Contacto y el pie usan el ícono real de WhatsApp. |
| 300 | Contacto trae botones grandes «Llamar» y «Escribir por WhatsApp» (la lista de datos sigue debajo). |
| 305 | El mapa del listado trae una leyenda de colores por tipo (solo los tipos que hay en el mapa; con un solo tipo no se muestra). |
| 312 | La ficha ofrece el comparador de créditos una sola vez: dentro de la calculadora (la que se abre con «Personalizar»); la tarjeta aparte solo sale en propiedades sin estimado (terrenos, naves y rentas). |
| 319 | En la ficha, la aclaración del pago mensual (enganche, plazo y tasa) va detrás de «ⓘ ¿Cómo se calcula?» en lugar de 2–3 renglones siempre visibles. |
| 323 | En el listado, con más de 6 resultados el aviso «avísame» aparece después de la primera tanda de tarjetas (ocupa todo el ancho de la fila); con pocos resultados sigue al final. |
| 336 | Las pantallas internas del panel (editar, ficha, bitácora…) traen arriba «‹ Volver a <apartado>», igual en todas; se arma una sola vez en el diseño del panel a partir del menú. Las listas y el inicio no la llevan. |
| 337 | En Mensajes y Firmas, a la vista queda la acción principal de cada renglón y lo demás (incluido «Eliminar») va tras «Más»; Propiedades, Clientes y Prospectos ya lo tenían. |
| 331 | Las cifras del inicio del panel enlazan a su lista (propiedades, asesores, clientes, remodelaciones y los totales por tipo) y, donde hay fechas de alta, dicen «+N este mes · M el mes pasado». |
| 332 | El respaldo y la retención de papelería tienen su propio apartado «Respaldo» en la carpeta Oficina (ruta `/admin/respaldo`); «Roles y accesos» solo trae un enlace, y el aviso del inicio lleva ahí. |
| 325 | En Prospectos, en teléfono, «Pegar o importar lista», «Importar desde visitas» y los exportes van tras un menú «⋯ Más»; «Nuevo» y «Seleccionar» siguen a la vista. En pantalla grande no cambia nada. |
| 326 | En Prospectos, la búsqueda y el selector de asesor dejan el estilo nativo del navegador y usan el mismo borde, radio y foco que los demás campos. |
| 271 | En teléfono el botón flotante del chat ya no tapa el texto de la ficha: el chat se abre desde un tercer botón «Chat» en la barra de contacto (junto a «Agendar visita» y «WhatsApp»); el flotante solo reaparece con el chat abierto, para poder cerrarlo. (Ocultarlo sin más habría quitado el chat que manda el código de la propiedad.) |
| 285 | La ficha se imprime limpia (o «Guardar como PDF»): sin menú, pie, chat, barras, formularios, mapa, migas ni enlaces de volver; texto negro sobre blanco; una sola foto; tarjetas sin partirse a la mitad. |
| 297 | La ficha muestra migas de pan (Inicio › tipo › título) y son la misma lista que se manda a Google en los datos estructurados, así que nunca se contradicen. Van en el mismo renglón que «Volver a propiedades». |
| 298 | En laptop (1366×800) la galería se limita a ~46 % del alto de pantalla y el título, el estatus y el precio se ven en la primera pantalla. |
| 308 | Lo que se escribe en un formulario de la ficha (contacto, visita, reserva, alerta) rellena los campos vacíos de los otros y no se pisa lo ya escrito. Solo vive en memoria: no se guarda en el navegador hasta enviar un formulario. |
| 222 | Las imágenes de las tarjetas de categoría del inicio pasan de `background-image` a `<img>` con `loading="lazy"` y `srcset` (480 y 900 px; solo para fotos de stock de Unsplash, que aceptan el ancho en la dirección). Las dos fotos de 1400 px de los paneles gigantes desaparecen con ellos. |
| 264 | La portada del inicio es un solo bloque con el buscador arriba: en laptop (1366×800) y en teléfono (390×844) el botón «Buscar propiedades» queda dentro de la primera pantalla, con «¿Prefieres hablar con alguien? Llámanos al 871 324 3271 · WhatsApp» debajo. La foto o video propios (`VITE_HERO_*`) se conservan: ahora son el fondo de este bloque. |
| 265 | Desaparece el panel de «Naves Industriales / Próximamente» de la portada. Las naves siguen anunciadas (o como «Próximamente» si están desactivadas) en las tarjetas de categoría, más abajo. |
| 266 | El inicio en teléfono pasa de ~8,840 a ~5,260 px (datos de demostración): las destacadas van en una fila que se desliza de lado (antes seis tarjetas apiladas), las categorías de dos en dos y más bajas, y de testimonios y blog solo los primeros; el video y las reseñas bajan en la página. |
| 315 | Bloque «Te decimos cuánto vale tu propiedad» para quien quiere vender o rentar, con «Quiero vender mi propiedad» (→ Vende tu casa) y «Hablar con un asesor» (→ Contacto). |
| 320 | Se quitan los dos paneles gigantes, que repetían lo que ya hacían el selector de tipo del buscador y las tarjetas de categoría: quedan dos formas distintas (buscar y explorar por tipo). |
| 268 | El logotipo del encabezado pasa de ~56 a ~85 px de ancho (3.3 em de alto; el encabezado conserva sus 72 px). |
| 269 | El teléfono de la oficina (`tel:`) va siempre a la vista en el encabezado de pantalla grande; en laptop chica queda solo el ícono. |
| 270 | En teléfono el menú trae «Favoritos» con texto. (Falta «Desarrollos»: hoy no existe una página que liste los desarrollos; se hace junto con el inicio.) |
| 318 | En teléfono el encabezado solo lleva logotipo, favoritos (y comparar si hay algo) y menú; tema e idioma pasaron al menú, junto con un botón «Llamar». |
| (extra) | El menú cerrado del teléfono ya no es alcanzable con Tab ni por lectores de pantalla (`visibility: hidden` tras la animación de cierre): antes sus enlaces seguían recibiendo foco aunque no se vieran. |
| 261 (visitas y alertas) | La solicitud de visita, la reserva de horario y la alerta «avísame» ahora ligan cada error a su campo (`aria-invalid` + `aria-describedby`) y, al enviar con errores, llevan el foco al primer campo con error: el mismo patrón que ya tenía Contacto. |
| 322 | La zona del buscador del inicio y del filtro del listado es un selector con búsqueda (`ZoneCombobox`) en vez de un `<datalist>` nativo: la lista se ve debajo del campo al enfocarlo, filtra al escribir sin importar acentos ni mayúsculas (primero las que empiezan con el texto), se maneja con ↑ ↓ Enter Esc, se elige tocando y sigue aceptando texto libre. Patrón combobox con `role="listbox"` y `aria-activedescendant`. |
| 281 | Los textos largos (descripción de la propiedad, entradas del blog y el aviso de privacidad/términos) se leen en el color de texto normal; el gris global de `<p>` se queda para textos de apoyo (pies, ayudas, metadatos), que son la gran mayoría de los párrafos del sitio. Una prueba compara el color calculado. |
| 254 | En las tablas del panel, los `<th>` vacíos ahora tienen texto para lectores de pantalla («Foto», «Acciones», «Característica») y la zona de una tabla que se desborda de lado se vuelve enfocable con teclado y con nombre («Tabla con desplazamiento horizontal»): un solo efecto en el diseño del panel (`scrollableRegions.js`) en vez de editar las 43 tablas. Solo se marca la que de verdad se desborda. |
| 254 | En las tablas del panel, los `<th>` vacíos ahora tienen texto para lectores de pantalla («Foto», «Acciones», «Característica») y la zona de una tabla que se desborda de lado se vuelve enfocable con teclado y con nombre («Tabla con desplazamiento horizontal»): un solo efecto en el diseño del panel (`scrollableRegions.js`) en vez de editar las 43 tablas. Solo se marca la que de verdad se desborda. |
| 258 | Áreas táctiles de al menos 32 px en el pie (enlaces legales), títulos de tarjetas y desarrollos, datos de contacto, «Volver», «¿Cómo se calcula?», «Personalizar», preguntas frecuentes, «Pantalla completa» y acercar/alejar del mapa. Quedan fuera lo que no es nuestro: atribución de Leaflet/OpenStreetMap, barra de rango y círculos de radio nativos. |
| 259 | El botón «Comparar» de tarjetas y ficha trae su palabra (antes era un cuadro vacío); su nombre accesible es el texto visible y `aria-pressed` dice si está marcado. |
| 294 | Los `z-index` de 100 o más salen de una escala de variables en `index.css` (`--z-header`, `--z-chat`, `--z-dialog`, `--z-toast`, `--z-lightbox`…), con los mismos valores de antes (no cambia nada a la vista). Una prueba (`zIndexScale.test.js`) impide números sueltos nuevos y vigila el orden de las capas. |
| 329 | En la tabla de propiedades, «Activo/Inactivo» se ve y se anuncia como interruptor (con su palanca, `role="switch"` y una ayuda al pasar el cursor), no como una etiqueta más. |
| 330 | El aviso «Toca respaldar» del inicio del panel trae su enlace como botón (antes era un enlace suelto dentro del texto). |
| 333 | El menú del panel gana la carpeta «Sitio web» (Testimonios, Blog y Novedades salen de Clientes y de Oficina). |
| 334 | El buscador global del panel muestra un texto corto («Buscar…  ( / )»); el nombre accesible conserva el texto completo. |
| 335 | El menú lateral muestra el correo de quien inició sesión y su rol, junto a «Cerrar sesión» (se oculta en el modo compacto). |
| 400 | La ficha trae «Reportar un error»: abre Contacto con el mensaje ya empezado (código y enlace de la publicación). |

## Pruebas

- Unitarias: 2,155. e2e local: 972 (+32 omitidas). e2e local: 959 (+31 omitidas). CI de GitHub en verde para `e23d276`. SQL: 20 pruebas. e2e nuevo: `e2e/auditoria-a-y-b.spec.js`.

## Pasó a otro grupo

- **401** (conteo de propiedades por zona en el filtro): sin una consulta agregada por zona cada conteo pediría el catálogo completo; necesita una función en la base → grupo C (SQL).
- **375** (página por asesor): el sitio hoy no expone qué propiedades tiene cada asesor (decisión de privacidad) y no hay una consulta pública por asesor → grupo A/C.
- **424** (gráfica del historial de precios): la base solo guarda el precio anterior, no el historial completo; necesita una tabla nueva → grupo C (SQL).


## Decisiones del dueño (28 nov)

- **La ficha no muestra al asesor** → 354 (WhatsApp al asesor de la propiedad), 355–356 (unificar lo que piden los formularios según el asesor) y 317 (foto y nombre del asesor en la visita) **se cierran sin hacerse**: el WhatsApp de la ficha sigue yendo a la oficina.
- **El precio es solo en pesos mexicanos** → 376 (precio en dólares) **se cierra**; los pies cuadrados para naves ya estaban hechos.
- **Todo lo demás de inicio y ficha lo decide el equipo técnico pensando en el largo plazo**, con propuesta y capturas en cada tanda.
- **286** (buscador del inicio y filtros del listado): se deja como está a propósito. El del inicio es una búsqueda rápida (tipo, zona, precio, código) que lleva al listado con los mismos parámetros que usan los filtros; unificar las dos pantallas en una sola sacrificaría la portada o el listado. Lo que sí se unificó es el selector de zona (322).
