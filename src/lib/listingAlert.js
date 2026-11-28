// 323: dónde va el aviso «avísame cuando haya algo así» en el listado. Con pocos resultados (hasta `after`) va al final, donde
// se lee; con más, se mete después de la primera tanda de tarjetas, porque casi nadie llega al final de 24.
export const ALERT_AFTER = 6;

// → "inline" (dentro de la rejilla, tras la tarjeta número `after`) o "end" (después de todo)
export function alertPlacement(visibleCount, after = ALERT_AFTER) {
  return Number(visibleCount) > after ? "inline" : "end";
}
