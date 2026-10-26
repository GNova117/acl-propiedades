// Recorridos en video para el inicio: una tarjeta por propiedad disponible que
// tenga al menos un video (el primero), las más recientes primero.
export const MAX_VIDEO_TOURS = 8;

export function pickVideoTours(properties, { limit = MAX_VIDEO_TOURS } = {}) {
  return (properties || [])
    .filter((p) => p.status === "disponible" && p.active !== false && Array.isArray(p.videos) && p.videos.some(Boolean))
    .sort((a, b) => (new Date(b.created_at).getTime() || 0) - (new Date(a.created_at).getTime() || 0))
    .slice(0, limit)
    .map((property) => ({ property, src: property.videos.find(Boolean) }));
}

// Con "#t=0.1" el navegador muestra el primer cuadro como portada sin bajar el
// video completo (junto con preload="metadata"). Si la URL ya trae un
// fragmento, se respeta.
export function posterFrameUrl(src) {
  return src.includes("#") ? src : `${src}#t=0.1`;
}
