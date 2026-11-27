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
| 400 | La ficha trae «Reportar un error»: abre Contacto con el mensaje ya empezado (código y enlace de la publicación). |

## Pruebas

- Unitarias: 2,054. e2e nuevo: `e2e/auditoria-a-y-b.spec.js`.

## Pasó a otro grupo

- **401** (conteo de propiedades por zona en el filtro): sin una consulta agregada por zona cada conteo pediría el catálogo completo; necesita una función en la base → grupo C (SQL).
- **424** (gráfica del historial de precios): la base solo guarda el precio anterior, no el historial completo; necesita una tabla nueva → grupo C (SQL).
