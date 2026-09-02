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

## Credenciales de acceso al panel admin

| Modo | Correo | Contraseña |
|---|---|---|
| **Actual (Supabase real, ya configurado)** | `admin@aclpropiedades.com` | `Admin123!` |
| **Demo (si borras `.env`)** | `admin@aclpropiedades.com` | `Admin123!` |

Panel: `/admin` (redirige a `/admin/login` si no has iniciado sesión). **Cambia esta contraseña** desde el dashboard de Supabase (Authentication > Users) en cuanto puedas, ya que fue generada durante la configuración inicial.

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
│  │  ├─ profileFields.js    # campos del perfilamiento comprador/vendedor (editable)
│  │  └─ imageQuality.js     # validación de nitidez/exposición/alineación de documentos
│  ├─ pages/             # Home, Properties, PropertyDetail, Calculator, About, Contact
│  │  └─ admin/          # Login, Dashboard, CRUD de propiedades/asesores/zonas/clientes/remodelaciones
│  ├─ App.jsx            # rutas
│  └─ main.jsx           # providers + pantalla de carga inicial
├─ .env.example
└─ README.md
```

## Funcionalidades

- **Identidad**: logo en header, footer y favicon; pantalla de carga con fade-in al abrir el sitio.
- **Inicio**: hero con buscador rápido (tipo, zona, precio) y tarjetas de categoría (casas, departamentos, naves industriales) con conteo real de propiedades.
- **Propiedades**: listado con filtros (tipo, zona, precio, superficie), vista de mapa interactivo con Leaflet (marcadores por tipo, popup con foto/precio/superficie), y vista de detalle con galería, características, ubicación y tarjeta del asesor (teléfono, correo, WhatsApp).
- **Calculadora**: estima el valor de una propiedad (m² × precio por m² de la zona × factor del tipo), con rango ±10% y aviso de que es solo referencial. Los precios por zona son editables desde `/admin/zonas`.
- **Panel admin** (`/admin`): dashboard con totales, CRUD completo de propiedades (con carga de múltiples imágenes, selección de imagen principal, asignación de asesores) y de asesores, y edición de precios por zona. Todo se refleja de inmediato en el sitio público.
- **Clientes** (`/admin/clientes`, interno): expediente por cliente comprador/vendedor/ambos, con perfilamiento flexible (los campos de `src/lib/profileFields.js` se pueden ampliar sin migrar la base de datos) y captura de documentos de identidad (INE, CURP, cédula fiscal, acta de nacimiento) desde la cámara, con marco guía y validación automática de nitidez/exposición/alineación (estilo app bancaria) antes de guardarlos.
- **Perfilamiento del vendedor** (`/admin/clientes/:id/perfilamiento`, interno): expediente por inmueble con datos del vendedor (incluye RFC/CURP validados) y del inmueble. Un cliente puede tener varios. Genera un PDF sobre la hoja membretada de la empresa (`public/plantilla_acl.pdf`) con `pdf-lib`, con salto de línea y de página automáticos.
- **Remodelaciones** (`/admin/remodelaciones`, interno): calculadora de presupuestos de remodelación. Cada proyecto captura espacios individuales (largo/ancho/alto), con un mini render 3D a escala y sugerencia automática de material según el rendimiento definido en el catálogo (kg/m² de muro, etc.). Los materiales se seleccionan de `/admin/materiales` (catálogo con precio de ferretería propia y precio externo); la lista del proyecto calcula subtotales, totales y ahorro por línea y en general.
- **Internacionalización**: botón ES/EN en el header y panel admin (i18next + detección de idioma guardada en `localStorage`).
- **Modo oscuro**: botón de sol/luna en el header y panel admin, con preferencia guardada y respeto a `prefers-color-scheme`.
- **Formulario de contacto**: validación de campos y envío funcional (guarda el mensaje en Supabase `contact_messages`, o en `localStorage` en modo demo).

## Notas

- Las imágenes de los 9 inmuebles y 3 asesores de ejemplo usan URLs públicas de Unsplash; reemplázalas por fotos reales desde el panel admin cuando tengas Supabase configurado.
- El logo se recreó en SVG/CSS como una interpretación vectorial del arte de marca proporcionado (mismo lockup "ACL" + "PROPIEDADES", misma paleta azul/negro), para que escale perfectamente en cualquier tamaño y funcione en modo claro/oscuro.
