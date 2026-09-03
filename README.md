# ACL Propiedades

Sitio web inmobiliario para **ACL Propiedades**, agencia ubicada en La Comarca Lagunera (Torreón, Gómez Palacio y Lerdo). Incluye sitio público (propiedades, mapa interactivo, calculadora de valor estimado) y un panel de administrador protegido para gestionar propiedades, asesores y precios por zona.

## Stack técnico

- **React 19** + **Vite** (SPA con React Router 7)
- **Supabase** (Postgres + Auth + Storage) como backend
- **Leaflet / react-leaflet** + OpenStreetMap para el mapa interactivo
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

## Configurar Supabase desde cero (si alguna vez usas otro proyecto)

1. Crea un proyecto gratuito en [supabase.com](https://supabase.com).
2. Ve a **SQL Editor** y ejecuta, en orden:
   - [`supabase/schema.sql`](supabase/schema.sql) — crea tablas, políticas RLS y buckets de almacenamiento.
   - [`supabase/seed.sql`](supabase/seed.sql) — inserta los 9 inmuebles y 3 asesores de ejemplo.
3. Copia `.env.example` a `.env` y completa con los datos de **Project Settings > API**:

   ```
   VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=xxxxxxxxxxxxxxxxxxxxxxxx
   ```

4. Crea el usuario administrador en **Authentication > Users > Add user** (correo + contraseña que tú definas, con "Auto Confirm User" activado). No es necesario ningún campo adicional: cualquier usuario autenticado de Supabase puede entrar al panel `/admin`, ya que este proyecto está pensado para un único administrador.
5. Reinicia `npm run dev`. El sitio detectará las variables y usará Supabase automáticamente para propiedades, asesores, zonas, mensajes de contacto e imágenes.

### Almacenamiento de imágenes

`schema.sql` crea dos buckets públicos: `property-images` y `advisor-photos`. Las imágenes que subas desde el panel de administrador se guardan ahí y se sirven vía URL pública.

Además crea un tercer bucket, `client-documents`, para los documentos de identidad capturados en el módulo de clientes (INE, CURP, cédula fiscal, acta de nacimiento). A diferencia de los dos anteriores, **es privado**: solo el admin autenticado puede subir/ver/eliminar esos archivos, y el panel los muestra vía URLs firmadas de corta duración, nunca URLs públicas.

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

- **Identidad**: logo en header, footer y favicon; pantalla de carga con fade-in al abrir el sitio.
- **Inicio**: hero con buscador rápido (tipo, zona, precio) y tarjetas de categoría (casas, departamentos, naves industriales, terrenos) con conteo real de propiedades.
- **Propiedades / Naves Industriales / Terrenos**: tres apartados separados en el menú público, cada uno con su propio listado y filtros — `/propiedades` (casas, departamentos y cualquier tipo nuevo que se agregue desde el panel), `/naves-industriales` y `/terrenos`. Los tres reutilizan el mismo componente (`src/pages/Properties.jsx`, parametrizado por `fixedType` en los apartados de un solo tipo o `excludeTypes` en el general) y el mismo filtro (`PropertyFilters.jsx`); en Naves Industriales y Terrenos el filtro de Tipo se oculta porque ya está implícito en la sección. Los filtros incluyen tipo (en `/propiedades`), **operación** (Compra / Renta — `properties.operation_type`, solo visible en `/propiedades` por ahora), zona, precio y superficie. Vista de mapa interactivo con Leaflet (marcadores por tipo, popup con foto/precio/superficie), y vista de detalle compartida (`/propiedades/:id`, para cualquier tipo) con galería, características, ubicación y tarjeta del asesor (teléfono, correo, WhatsApp). La calculadora de valor estimado (`/calculadora`) sigue existiendo pero ya no aparece en el menú — solo es accesible por URL directa.
- **Tipos de propiedad administrables** (`/admin/zonas`, sección "Tipos de propiedad"): igual que las zonas, los tipos de propiedad (casa, departamento, nave industrial, terreno...) ya no son un enum fijo — se pueden agregar desde el panel (`property_types`, `db.addPropertyType`), con el mismo patrón de tarjeta + bloqueo de borrado si algún tipo está en uso. Un tipo nuevo aparece automáticamente en los selectores de Tipo (alta/edición de propiedad, buscador del inicio, calculadora de valor) y, por default, cae en el listado general `/propiedades` — para darle su propio apartado (como Naves Industriales/Terrenos) haría falta una ruta nueva a mano. Los 4 tipos de fábrica conservan su traducción ES/EN (`propertyType.*`); un tipo agregado por el admin no tiene esa traducción, así que se muestra humanizando su slug técnico (p. ej. `bodega_chica` → "Bodega Chica") vía `propertyTypeLabel()` en `src/lib/format.js` — funciona bien salvo por acentos, que el slug no conserva.
- **Simulador de crédito Infonavit** (`/admin/credito-infonavit`, interno): a partir de edad, sexo, salario mensual y saldo en la Subcuenta de Vivienda, estima el crédito tradicional disponible (fórmula estándar de anualidad sobre la cuota mensual que resulta de aplicar un factor de descuento de referencia al salario), la cuota mensual y el total disponible para compra (`src/lib/infonavitSimulator.js`, función pura). Pensado para que el asesor lo use en pantalla con el cliente, no como página pública del sitio. La interfaz se simplificó a propósito (2026-09) a solo inputs + parámetros vigentes + tarjeta de resultado — el desglose de gastos/plazo, el aviso de estimación conceptual y las fuentes consultadas se quitaron de la pantalla a petición del negocio, pero **siguen vivos en el código** (`simularCreditoInfonavit()` todavía calcula `exentoTitulacion`, `plazoAnios`, etc., solo que la UI ya no los muestra).

  ⚠️ **Limitación conocida sobre las tasas de interés (ya no visible en pantalla, solo aquí)**: el PDF oficial de Infonavit con la tabla escalonada completa de tasas por nivel salarial (portalmx.infonavit.org.mx) fue inalcanzable (timeout) al construir esta herramienta, por varios métodos de acceso. Los dos extremos de la tabla sí están confirmados por varias fuentes coincidentes (3.69% hasta 2.6 UMA, 10.45% desde 6.6 UMA); los tramos intermedios se interpolan linealmente entre esos dos puntos como aproximación — **no es la tabla oficial real**, que es escalonada. Los parámetros oficiales (UMA, tasas, regla de edad) se investigaron por búsqueda web en 2026-09 y están fijos en el código — no hay API pública de Infonavit para consultarlos en vivo, así que hay que actualizarlos a mano cuando cambien (la UMA se revisa cada febrero). Si en algún momento se logra acceder al PDF oficial, hay que reemplazar `tasaInteresPorUma()` en `src/lib/infonavitSimulator.js` por la tabla escalonada real.
- **Panel admin** (`/admin`): dashboard con totales, CRUD completo de propiedades (con carga de múltiples imágenes, selección de imagen principal, asignación de asesores) y de asesores, y edición de precios por zona. Todo se refleja de inmediato en el sitio público. Cada propiedad tiene un botón **"Ficha técnica"** que genera al vuelo (sin capturar nada aparte) un PDF sobre la hoja membretada con los datos generales, todas las fotos subidas de la propiedad y la foto/contacto de cada asesor asignado (`src/lib/propertyFichaPdf.js` — convierte cualquier formato de imagen a PNG vía canvas antes de incrustarla, así que no importa si la foto original era JPG/PNG/WEBP).
- **Zonas** (`/admin/zonas`): a diferencia del resto de tablas del sitio, las zonas ya no vienen fijas por seed — se pueden agregar libremente desde el panel (nombre + precio por m² inicial) y eliminar si ninguna propiedad las está usando (el botón "Eliminar" se bloquea mostrando cuántas propiedades la usan, para no dejar propiedades con una zona que ya no existe en los filtros). El filtro de zona en `/propiedades` (sitio público) y el selector de zona al editar una propiedad ya leían la tabla `zones` en vivo, así que cualquier zona nueva aparece ahí automáticamente sin tocar código.
- **Clientes** (`/admin/clientes`, interno): expediente por cliente comprador/vendedor/ambos, con captura de documentos de identidad (INE, CURP, cédula fiscal, acta de nacimiento, **contrato**) desde la cámara, con marco guía y validación automática de nitidez/exposición/alineación (estilo app bancaria) antes de guardarlos. Tanto el listado de clientes como el de documentos de cada cliente tienen filtro por mes y año (sobre `created_at`/`captured_at`) para ubicar expedientes conforme crece el historial.
- **Perfilamiento** (`/admin/clientes/:id/perfilamiento`, interno): dos pestañas — **Vendedor** (expediente por inmueble, un cliente puede tener varios) y **Comprador** (datos personales, laborales y 2 referencias). Ambos generan un PDF sobre la hoja membretada de la empresa (`public/plantilla_acl.pdf`) con `pdf-lib`, con salto de línea y de página automáticos. RFC/CURP se validan en el formulario y también en la base de datos (restricciones `check`), así que ni siquiera saltándose el formulario se puede guardar un valor con formato inválido.

  ⚠️ **Nota de seguridad — campo "Contraseña" del comprador**: la hoja de datos generales del comprador pide la contraseña del portal de crédito (INFONAVIT/FOVISSSTE/banco) del cliente, no una contraseña del sistema. A petición explícita del negocio, se guarda en la base de datos (`perfilamientos_comprador.contrasena_portal`) en texto plano, junto con el resto del perfil. Esto es un riesgo real y consciente: si la base de datos de Supabase llegara a comprometerse, esas contraseñas quedarían expuestas. En pantalla el campo se enmascara por defecto (con un botón para mostrarlo), pero eso solo evita que alguien lea por encima del hombro — no protege contra una fuga de la base de datos. Si en algún momento se prefiere dejar de guardarla, basta con quitar el campo `contrasena_portal` de `perfilamientos_comprador` (y de `src/lib/perfilamientoComprador.js`) para que solo viva en el PDF generado, nunca en la base.
- **Remodelaciones** (`/admin/remodelaciones`, interno): calculadora de presupuestos de remodelación. Cada proyecto captura espacios individuales (largo/ancho/alto), con un mini render 3D a escala y sugerencia automática de material según el rendimiento definido en el catálogo (kg/m² de muro, etc.). Los materiales se seleccionan de `/admin/materiales` (catálogo con precio de ferretería propia y precio externo); la lista del proyecto calcula subtotales, totales y ahorro por línea y en general. **Cada propiedad nueva llega con su proyecto de remodelación ya vinculado** (`remodel_projects.property_id`, creado automáticamente al dar de alta la casa en `/admin/propiedades`) — no hace falta seleccionar ni volver a capturar la casa aquí; el botón "Remodelación" en el listado de Propiedades abre directo ese proyecto.
- **Liquidaciones** (botón "Liquidación" en cada fila de `/admin/propiedades`, **confidencial**): devolución al vendedor original, inversión (remodelación + servicios), comisión de captación/venta y utilidad neta de la sociedad por vivienda, calculados en cascada (`src/lib/liquidacion.js`) a partir de montos y porcentajes capturables (no fijos en el código). A diferencia de **todas** las demás tablas de este proyecto (RLS = "cualquier usuario autenticado"), `liquidaciones` está restringida por RLS a los dos correos de los socios (`src/lib/partners.js`, política en `supabase/schema.sql`) — ni el botón ni la ruta se muestran a nadie más (`PartnerRoute.jsx`), pero la restricción real vive en la base de datos: un tercer usuario autenticado que intentara leer la tabla directo por la API de Supabase recibiría 0 filas, no solo una interfaz oculta.

  **"Precio de la propiedad" alimenta el costo total de liquidación (2026-09):** hubo una vuelta más aquí — primero "Costo total de liquidación" pasó a captura manual, pero al probarlo en producción el negocio lo revirtió: un número manual que se puede desincronizar del precio real de la propiedad "no funciona bien". Diseño final: "Precio de la propiedad" es un campo de solo lectura que toma el precio vigente de Propiedades en vivo, y es la **única** fuente del "Costo total de liquidación" que usa el RESUMEN como punto de partida — no hay un campo manual aparte, no se guarda como cifra fija (`liquidaciones` ya no tiene columna `costo_total`), así que si el precio cambia en Propiedades el resumen lo refleja de inmediato. "Inversión — costo de remodelación" sigue igual: se toma en vivo del total de materiales (precio de ferretería propia) del proyecto de remodelación vinculado, sin capturarse a mano. "Inversión — pago de servicios" tampoco se captura a mano: es un porcentaje ("% Pago de servicios", `tasa_pago_servicios`, default 10%) aplicado sobre la inversión en remodelación, calculado en vivo — igual que las demás tasas de este módulo, se guarda el porcentaje, no el monto derivado.
- **Internacionalización**: botón ES/EN en el header y panel admin (i18next + detección de idioma guardada en `localStorage`).
- **Modo oscuro**: botón de sol/luna en el header y panel admin, con preferencia guardada y respeto a `prefers-color-scheme`.
- **Formulario de contacto**: validación de campos y envío funcional (guarda el mensaje en Supabase `contact_messages`, o en `localStorage` en modo demo).

## Notas

- Las imágenes de los 9 inmuebles y 3 asesores de ejemplo usan URLs públicas de Unsplash; reemplázalas por fotos reales desde el panel admin cuando tengas Supabase configurado.
- El logo se recreó en SVG/CSS como una interpretación vectorial del arte de marca proporcionado (mismo lockup "ACL" + "PROPIEDADES", misma paleta azul/negro), para que escale perfectamente en cualquier tamaño y funcione en modo claro/oscuro.
