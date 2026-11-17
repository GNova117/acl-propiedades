// Deslizamiento horizontal con el dedo, compartido por la foto principal de la
// ficha y el visor de pantalla completa.
export const SWIPE_THRESHOLD = 40;

// 1 = deslizó a la izquierda (siguiente), -1 = a la derecha (anterior), o null si
// fue corto o más vertical que horizontal (eso es scroll, no un cambio de foto).
export function swipeDirection(startX, startY, endX, endY) {
  const dx = endX - startX;
  const dy = endY - startY;
  if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy) * 1.5) return null;
  return dx < 0 ? 1 : -1;
}
