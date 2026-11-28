# Auditoría: puntos 142–160 (tercera tanda)

## Despliegue

1. Publicar el sitio (merge a `main`). Todo funciona con la base vieja salvo el estatus «rentada».
2. **Aplicar la migración 0126** (`npm run db:migrate`, o pegar el archivo en el SQL Editor; es re-ejecutable): agrega el estatus `rentada` y hace que las funciones de visitas la traten como una vendida.
3. Sin pasos manuales más. (Pendientes de las tandas anteriores: migraciones 0124 y 0125, secretos de «Novedades» y revisión legal de los términos; ver `docs/auditoria-122-141.md`.)

## Hecho

| # | Qué cambió |
|---|---|
| 142 | Si la consulta del listado falla se muestra «No se pudo cargar» con botón de reintentar; ya no se queda con los resultados anteriores sin avisar. |
| 143 | Precio, superficie y zona esperan 300 ms de pausa antes de consultar (`useDebouncedValue`): escribir «1500000» ya no son 7 consultas. |
| 144 | La zona escrita a mano se busca por parte del nombre y sin importar mayúsculas («torre» encuentra «Torreón»). Las páginas por colonia siguen usando coincidencia exacta. |
| 145 | Ya estaba resuelto: al cambiar de página el listado sube al inicio de los resultados. |
| 146 | El panel «Naves Industriales» del inicio se muestra como «Próximamente» cuando el tipo está activo pero no tiene propiedades (igual que el menú). |
| 147 | Las tarjetas de categoría ya no dicen «0 propiedades» mientras llegan los conteos. |
| 148 | La carga de tipos de propiedad del inicio tiene `catch`. |
| 149 | Ya estaba resuelto en la tanda anterior: los formularios leen el almacenamiento dentro de `try` (`rateLimitStore`). |
| 150 | La fecha mínima de la solicitud de visita es «hoy» en hora de México, no en UTC: después de las 18:00 ya deja elegir hoy. |
| 151 | El botón ES/EN de `/firmar` se ve (texto claro sobre el encabezado oscuro). |
| 152 | `/firmar` pone título de pestaña propio («<documento> · Firma de documento») y `noindex`. |
| 153 | Cada pantalla del panel pone su nombre en la pestaña («Prospectos · Panel ACL»). |
| 154 | Una dirección inexistente dentro de `/admin` muestra «Esta pantalla no existe» dentro del panel (con su menú), no el 404 del sitio. |
| 155 | Tras iniciar sesión se vuelve al enlace profundo que traía la persona (con su query), no siempre a `/admin`. |
| 156 | El tema ya no se guarda en el primer render: solo cuando la persona toca el botón. Mientras no lo haya elegido sigue al sistema (incluso si cambia con el sitio abierto). No agregué un botón «Automático» aparte. |
| 157 | El código (ACL-1001) se ve en la tarjeta y en la ficha. |
| 158 | Estatus nuevo `rentada` (migración 0126): no cuenta como venta, no se ofrece por omisión, no admite visitas. «En pausa» y «retirada» no necesitan estatus: se desactiva la propiedad (casilla «Activa»). El filtro del listado dice «Incluir vendidas y rentadas». |
| 159 | `main.jsx` tolera el almacenamiento bloqueado al recargar tras un despliegue. |
| 160 | Las partículas de temporada ya no salen en `/firmar`, `/documentos`, `/visita`, `/opinion`, `/seleccion` ni `/registro` (`lib/seasonalRoutes.js`). |

## Otros cambios

- `e2e/listado-ficha.spec.js`: el rango «Hasta $1 M» ahora espera 2 casas (la de 620 mil está vendida y por omisión ya no se ofrece; punto 135).
- El peso inicial del sitio quedó en 358.2 KB de 360 KB gzip (tope del presupuesto): conviene revisarlo antes de sumar más código al arranque.

## Pruebas

- Unitarias: `npm test` (1,917). SQL real: 16 de 16 (`16_estatus_rentada.sql`). e2e nuevo: `e2e/auditoria-142-160.spec.js`.
