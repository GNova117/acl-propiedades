# Pruebas de navegador (e2e)

Pruebas con [Playwright](https://playwright.dev) que abren la app en un navegador real, en **PC** (1366×800) y en **móvil** (390×844, con toques y user agent de iPhone, sobre Chromium), y usan el sitio y el panel como lo haría una persona.

```bash
npx playwright install chromium     # una sola vez
npm run test:e2e                    # todo, en los dos tamaños
npm run test:e2e:ui                 # modo interactivo para depurar
npx playwright test e2e/public.spec.js --project=mobile
npx playwright test -g "menú"       # solo las pruebas cuyo nombre contenga "menú"
```

Al terminar, si algo falló, Playwright deja en `test-results/` una captura y un *trace* de cada falla (`npx playwright show-trace <archivo>/trace.zip`); en CI se sube el reporte HTML como artefacto.

## Cómo corren (y por qué es seguro)

`playwright.config.js` construye la app (`vite build --outDir dist-e2e`), la sirve con `vite preview` y **fuerza `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` a vacío**. Sin esas llaves la app funciona en *modo demo* (todo en el `localStorage` del navegador, con datos de ejemplo), así que:

- las pruebas **nunca escriben en un Supabase real**, aunque exista un `.env` con credenciales;
- cada prueba arranca con el `localStorage` limpio y no depende de las demás (corren en paralelo);
- `e2e/global-setup.js` comprueba antes de empezar que `/admin/login` muestre el aviso de modo demo y, si no, **cancela todo**. No quites esa guarda: las pruebas crean y borran propiedades, clientes y mensajes.

Además, `e2e/fixtures.js` hace que todas las pruebas:

- no tengan red externa (Unsplash, mapas, fuentes, Google Analytics se bloquean), para ser rápidas y no depender de internet;
- reciban `404` en `/api/*` (lo que ve el sitio en modo demo, sin funciones de servidor);
- **fallen ante cualquier error de página o de consola** o respuesta propia ≥ 400, aunque la aserción de la prueba pase.
- corran **sin service worker** (`serviceWorkers: "block"` en la configuración); solo `abre-sin-senal.spec.js` lo activa, porque prueba justo eso: que el panel abra sin señal aunque se recargue.

### Las fuentes importan

El ancho del texto depende de las fuentes instaladas. Inter (la del sitio) llega desde Google Fonts, que las pruebas bloquean, así que cada equipo usa su tipografía de respaldo: una máquina con Inter instalada puede mostrar todo bien y el CI (DejaVu Sans) un desborde de unos píxeles. Por eso `responsive.spec.js` fuerza una fuente ancha (DejaVu Sans, o Verdana en Mac/Windows) y prueba el peor caso. Si una prueba de diseño pasa en tu equipo y falla en el CI, sospecha primero de esto.

## Qué cubre cada archivo

| Archivo | Qué prueba |
|---|---|
| `smoke.spec.js` | Cada una de las 85 rutas (públicas y del panel) carga sin errores, con contenido, sin el aviso de error, sin desbordarse de lado y sin `<img src="">`. |
| `responsive.spec.js` | Regresiones de diseño adaptable (solo móvil): sin desborde horizontal a 320/360/390/768/1024 px, botones de la tarjeta sin recortar, menú móvil con 8 enlaces, propiedad/asesor sin foto, cajón del panel y buscador global. Cada una corresponde a un defecto real ya corregido. |
| `public.spec.js` | Sitio público: menú, tema, idioma, búsqueda y filtros, mapa, favoritos, comparador, galería, ficha, calculadoras, formularios (contacto, vende tu casa, guía del comprador con PDF), blog, torre/desarrollo, chat. |
| `listado-ficha.spec.js` | Listado y ficha: carrusel de fotos en la tarjeta, rangos de precio y chips de filtros, búsqueda de texto (sin acentos), vista dividida y «Buscar en esta zona», página en la dirección, «Volver» con la misma posición, calculadora de mensualidad, «Cómo llegar», plano (subir, ver, quitar) y gestos de la galería (deslizar, pellizcar, doble toque) con eventos táctiles reales por CDP. |
| `cliente-y-asesor.spec.js` | Ficha en PDF pública, favoritos compartibles, tiempo de traslado (con Nominatim/OSRM simulados), «Mi espacio», «Visítala mañana», reacciones en la selección (cliente y resumen del asesor), interés en línea en el informe del vendedor y el interruptor «Avisar por correo» del trámite. |
| `cliente-y-asesor-2.spec.js` | Chat que pasa a un asesor (botón de WhatsApp resaltado), encuesta tras la visita (estrellas, comentario, una sola respuesta, opinión en la Agenda), vendidas recientes con sus días, simulador de crédito público, estimado al instante en «Vende tu casa», y del asesor: arrastrar prospectos entre etapas, calificación (caliente/tibio/frío), secuencia de seguimiento sugerida y asignación automática en «Equipo hoy». |
| `cliente-y-asesor-3.spec.js` | Mi día: propiedades nuevas para prospectos (avisar/ocultar), ruta de hoy con un solo enlace de Google Maps y apartados por vencer; Propiedades: ofertas y apartado (un solo vigente, estatus de la propiedad), duplicar, edición en lote de precio y asesor, ficha completa y filtro de incompletas; dictado por voz (con y sin soporte del navegador); Agenda por semana y día (citas traslapadas lado a lado) y calendario suscribible. |
| `cliente-y-asesor-4.spec.js` | Inicio de sesión (mostrar contraseña, «olvidé mi contraseña» en demo), propiedades sin movimiento, contratos por vencer (lista y Mi día), comisiones por asesor desde la liquidación hasta la página de Comisiones, fusionar duplicados, vistas guardadas, tabla del mes, invitación desde Roles (demo) y centro de ayuda con recorrido guiado (foco, Escape, atrás). |
| `diseno-panel.spec.js` | Menú del panel con iconos, fijados (sin repetir enlaces), recientes y modo compacto; eliminar con «Deshacer» (vuelve, se borra a tiempo y al salir de la página); aviso discreto que no bloquea la página; confirmación propia (Escape cancela, Aceptar sigue). |
| `sitio-publico-seo.spec.js` | Direcciones legibles de las fichas (y que las viejas por id o código se corrigen solas), canonical / hreflang / datos estructurados, `?lang=en`, `noindex` en páginas privadas, 404 con búsqueda y destacadas, barra inferior del teléfono, formulario de propiedad por pasos y su borrador automático. |
| `colonias.spec.js` | Páginas por colonia: la ciudad lista sus colonias con propiedades, la colonia tiene su título, canonical y propiedades, la ficha enlaza a su colonia; una colonia vacía lleva `noindex` y una inexistente es 404. |
| `seguridad-panel.spec.js` | Verificación en dos pasos con un código TOTP real (activar, pedirlo al iniciar sesión, rechazar uno malo, quitarla), cierre por inactividad con aviso y «Seguir aquí», lista de dispositivos y «cerrar las demás». |
| `monitoreo-errores.spec.js` | Un error del navegador se registra agrupado y sin tokens en la ruta, aparece en `/admin/errores` y se resuelve/reabre; el ruido conocido no se registra. |
| `tiempo-real.spec.js` | Un mensaje que llega desde otra pestaña aparece en la lista de Mensajes abierta, sin recargar. |
| `ficha-y-accesibilidad.spec.js` | Mosaico de fotos y barra de precio fija en la ficha, iconos de datos, descripción con párrafos y listas, pantallas vacías con ilustración, textos en inglés, foco del teclado en una ventana emergente (Tab no se sale, vuelve al botón), tablas del panel (ordenar, columnas, encabezado fijo) y gráficas del Dashboard. |
| `accesibilidad.spec.js` | Revisión automática con axe-core (WCAG 2 A y AA) de las páginas públicas y del panel principal, en claro y oscuro, PC y teléfono; falla con violaciones serias o críticas (lista de excepciones por página, vacía). |
| `admin.spec.js` | Panel: login y rutas protegidas, menú lateral/cajón en todos los apartados, búsqueda global, ciclo completo de una propiedad (crear → publicar → editar → filtrar → exportar → eliminar), mensajes de contacto, cerrar sesión. |
| `crud.spec.js` | Alta → listado → baja de 11 formularios del panel, rellenados con datos genéricos según el tipo de campo. |
| `flujos-criticos.spec.js` | Flujos de punta a punta: portal del cliente (el asesor pide documentos y mueve la etapa → el cliente acepta el aviso, ve su trámite y pendientes y sube su INE → el asesor la aprueba → el cliente ve el avance; enlace desactivado), «Mi día» como inicio y la barra de abajo del teléfono, y el seguimiento de un prospecto con la plantilla de su etapa hasta registrar el contacto. |
| `features.spec.js` | Funciones con reglas propias: captura rápida, valuación, simulador Infonavit, zonas → calculadora pública, visitas (no admiten fecha futura), inspección, modales Enviar/QR/Redes, PDF de la ficha. |

## Cómo agregar una prueba

Importa `test` y `expect` de `./fixtures.js` (no de `@playwright/test`) para heredar lo anterior. Fixtures útiles:

- `go(ruta)`: navega y espera a que la SPA termine de cargar datos.
- `press(locator)`: toca en móvil, hace clic en PC; úsalo en vez de `click()` para que las pruebas móviles usen eventos táctiles reales.
- `seedAdminSession()`: deja la sesión del panel ya iniciada (más rápido que el formulario). `loginAdmin()` sí pasa por el formulario.
- `isMobile`: para ramas que cambian entre PC y móvil (por ejemplo, abrir el menú hamburguesa).

Para comprobar que una prueba de regresión de verdad detecta el defecto, ejecútala contra el código anterior al arreglo (`git checkout <commit-previo> -- src`), confirma que falla y restaura (`git checkout HEAD -- src`).

## Qué NO cubren

- Todo lo que necesita Supabase o Vercel: chatbot con IA, notificaciones push, «Mercado en internet», portal de documentos con validación, `/api/*`.
- El editor 3D de Construcción: en modo demo la app avisa que no está disponible.
- La carga real de imágenes, mapas y fuentes externas (se bloquean a propósito).
- Safari/WebKit: el móvil se emula con Chromium (tamaño, toques y user agent).
