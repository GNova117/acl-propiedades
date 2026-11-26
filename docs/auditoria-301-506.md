# Auditoría: puntos 301–506 (octava tanda y pendientes)

Esta tanda cierra lo que se puede arreglar con seguridad y sin una decisión de negocio. Lo demás son **funciones nuevas o rediseños** que conviene priorizar contigo antes de construirlos; están agrupados al final.

## Despliegue

Publicar el sitio (merge a `main`) y **aplicar las migraciones 0129 (índices) y 0130 (`updated_at` de propiedades)** (`npm run db:migrate` o SQL Editor; son re-ejecutables).

## Hecho

| # | Qué cambió |
|---|---|
| 288 | «Limpiar» del filtro queda deshabilitado cuando no hay filtros. |
| 291 | «Copiar enlace» copia solo el enlace (antes el bloque completo con emojis). |
| 296 | Sin reseñas de Google configuradas, el inicio ya no muestra el cuadro difuminado de «Próximamente». |
| 301 | En Contacto, el formulario ya no se estira hasta la altura del mapa. |
| 303 | Ya estaba resuelto: la foto principal muestra su contador («1/12»). |
| 304 | Las tarjetas del listado muestran cuántas fotos tiene la propiedad. |
| 306 | En modo oscuro los mosaicos del mapa se oscurecen (ya no deslumbran). |
| 310 | Ya estaba resuelto: la calculadora tiene campo numérico además del deslizador. |
| 313 | Tras enviar Contacto aparece «Enviar otro mensaje» (y el aviso se anuncia a lectores de pantalla). |
| 314 | La página «Sin conexión» está en español e inglés, ya no habla de «tus datos» (era del panel) y trae el teléfono de la oficina. |
| 321 | Ya estaba resuelto: la etiqueta de rebaja muestra el porcentaje. |
| 324 | En teléfono las tarjetas de cifras del panel van de dos en dos. |
| 327 | «Exportar CSV» deshabilitado explica por qué (texto al pasar el cursor). |
| 328 | El botón flotante «+» ya no tapa la columna de acciones de la última fila de las tablas del panel. |
| 379 | «Vistos recientemente» tiene botón «Borrar historial». |
| 345 | La ficha dice «Publicada hace X días» y «Actualizada el…». |
| 346 | «Propiedades similares» prioriza el precio parecido (±20 %), misma zona primero. |
| 353 | El chat tiene «Nueva conversación». |
| 367 | La visita agendada ofrece «Agregar a Google Calendar» además del archivo `.ics`. |
| 369 | La dirección de Contacto es un enlace a «Cómo llegar». |
| 380 | El visor de fotos tiene botón para descargar la foto actual. |
| 382 | El globo del mapa muestra también recámaras y baños. |
| 384 | El buscador del inicio recuerda la última búsqueda en ese navegador. |
| 410 | Al guardar una propiedad con un precio que parece error de captura (p. ej. $2,450 en una venta o $15,000,000 en una renta) se pide confirmar. |
| 462 | En la lista de propiedades del panel se marca «Sin asesor». |
| 475 | El formulario de propiedad trae «Ver en el sitio». |
| 476 | Contador de caracteres en la descripción (Google muestra ~155). |
| 479 | **Migración 0130**: `updated_at` de propiedades lo fija la base en cada cambio real (ya no depende del navegador). Prueba SQL 19. |
| 477 | Ya resuelto con la migración 0127: `chat_rate_limits` se limpia a diario (1 semana). |
| 478 | Falso positivo: «whatsapp» aparece una sola vez en la expresión de robots. |
| 484 | El CI cancela las corridas viejas del mismo PR (`concurrency`). |
| 485 | El CI corre `npm audit` (avisa de vulnerabilidades altas o críticas de producción; no bloquea). |
| 488 | `engines` en `package.json` (Node ≥ 22) y `.nvmrc`. |
| 489 | `.editorconfig` (formateador y ganchos quedan por decidir). |
| 496 | Las funciones de WhatsApp responden «no configurado» en lugar de tronar si faltan las credenciales. |
| 497 | `index.html` tiene `<noscript>` con el teléfono de la oficina. |
| 498 | El manifiesto ya no bloquea la orientación: la app instalada gira en tableta horizontal. |

## Pendiente: lo que necesita tu decisión

Se agrupan por tipo; dime cuáles quieres y en qué orden.

- **Rediseño del inicio y de la navegación** (264–270, 272, 277, 286, 297–298, 300, 302, 315–320, 322–323): hero a pantalla completa, encabezado con teléfono/WhatsApp, menú, migas visibles, página de Desarrollos y de Nosotros con contenido, bloque para vendedores.
- **Accesibilidad que toca varias pantallas** (249–261, 285): botones dentro de enlaces en las tarjetas, `fieldset`/`legend`, `aria-describedby` y foco en errores, `aria-live` del chat, tablas del panel, áreas táctiles, textos alternativos por foto, impresión de la ficha.
- **Propiedad y ficha** (338–349, 385–386, 404): sección de Rentas, precio por m², m² de terreno y construcción, mantenimiento, datos de terreno y de naves, etiquetas de crédito, «publicada hace X días», varias zonas, comparador ampliado. Algunos exigen columnas nuevas en la base.
- **Chat y formularios** (351–358, 360–366, 387–389, 395): contexto de la propiedad, botones de inicio, rutear al asesor, formularios mínimos, «Vende tu casa» con proceso y rentas, calculadora unificada, comparador con Fovissste y Cofinavit.
- **Contenido y crecimiento** (367–378, 390–394, 396–402, 405–406): Google Calendar, página de servicios, referidos, boletín, páginas por asesor, glosario, calculadoras de escrituración y rentabilidad, mapa satelital, favoritos con avisos, desarrollo con formulario.
- **Panel** (329–337, 407–476): reorganizar el menú y el respaldo, mensajes por canal, formularios con aviso de cambios sin guardar, precios sospechosos, archivado automático, permisos de solo lectura, agenda (empalmes, traslados, recurrentes), clientes (etiquetas, semáforo, cumpleaños), documentos con vencimiento, reportes, configuración del negocio y textos editables, papelera en lugar de borrar propiedades, unificar Clientes y Prospectos.
- **Código y plataforma** (480–483, 486–487, 490–495, 499–506): renombrar `compra`→`venta`, unir los dos `slugify`, caché de `npm`/Chromium en el CI, fijar acciones por SHA, avisos del linter, contextos de React (recarga en caliente), separar dependencias de servidor, partir el README, pruebas de componentes y cobertura, resumir el cuerpo del PR en Novedades, componente común para páginas con token, reglas de negocio compartidas entre los dos backends, limpiar Storage al borrar una propiedad, pruebas de RLS (pgTAP), ciudades configurables.
- **Necesita datos o cuentas tuyas**: 225 (proveedor de mapas con llave), 236 (región de Supabase para fijar la de Vercel), 213 (identificadores de Meta y Google Ads).

## Pruebas

- Unitarias: 1,959. Verificación de e2e: ver el PR.
