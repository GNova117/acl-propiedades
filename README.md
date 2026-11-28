# ACL Propiedades

Sitio web inmobiliario para **ACL Propiedades**, agencia ubicada en La Comarca Lagunera (Torreón, Gómez Palacio y Lerdo). Incluye sitio público (propiedades, mapa interactivo, calculadora de valor estimado) y un panel de administrador protegido para gestionar propiedades, asesores y precios por zona.

## Stack técnico

- **React 19** + **Vite** (SPA con React Router 7)
- **Supabase** (Postgres + Auth + Storage) como backend
- **Leaflet / react-leaflet** + OpenStreetMap para el mapa interactivo de propiedades. El mapa de la oficina en `/contacto` es un embed público de Google Maps sin llave.
- **i18next** para español/inglés
- CSS plano con variables (sin frameworks), modo claro/oscuro nativo

### Estado actual: Supabase ya está conectado

Este proyecto ya tiene un archivo `.env` apuntando a un proyecto real de Supabase, con `schema.sql` y `seed.sql` ya ejecutados (9 propiedades, 3 asesores, 3 zonas) y un usuario administrador ya creado. No necesitas hacer nada más para usarlo — ver la sección de credenciales abajo.

### Modo demo sin Supabase

Si en algún momento borras o dejas vacío el `.env` (por ejemplo, para clonar el proyecto en otra máquina sin usar la misma base de datos), **el sitio sigue funcionando igual**: usa un backend local basado en `localStorage` con los mismos 9 inmuebles y 3 asesores de ejemplo, y un login de administrador de demostración. Esto permite explorar todo el sitio (incluido el panel admin) sin crear ninguna cuenta externa. En cuanto vuelvas a agregar las credenciales de Supabase en `.env`, la app cambia automáticamente a usar la base de datos real.

## Instalación y ejecución

```bash
npm install
npm run dev
```

Abre `http://localhost:5173`.

```bash
npm run build    # build de producción a /dist
npm run preview  # sirve el build de producción localmente
```

## Pruebas automatizadas

```bash
npm run test        # corre todas las pruebas una vez
npm run test:watch  # las vuelve a correr al guardar un archivo
```

Usa [Vitest](https://vitest.dev) (mismo motor que Vite, sin configuración aparte). Las pruebas viven junto al archivo que cubren (`src/lib/algo.js` → `src/lib/algo.test.js`) y por ahora solo cubren funciones puras de `src/lib/` — cálculos de dinero y de negocio (liquidaciones, valuación, simulador Infonavit, informe de visitas) que no dependen de React ni de Supabase. Para cubrir una función nueva, crea su `.test.js` junto a ella; no hace falta tocar `vite.config.js`. `.github/workflows/ci.yml` corre `lint` + `test` + `build` en cada push y pull request.

### Pruebas de navegador (PC y móvil)

```bash
npx playwright install chromium   # una sola vez: descarga el navegador
npm run test:e2e                  # corre todo en PC (1366 px) y móvil (390 px, con toques)
npx playwright test e2e/admin.spec.js --project=mobile   # un archivo, solo móvil
```

Usan [Playwright](https://playwright.dev) y viven en `e2e/` (configuración en `playwright.config.js`): recorren las 85 rutas, prueban las funciones del sitio y del panel como lo haría una persona (formularios, filtros, favoritos, PDFs, altas y bajas…) y vigilan que nada se desborde ni se recorte en celulares de 320–430 px y tabletas. Corren siempre en **modo demo** —construyen la app con las llaves de Supabase vacías y se niegan a arrancar si no es así—, de modo que nunca tocan una base real aunque tengas un `.env`. Detalles, qué cubren y cómo agregar pruebas: [`e2e/README.md`](e2e/README.md). En CI es el job `e2e` de `.github/workflows/ci.yml`.

### Novedades del sitio: registro automático de cambios

El apartado `/admin/novedades` (solo visible con ese permiso, otorgado por default al rol admin) lleva una bitácora de cada cambio que se le hace al sitio, como un blog interno. No hay que escribir las entradas a mano: `.github/workflows/log-site-update.yml` inserta una automáticamente en la tabla `site_updates` cada vez que un pull request se fusiona a `main`, usando el título y la descripción del PR. (También se puede agregar una entrada a mano desde el panel para algo que no vino de un PR, como un cambio de configuración hecho directo en Supabase o Vercel.)

Para que ese workflow funcione hace falta darle tres secretos al repositorio (**Settings → Secrets and variables → Actions → New repository secret**):

```
SUPABASE_URL=https://xxxxxxxx.supabase.co            # Project Settings > API
SUPABASE_ANON_KEY=xxxxxxxxxxxxxxxxxxxxxxxx            # la llave pública (anon), la misma que usa el sitio
NOVEDADES_TOKEN=un-valor-largo-y-aleatorio             # lo inventas tú; el MISMO valor va en Vault, ver abajo
```

Y guardar ese mismo valor en Vault de Supabase (SQL Editor): `select vault.create_secret('<el mismo valor>', 'novedades_token');`. El workflow llama a la función `registrar_novedad` (migración 0124), que **solo** sabe insertar una fila en `site_updates` y solo con ese token. Antes usaba la llave `service_role` (acceso total a la base) guardada en GitHub; ya no hace falta y conviene **borrar el secreto `SUPABASE_SERVICE_ROLE_KEY` del repositorio** cuando el nuevo flujo funcione.

Si no se configuran, el workflow no falla: el paso se salta con un aviso en los logs de Actions.



1. Crea un proyecto gratuito en [supabase.com](https://supabase.com).
2. Ve a **SQL Editor** y ejecuta, en orden:
   - [`supabase/schema.sql`](supabase/schema.sql) — crea tablas, políticas RLS y buckets de almacenamiento.
   - [`supabase/seed.sql`](supabase/seed.sql) — inserta los 9 inmuebles y 3 asesores de ejemplo.
3. Copia `.env.example` a `.env` y completa con los datos de **Project Settings > API**:

   ```
   VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=xxxxxxxxxxxxxxxxxxxxxxxx
   ```

4. Crea el usuario en **Authentication > Users > Add user** (correo + contraseña que tú definas, con "Auto Confirm User" activado). Cualquier usuario autenticado de Supabase puede iniciar sesión en `/admin`, pero sin un rol asignado no ve ningún apartado (solo el Panel principal): agrégalo desde `/admin/roles` con el correo con el que lo diste de alta aquí, o inclúyelo directo en el bloque SQL de `admin_access` en `schema.sql` si es de los primeros en entrar. Las cuentas se siguen creando manualmente desde este panel de Supabase — no hay alta de usuarios dentro de la app.
5. Reinicia `npm run dev`. El sitio detectará las variables y usará Supabase automáticamente para propiedades, asesores, zonas, mensajes de contacto e imágenes.

### Almacenamiento de imágenes y videos

`schema.sql` crea tres buckets públicos: `property-images`, `advisor-photos` y `property-videos`. Las imágenes/videos que subas desde el panel de administrador se guardan ahí y se sirven vía URL pública. A diferencia de los otros dos, `property-videos` sí tiene límite fijado a nivel de bucket (100 MB por archivo, tipos `mp4`/`webm`/`ogg`/`quicktime`) — los videos pesan mucho más que las fotos, así que aquí sí valía la pena ponerle un techo explícito. **En modo demo local** (sin Supabase configurado) los videos se guardan como `data:` URL en `localStorage`, igual que las fotos — pero el navegador solo da unos 5-10 MB por origen, muy por debajo de lo que pesa un video real, así que subir un video de tamaño normal en modo demo casi seguro falla con un mensaje claro (`localBackend.js`); en producción con Supabase conectado no aplica este límite.

Además crea un tercer bucket, `client-documents`, para los documentos de identidad capturados en el módulo de clientes (INE, CURP, cédula fiscal, acta de nacimiento) — incluidos los que el propio cliente sube desde el Portal de documentos (ver más abajo), que caen en el mismo bucket y la misma ruta por cliente, solo que subidos por `api/portal-upload.js` en vez del panel. A diferencia de los dos anteriores, **es privado**: solo el admin autenticado puede subir/ver/eliminar esos archivos, y el panel los muestra vía URLs firmadas de corta duración, nunca URLs públicas.

## Acceso al panel admin

Panel: `/admin` (redirige a `/admin/login` si no has iniciado sesión).

- **Con Supabase configurado (producción):** las credenciales del administrador se gestionan en el dashboard de Supabase, en **Authentication > Users**. No se documentan aquí a propósito: este repositorio está en GitHub y el panel da acceso a documentos de identidad de clientes (INE, CURP, actas de nacimiento).
- **Modo demo (sin `.env`):** usa un login local de demostración cuyas credenciales aparecen en pantalla en la propia página de login. Solo sirve para explorar la app con datos de ejemplo en el navegador; no da acceso a ningún dato real.

## Estructura del proyecto

```
acl-propiedades/
├─ public/
│  └─ favicon.svg
├─ supabase/
│  ├─ schema.sql        # tablas, RLS, buckets de storage
│  └─ seed.sql          # datos de ejemplo (9 propiedades, 3 asesores, 3 zonas)
├─ src/
│  ├─ components/       # Header, Footer, Logo, PropertyCard, PropertyMap, DocumentCapture, etc.
│  ├─ context/          # ThemeContext (claro/oscuro), AuthContext (sesión admin)
│  ├─ i18n/             # configuración i18next + locales es/en
│  ├─ lib/
│  │  ├─ supabaseClient.js   # cliente Supabase (o null si no hay credenciales)
│  │  ├─ supabaseBackend.js  # implementación real sobre Supabase
│  │  ├─ localBackend.js     # implementación demo sobre localStorage
│  │  ├─ dataStore.js        # elige backend automáticamente (db)
│  │  ├─ seedData.js         # datos de ejemplo compartidos con seed.sql
│  │  ├─ imageQuality.js     # validación de nitidez/exposición/alineación de documentos
│  │  ├─ perfilamientoShared.js    # motor genérico de perfilamiento (validación, PDF, lectura)
│  │  ├─ perfilamientoVendedor.js  # campos del perfilamiento del vendedor
│  │  └─ perfilamientoComprador.js # campos del perfilamiento del comprador
│  ├─ pages/             # Home, Properties, PropertyDetail, Calculator, About, Contact
│  │  └─ admin/          # Login, Dashboard, CRUD de propiedades/asesores/zonas/clientes/remodelaciones
│  ├─ App.jsx            # rutas
│  └─ main.jsx           # providers + pantalla de carga inicial
├─ .env.example
└─ README.md
```

## Funcionalidades

El detalle de cada función se separó por tema para que el README sea manejable (el contenido es el mismo; los comentarios del código que dicen «ver README» se refieren a estos archivos — para encontrar una función por nombre, busca en `docs/readme/`):

- [Sitio público: inicio, fichas, listado y herramientas del visitante](docs/readme/sitio-publico.md) — Identidad, Inicio, Propiedades / Naves Industriales / Terrenos, Desarrollos / torres, Chatbot público, Comparador de créditos…
- [Panel: propiedades, zonas, valuación y obra](docs/readme/panel-propiedades-y-valuacion.md) — Tipos de propiedad administrables, Simulador de crédito Infonavit, Valuación por zona, Mercado en internet, Panel admin, Zonas…
- [Clientes, perfilamiento y portal de documentos](docs/readme/clientes-y-documentos.md) — Clientes, Perfilamiento, Portal de documentos del cliente
- [Liquidaciones, ventas, reportes y bitácora de gastos](docs/readme/ventas-y-finanzas.md) — Liquidaciones, Ventas y reportes, Bitácora y gastos por casa
- [Prospectos, visitas, agenda y herramientas del asesor](docs/readme/prospectos-agenda-y-asesor.md) — Visitas e informe para el vendedor, Prospectos: seguimiento diario del asesor, Atajos del asesor, Agendar visita con horarios reales, Mi día y contactos duplicados, Metas mensuales y textos de anuncio con IA
- [Roles, notificaciones y analítica](docs/readme/accesos-notificaciones-y-medicion.md) — Roles y accesos, Notificaciones push, Google Analytics 4, Resumen de Analytics en el Dashboard
- [Historial de mejoras por tandas (31 a 100 y siguientes)](docs/readme/historial-de-mejoras.md) — Chat, encuesta, vendidas, simulador, estimado, y del asesor: tablero, asignación, calificación y secuencia, Mejoras 31 a 40: ofertas y apartados, agenda por semana/día, calendario suscribible, ruta del día, dictado, duplicar, edición en lote y ficha completa, Mejoras 41 a 50: propiedades estancadas, contratos por vencer, comisiones, tabla de posiciones, vistas guardadas, invitar usuarios, contraseña, fusionar duplicados y ayuda, Mejoras 51 a 60 (diseño): siluetas de carga, avisos con «Deshacer», menú con iconos, fijados y modo compacto, puntos de corte, colores y espaciado, imágenes para compartir y portada, Mejoras 61 a 70 (diseño y accesibilidad): mosaico de fotos, precio fijo, iconos, descripción con listas, pantallas vacías, textos en inglés, foco del teclado, contraste y pruebas de accesibilidad, tablas y gráficas, Mejoras 71 a 80 (formularios, SEO y dominio): formulario por pasos con borrador, 404 útil, barra inferior en el teléfono, correos de una sola marca, direcciones legibles y datos para Google…


## Notas

- Las imágenes de los 9 inmuebles y 3 asesores de ejemplo usan URLs públicas de Unsplash; reemplázalas por fotos reales desde el panel admin cuando tengas Supabase configurado.
- El logo se recreó en SVG/CSS como una interpretación vectorial del arte de marca proporcionado (mismo lockup "ACL" + "PROPIEDADES", misma paleta azul/negro), para que escale perfectamente en cualquier tamaño y funcione en modo claro/oscuro.
