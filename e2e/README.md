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

## Qué cubre cada archivo

| Archivo | Qué prueba |
|---|---|
| `smoke.spec.js` | Cada una de las 84 rutas (públicas y del panel) carga sin errores, con contenido, sin el aviso de error, sin desbordarse de lado y sin `<img src="">`. |
| `responsive.spec.js` | Regresiones de diseño adaptable (solo móvil): sin desborde horizontal a 320/360/390/768/1024 px, botones de la tarjeta sin recortar, menú móvil con 8 enlaces, propiedad/asesor sin foto, cajón del panel y buscador global. Cada una corresponde a un defecto real ya corregido. |
| `public.spec.js` | Sitio público: menú, tema, idioma, búsqueda y filtros, mapa, favoritos, comparador, galería, ficha, calculadoras, formularios (contacto, vende tu casa, guía del comprador con PDF), blog, torre/desarrollo, chat. |
| `admin.spec.js` | Panel: login y rutas protegidas, menú lateral/cajón en todos los apartados, búsqueda global, ciclo completo de una propiedad (crear → publicar → editar → filtrar → exportar → eliminar), mensajes de contacto, cerrar sesión. |
| `crud.spec.js` | Alta → listado → baja de 11 formularios del panel, rellenados con datos genéricos según el tipo de campo. |
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
