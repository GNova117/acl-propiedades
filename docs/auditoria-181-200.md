# Auditoría: puntos 181–200 (quinta tanda)

## Despliegue

Sin migraciones ni pasos manuales: publicar el sitio (merge a `main`). El middleware (vistas previas de WhatsApp/Facebook) y el sitemap se actualizan con el despliegue. Después conviene volver a enviar `https://<dominio>/sitemap.xml` a Search Console y pedir a Facebook/WhatsApp que renueven la vista previa de las páginas que ya se habían compartido (su caché es larga).

## Hecho

| # | Qué cambió |
|---|---|
| 181 | **Naves industriales** ofrece el filtro Renta / Venta (Terrenos sigue sin él: casi no se rentan). |
| 182 | Contacto valida el teléfono si se escribe (opcional; con «abc» o 3 dígitos avisa). |
| 183 | La hora de la solicitud de visita es una lista cada 30 minutos de 9:00 a 20:00 (antes un campo libre que permitía 13:07 o las 3:00 a. m.). |
| 184 | Cuando el chat llega a su límite (429) dice «Llegaste al límite de mensajes» y ofrece WhatsApp, en lugar de «Algo salió mal». |
| 185 | «Buscar por código» acepta «1001», «acl 1001», «ACL1001» y «ACL-1001». |
| 186 | Ya estaba resuelto: el sitemap usa el espacio de nombres correcto (`http://`). |
| 187 | La vista previa de `/naves-industriales` ya no dice «próximamente». |
| 188 | El sitemap suma `/vende-tu-casa`, `/aviso-de-privacidad` y `/carta-de-derechos` (`/comparar-creditos` y los desarrollos ya estaban) y **solo lista `/naves-industriales` si hay al menos una nave disponible**. |
| 189 | Las páginas públicas que titulaban con `<h2>` ahora tienen su `<h1>`: Propiedades, Terrenos, Naves, Contacto, Calculadora, Nosotros, Favoritos, Comparar, Aviso de privacidad, Carta de derechos y las páginas por ciudad y colonia. Los `/documentos/*` quedan pendientes. |
| 190 | En el inicio el `<h1>` ya no va después de dos `<h2>`: los títulos de los paneles del hero dejaron de ser encabezados. |
| 191 | El inicio conserva el título «ACL Propiedades \| Inmobiliaria en La Comarca Lagunera» (antes «Inicio \| ACL Propiedades»). |
| 192 | Título y descripción de la ficha con «en»/«in» según el idioma (llaves `detail.seoTitle` y `detail.seoLead`). |
| 193 | JSON-LD de la ficha: sin `geo` si no hay coordenadas (ni con ubicación aproximada), localidad = ciudad (no la colonia), con `addressRegion`, y «apartada» = `LimitedAvailability` (vendida o rentada = `SoldOut`). Constructores con pruebas en `lib/structuredData.js`. |
| 194 | Las migas dicen Propiedades, Terrenos o Naves Industriales según el tipo y siguen el idioma. |
| 195 | JSON-LD del blog con `publisher` (logotipo) y `mainEntityOfPage`. |
| 196 | Ya estaba resuelto: `og:url` se arma sin parámetros. |
| 197 | Una página sin descripción propia vuelve a la de `index.html` (antes se quedaba la de la página anterior). |
| 198 | El middleware cubre `/blog`, `/blog/:slug`, `/desarrollos/:slug`, `/propiedades/zona/*`, `/calculadora`, `/vende-tu-casa`, `/comparar-creditos`, `/simulador-credito`, `/aviso-de-privacidad`, `/carta-de-derechos` y `/terminos-y-condiciones`: al compartirlas por WhatsApp sale título, descripción e imagen (la del artículo o el desarrollo cuando la tienen). |
| 199 | **Parcial.** Las páginas de ciudad y colonia suman «Preguntas frecuentes» (4 preguntas con cifras reales del mercado: propiedades disponibles y precio mediano; sin datos no inventan nada) y su dato estructurado `FAQPage`. Los textos extensos propios de cada ciudad (historia, colonias, guías de zona) requieren redacción tuya. |
| 200 | **Parcial.** Cada artículo muestra tiempo de lectura, autoría («equipo de ACL Propiedades») y «Sigue leyendo» con otros artículos. Categorías, etiquetas, autor por artículo y paginación requieren columnas nuevas y captura en el panel; quedan para decidir cuando haya más artículos. |

## Pruebas

- Unitarias (constructores JSON-LD, normalizador de código, tiempo de lectura, preguntas frecuentes) y e2e nuevo: `e2e/auditoria-181-200.spec.js`. `e2e/agendar-visita.spec.js` ahora elige la hora de una lista.
- El middleware se probó con una petición de WhatsApp a cada ruta nueva.
