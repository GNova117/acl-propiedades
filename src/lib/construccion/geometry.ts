export type Point = { x: number; z: number };

export type WallSegment = {
  start: Point;
  end: Point;
  length: number;
  angle: number;
  center: Point;
};

function segmentsFromPoints(points: Point[], closed: boolean): WallSegment[] {
  const n = points.length;
  const count = closed ? n : Math.max(0, n - 1);
  const segments: WallSegment[] = [];
  for (let i = 0; i < count; i++) {
    const start = points[i];
    const end = points[(i + 1) % n];
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    segments.push({
      start,
      end,
      length: Math.hypot(dx, dz),
      angle: Math.atan2(dz, dx),
      center: { x: (start.x + end.x) / 2, z: (start.z + end.z) / 2 },
    });
  }
  return segments;
}

/** Convierte un polígono cerrado de puntos (x, z) en segmentos de muro, uno por lado. */
export function wallSegmentsFromPolygon(points: Point[]): WallSegment[] {
  return segmentsFromPoints(points, true);
}

/** Segmentos de una polilínea abierta (aún sin cerrar), sin el tramo de regreso al inicio. */
export function openPolylineSegments(points: Point[]): WallSegment[] {
  return segmentsFromPoints(points, false);
}

/** Área de un polígono cerrado (fórmula del shoelace), en las mismas unidades que los puntos al cuadrado. */
export function polygonArea(points: Point[]): number {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.z - b.x * a.z;
  }
  return Math.abs(sum) / 2;
}

export function polygonPerimeter(points: Point[]): number {
  return wallSegmentsFromPolygon(points).reduce((sum, s) => sum + s.length, 0);
}

export function snap(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

export type FacadeOpening = {
  offsetM: number;
  anchoM: number;
  altoM: number;
  altoDesdePisoM: number;
};

export type FacadeRect = { x0: number; x1: number; y0: number; y1: number };

/**
 * Descompone la fachada de un muro (longitud x altura) en rectángulos sólidos, dejando huecos
 * donde caen las aberturas — así el render 3D puede construir muros con puertas/ventanas reales
 * usando solo cajas, sin necesidad de geometría booleana (CSG).
 */
export function wallFacadeRects(length: number, height: number, openings: FacadeOpening[]): FacadeRect[] {
  const rects: FacadeRect[] = [];
  const sorted = [...openings].sort((a, b) => a.offsetM - b.offsetM);
  let cursor = 0;

  for (const op of sorted) {
    const x0 = Math.max(0, Math.min(length, op.offsetM - op.anchoM / 2));
    const x1 = Math.max(0, Math.min(length, op.offsetM + op.anchoM / 2));
    if (x1 <= x0) continue;

    if (x0 > cursor) rects.push({ x0: cursor, x1: x0, y0: 0, y1: height });

    const sillTop = Math.min(height, Math.max(0, op.altoDesdePisoM));
    const headerBottom = Math.min(height, Math.max(sillTop, op.altoDesdePisoM + op.altoM));
    if (sillTop > 0) rects.push({ x0, x1, y0: 0, y1: sillTop });
    if (headerBottom < height) rects.push({ x0, x1, y0: headerBottom, y1: height });

    cursor = Math.max(cursor, x1);
  }

  if (cursor < length) rects.push({ x0: cursor, x1: length, y0: 0, y1: height });
  return rects.filter((r) => r.x1 > r.x0 && r.y1 > r.y0);
}

/** Proyecta un punto sobre un segmento; devuelve el parámetro t∈[0,1], el punto más cercano y la distancia. */
export function projectPointOnSegment(
  p: Point,
  seg: WallSegment,
): { t: number; point: Point; distance: number } {
  const dx = seg.end.x - seg.start.x;
  const dz = seg.end.z - seg.start.z;
  const lengthSq = dx * dx + dz * dz;
  let t = lengthSq === 0 ? 0 : ((p.x - seg.start.x) * dx + (p.z - seg.start.z) * dz) / lengthSq;
  t = Math.min(1, Math.max(0, t));
  const point = { x: seg.start.x + t * dx, z: seg.start.z + t * dz };
  return { t, point, distance: Math.hypot(p.x - point.x, p.z - point.z) };
}
