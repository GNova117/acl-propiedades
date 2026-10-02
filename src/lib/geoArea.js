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

// Proyección local (tangente en el centroide) de un contorno [lat,lng] a
// metros planos {x, z} — para mandar una figura ya medida en Valuación como
// punto de partida de un proyecto de Construcción. A la escala de un lote el
// error de no usar la fórmula esférica es insignificante (mismo motivo que en
// polygonAreaM2, pero ahí sí hace falta la precisión porque es el número que
// se muestra). x = este, z = sur (mismo criterio de "z crece hacia abajo" que
// el resto del módulo de Construcción).
export function polygonToLocalMeters(points) {
  if (!Array.isArray(points) || points.length === 0) return [];
  const lat0 = points.reduce((s, [lat]) => s + lat, 0) / points.length;
  const lng0 = points.reduce((s, [, lng]) => s + lng, 0) / points.length;
  const cosLat0 = Math.cos(toRad(lat0));
  const round2 = (v) => Math.round(v * 100) / 100;
  return points.map(([lat, lng]) => ({
    x: round2(toRad(lng - lng0) * EARTH_RADIUS_M * cosLat0),
    z: round2(toRad(lat0 - lat) * EARTH_RADIUS_M),
  }));
}
