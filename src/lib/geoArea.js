// Área de un polígono trazado sobre el mapa, en m². `points` es una lista de
// [lat, lng]. Usa la fórmula esférica (la misma de Leaflet.draw/geodesicArea),
// no un cálculo plano: a la escala de un lote el error frente a un
// levantamiento real es de décimas de por ciento, mucho menor que el que mete
// dibujar los vértices a ojo sobre la imagen satelital.
const EARTH_RADIUS_M = 6378137;
const toRad = (deg) => (deg * Math.PI) / 180;

export function polygonAreaM2(points) {
  if (!Array.isArray(points) || points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const [lat1, lng1] = points[i];
    const [lat2, lng2] = points[(i + 1) % points.length];
    sum += toRad(lng2 - lng1) * (2 + Math.sin(toRad(lat1)) + Math.sin(toRad(lat2)));
  }
  return Math.abs((sum * EARTH_RADIUS_M * EARTH_RADIUS_M) / 2);
}
