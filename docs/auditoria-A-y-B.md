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
| 400 | La ficha trae «Reportar un error»: abre Contacto con el mensaje ya empezado (código y enlace de la publicación). |

## Pruebas

- Unitarias: 2,015. e2e nuevo: `e2e/auditoria-a-y-b.spec.js`.

## Pasó a otro grupo

- **424** (gráfica del historial de precios): la base solo guarda el precio anterior, no el historial completo; necesita una tabla nueva → grupo C (SQL).
