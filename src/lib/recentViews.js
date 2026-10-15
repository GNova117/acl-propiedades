// Umbral mínimo para mostrar el indicador: "1 vista reciente" no aporta
// como prueba social (y se nota raro), así que se oculta hasta que haya
// al menos 2 visitantes distintos.
export const MIN_VIEWS_TO_SHOW = 2;

export function shouldShowRecentViews(count) {
  return Number(count) >= MIN_VIEWS_TO_SHOW;
}
