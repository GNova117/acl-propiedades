# Pendientes para el final (lista maestra)

Acuerdo: las 400 mejoras se hacen por tandas. **Lo que necesita rediseño, decisión tuya, datos de tu negocio o SQL se va guardando aquí** y se hace todo junto al final, para no estar batallando. Esta lista se actualiza en cada tanda: lo que se hace se mueve a la tabla «Hecho» del documento de su tanda y sale de aquí.

Numeración = la de `docs/auditoria-areas-de-oportunidad.md` (101–506).

## Cómo se maneja el SQL

- Todo el SQL nuevo se escribe como migración (`npm run migration:new -- "Qué hace"`), con su prueba en `supabase/testdb/tests/`.
- **Todo junto, para pegarlo una sola vez:** `supabase/pendiente-de-aplicar-0118-en-adelante.sql` (se regenera con `npm run sql:pendiente`; una prueba vigila que esté al día). Hoy trae las migraciones **0118 a 0130**. Al final de cada tanda con SQL nuevo se regenera y ese mismo archivo crece.
- Las funciones que dependen de SQL **se programan al final** (junto con su migración), no antes: así el sitio nunca queda esperando algo que la base todavía no tiene.

## A. Necesitan diseño o decisión tuya (sin SQL)

**Inicio y navegación**: 222 fondos del inicio con `srcset`/carga diferida · 264 hero a pantalla completa y buscador bajo el pliegue · 265 panel de naves «Próximamente» · 266 inicio muy largo en teléfono · 267 «Torres y desarrollos» ocupa la primera pantalla · 268 logotipo pequeño · 269 teléfono/WhatsApp en el encabezado · 270 menú con Desarrollos, Terrenos y Favoritos · 271 el chat tapa texto en la ficha · 277 «Nosotros» con historia, años, certificaciones y fotos · 286 buscador del inicio vs filtros del listado (dos interfaces) · 298 primera pantalla de la ficha en laptop · 315 bloque para vendedores · 316 desarrollos y herramientas en el inicio · 318 menos botones en el encabezado del teléfono · 320 categorías repetidas con el hero.

**Ficha y tarjetas**: 251 botones dentro de enlaces y 3 enlaces por tarjeta · 285 estilos de impresión de la ficha · 302 testimonios con página y reseñas · 308 formularios duplicados en la ficha · 317 foto y nombre del asesor en la visita.

**Accesibilidad que toca varias pantallas**: hechos 250, 252, 253, 254, 255, 257, 258, 259, 260 y 261 (en Contacto y «¿Te interesa?»); quedan 249 marcadores del mapa y gráficas · 261 en el resto de formularios.

**Estilos globales**: completo (281, 294 y 322 hechos).

**Panel (diseño)**: completo. Hechos: 325, 326, 329, 330, 331, 332, 333, 334, 335, 336, 337.

**Contenido que solo tú puedes dar**: 199 texto propio por ciudad · 358 «te respondemos en X horas» (promesa de negocio) · 359 proceso y comisión en «Vende tu casa» · 365 créditos Fovissste, Cofinavit y Unamos · 366 enlace de precalificación Infonavit · 370 página de servicios (remodelación y construcción) · 390–394 guías, glosario y costos del comprador · 422 plantillas de descripción.

## B. Se pueden construir sin SQL (se hacen antes del final)

Ya hechos en `docs/auditoria-A-y-B.md`: 351, 357, 360, 368, 376 (pies²), 378, 381, 383, 388, 389, 396, 400, 402, 403, 404, 405, 406, 408, 409, 411, 416, 421, 427, 430, 431, 437, 440, 442 (motor), 443, 445, 446, 447, 448, 449, 461, 463, 467, 469, 470, 472, 480, 482, 486, 487, 490, 491, 492, 493, 494, 450, 452 (al editar), 465, 499 (hook común), 501, 502, 503, 505 (SQL en el CI). Quedan de este grupo: 354–356 WhatsApp al asesor de la propiedad y formularios con lo mínimo (decisión de privacidad: hoy la ficha no muestra al asesor) · 364 unificar calculadora y «Vende tu casa» · 458–460 avisos al cambiar precio y estatus (envío a interesados: necesita servidor) · 500 reglas compartidas entre backends · 376 precio en dólares (necesita un tipo de cambio que tú definas).

## C. Necesitan Supabase / SQL (se hacen al final, con todo el SQL junto)

**Propiedad y catálogo**: 375 página pública por asesor (propiedades asignadas visibles: consulta pública y decisión de privacidad) · 432–433 agenda: traslados y color por tipo de cita (la cita no tiene «tipo» guardado) · 401 conteo por zona en el filtro (función agregada en la base) · 424 gráfica del historial de precios (hace falta una tabla de historial) · 172 amenidades y tipos en dos idiomas · 256 y 468 descripción y etiqueta por foto · 311 preguntas frecuentes por propiedad · 338 sección de Rentas (precio mensual, amueblado, mascotas, depósito, plazo, disponibilidad) · 339–344 precio por m², m² de terreno y construcción, mantenimiento, datos de terreno y etiquetas de crédito · 346 (ya hecho en el cliente) · 377 datos de naves (kVA, andenes, distancia a carretera) · 385–386 privada, piso, elevador y cajones · 425 estatus «en negociación» · 426 propietario ligado a la propiedad · 454 papelera de propiedades · 455 destacar a mano en el inicio · 412 archivar vendidas automáticamente.

**Contenido y marketing**: 200 y 418 blog con categorías, etiquetas, autor, URL editable, programación y versión en inglés · 371 casa abierta · 372 referidos · 373 boletín · 374 testimonios con video · 419 testimonios con foto, fecha y origen · 387 «avísame si se libera» · 444 fecha de actualización del precio por m².

**Panel y operación**: 452 historial de compras de materiales (alerta contra la última compra) · 413 prospecto con crédito, monto y urgencia · 414 permisos de solo lectura por sección · 428 spam y bloqueo · 429 recordatorio de mensajes sin atender · 434 citas recurrentes · 435–436 etiquetas y cumpleaños de clientes · 438–439 vencimiento de documentos y recordatorio de firmas · 441 reporte por fuente · 451 avance de obra compartido por enlace · 453 interruptor de temporada · 456–457 configuración del negocio y textos editables · 464 preferencias de notificación · 466 operaciones compartidas con otras inmobiliarias · 471 novedades sin leer · 473 plantillas de WhatsApp editables · 474 unificar Clientes y Prospectos · 481 renombrar `compra` → `venta` · 504 renombrar una zona con transacción y alertas · 506 ciudades configurables.

## D. Necesitan datos o cuentas tuyas

213 identificadores de Meta Pixel y Google Ads · 225 proveedor de mapas con llave (MapTiler, Stadia o Mapbox) · 236 región del proyecto de Supabase (para fijar la de Vercel) · 365–366 datos de créditos · 237–238 PDFs ya hechos y plantilla optimizada (hace falta el archivo final de diseño).

## E. Rendimiento y estructura (se hacen antes del final, pero con revisión)

Hechos (ver `docs/auditoria-A-y-B.md`): 221, 226, 229, 234, 483–485 (CI), 492, 495 y la parte de 179 que se pudo. 203 se mantiene como decisión (no se hace). Quedan: 235 three.js del recorrido 360° (cambiar el visor por uno ligero) · 179 (resto) traducir toda la pantalla de Secretaría (~100 cadenas); Construcción se queda en español por decisión documentada.
