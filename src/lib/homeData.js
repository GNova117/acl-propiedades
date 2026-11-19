// Lo que necesitan el inicio y el encabezado del sitio, sin bajar todo el catálogo: cuántas propiedades hay por tipo, cuántas
// están disponibles y los pocos candidatos para «destacadas» y «recorridos en video». Con Supabase estos datos salen de
// consultas chicas (un conteo por tipo y tres listas cortas); el modo demo (y el respaldo si aún no se corre el SQL) los
// arma con esta función a partir de la lista completa, así la regla de qué se muestra es una sola.
import { MAX_FEATURED, getPriceDrop, pickFeaturedProperties } from "./propertyBadges";
import { MAX_VIDEO_TOURS, pickVideoTours } from "./videoTours";

// Cuántos candidatos hay que traer de cada lista para que la selección final sea exactamente la misma que con todo el
// catálogo: las destacadas son las que bajaron de precio y luego las más nuevas (MAX_FEATURED), así que basta con el doble.
export const FEATURED_POOL = MAX_FEATURED * 2;
export const VIDEO_POOL = MAX_VIDEO_TOURS * 2;

const isActive = (p) => p.active !== false;

// → { counts: { casa: n, ... }, availableCount, featuredPool, videoPool }
export function buildHomeData(properties, { now = Date.now() } = {}) {
  const list = (properties || []).filter(isActive);
  const counts = {};
  for (const p of list) counts[p.type] = (counts[p.type] || 0) + 1;
  const featuredByDrop = list.filter((p) => p.status === "disponible" && p.main_image && getPriceDrop(p, now));
  return {
    counts,
    availableCount: list.filter((p) => p.status === "disponible").length,
    featuredPool: [...new Map([...pickFeaturedProperties(featuredByDrop, { limit: FEATURED_POOL, now }), ...pickFeaturedProperties(list, { limit: FEATURED_POOL, now })].map((p) => [p.id, p])).values()],
    videoPool: pickVideoTours(list, { limit: VIDEO_POOL }).map((entry) => entry.property),
  };
}
