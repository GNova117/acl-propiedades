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

export function pointInPolygon(p: Point, poly: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.z > p.z !== b.z > p.z && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

export type Bounds = { minX: number; maxX: number; minZ: number; maxZ: number };

export function polygonBounds(points: Point[]): Bounds {
  return {
    minX: Math.min(...points.map((p) => p.x)),
    maxX: Math.max(...points.map((p) => p.x)),
    minZ: Math.min(...points.map((p) => p.z)),
    maxZ: Math.max(...points.map((p) => p.z)),
  };
}

/**
 * Ajuste ("imán") al soltar una habitación arrastrada: si un borde de su caja queda a menos de
 * `tolerance` m de un borde de otra habitación (pegado o alineado), devuelve el desplazamiento
 * extra que lo hace coincidir exactamente — así los cuartos quedan con la pared compartida.
 */
export function snapBoundsToNeighbors(moving: Bounds, others: Bounds[], tolerance: number): { dx: number; dz: number } {
  let bestDx = 0;
  let bestDxAbs = tolerance;
  let bestDz = 0;
  let bestDzAbs = tolerance;
  for (const o of others) {
    // Solo se pega en un eje si las cajas se traslapan (o casi se tocan) en el otro.
    const overlapZ = moving.minZ < o.maxZ + tolerance && moving.maxZ > o.minZ - tolerance;
    const overlapX = moving.minX < o.maxX + tolerance && moving.maxX > o.minX - tolerance;
    if (overlapZ) {
      for (const d of [o.maxX - moving.minX, o.minX - moving.maxX, o.minX - moving.minX, o.maxX - moving.maxX]) {
        if (Math.abs(d) < bestDxAbs) {
          bestDxAbs = Math.abs(d);
          bestDx = d;
        }
      }
    }
    if (overlapX) {
      for (const d of [o.maxZ - moving.minZ, o.minZ - moving.maxZ, o.minZ - moving.minZ, o.maxZ - moving.maxZ]) {
        if (Math.abs(d) < bestDzAbs) {
          bestDzAbs = Math.abs(d);
          bestDz = d;
        }
      }
    }
  }
  return { dx: bestDx, dz: bestDz };
}

// ─────────────────────────────────────────────
// Medidas exactas: edición numérica de muros y vértices.
// ─────────────────────────────────────────────

const round4 = (v: number) => Math.round(v * 10_000) / 10_000;
const roundPoint = (p: Point): Point => ({ x: round4(p.x), z: round4(p.z) });

/**
 * Cambia el largo del muro `i` (de `points[i]` a `points[i+1]`) a `newLength` m, moviéndolo hacia
 * su extremo final. Si el muro siguiente forma un ángulo recto con él (lo normal en cuartos y en
 * casas en "L"), se traslada ese muro completo en lugar de solo su vértice: así los ángulos rectos
 * se conservan y el muro de enfrente se ajusta solo (un rectángulo sigue siendo rectángulo). Si no
 * hay ángulo recto (o es un triángulo) solo se mueve el vértice final.
 */
export function setWallLength(points: Point[], i: number, newLength: number): Point[] {
  const n = points.length;
  if (n < 2 || !(newLength > 0) || i < 0 || i >= n) return points;
  const a = points[i];
  const j = (i + 1) % n;
  const b = points[j];
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  if (len < 1e-9) return points;

  const ux = (b.x - a.x) / len;
  const uz = (b.z - a.z) / len;
  const dx = ux * (newLength - len);
  const dz = uz * (newLength - len);

  const k = (j + 1) % n;
  const c = points[k];
  const nextLen = Math.hypot(c.x - b.x, c.z - b.z);
  const rightAngle = n >= 4 && nextLen > 1e-9 && Math.abs((ux * (c.x - b.x) + uz * (c.z - b.z)) / nextLen) < 0.02;

  return points.map((p, idx) => (idx === j || (rightAngle && idx === k) ? roundPoint({ x: p.x + dx, z: p.z + dz }) : p));
}

export function moveVertex(points: Point[], i: number, to: Point): Point[] {
  if (i < 0 || i >= points.length) return points;
  return points.map((p, idx) => (idx === i ? roundPoint(to) : p));
}

/**
 * "Dibujar por medidas": agrega un muro de `lengthM` m a una polilínea abierta, girando `turnDeg`
 * grados respecto al muro anterior (+ = a la derecha en la pantalla, − = a la izquierda). El primer
 * muro va hacia el este desde `start`. Es como se captura en campo con un láser o una cinta: largo,
 * giro, largo, giro…
 */
export function appendByMeasure(points: Point[], lengthM: number, turnDeg: number, start: Point = { x: 1, z: 1 }): Point[] {
  if (!(lengthM > 0)) return points;
  if (points.length <= 1) {
    const origin = points[0] ?? start;
    return [origin, roundPoint({ x: origin.x + lengthM, z: origin.z })];
  }
  const a = points[points.length - 2];
  const b = points[points.length - 1];
  const heading = Math.atan2(b.z - a.z, b.x - a.x) + (turnDeg * Math.PI) / 180;
  return [...points, roundPoint({ x: b.x + Math.cos(heading) * lengthM, z: b.z + Math.sin(heading) * lengthM })];
}

/** Distancia del último punto al primero: cuánto "falta" para cerrar la figura. */
export function closingGap(points: Point[]): number {
  if (points.length < 3) return 0;
  const first = points[0];
  const last = points[points.length - 1];
  return Math.hypot(last.x - first.x, last.z - first.z);
}

/** Alinea `p` con los ejes (misma x o misma z) de los puntos de referencia que estén a menos de `tol` m. */
export function snapToAxes(p: Point, refs: Point[], tol: number): Point {
  let x = p.x;
  let z = p.z;
  let bestX = tol;
  let bestZ = tol;
  for (const r of refs) {
    const dx = Math.abs(p.x - r.x);
    if (dx < bestX) {
      bestX = dx;
      x = r.x;
    }
    const dz = Math.abs(p.z - r.z);
    if (dz < bestZ) {
      bestZ = dz;
      z = r.z;
    }
  }
  return { x, z };
}

/** Recorta las aberturas de una habitación para que sigan cabiendo en sus muros tras editar la geometría. */
export function clampOpeningsToWalls<T extends { segmentIndex: number; offsetM: number; anchoM: number }>(
  points: Point[],
  openings: T[],
): T[] {
  const segs = wallSegmentsFromPolygon(points);
  return openings.map((o) => {
    const seg = segs[o.segmentIndex];
    if (!seg) return o;
    const ancho = Math.min(o.anchoM, Math.max(seg.length - 0.1, 0.1));
    const half = ancho / 2;
    const offsetM = Math.min(Math.max(o.offsetM, half), Math.max(seg.length - half, half));
    return ancho === o.anchoM && offsetM === o.offsetM ? o : { ...o, anchoM: ancho, offsetM };
  });
}

/** Caja que encierra varias cajas; null si no hay ninguna. */
export function unionBounds(boxes: Bounds[]): Bounds | null {
  if (boxes.length === 0) return null;
  return {
    minX: Math.min(...boxes.map((b) => b.minX)),
    maxX: Math.max(...boxes.map((b) => b.maxX)),
    minZ: Math.min(...boxes.map((b) => b.minZ)),
    maxZ: Math.max(...boxes.map((b) => b.maxZ)),
  };
}
