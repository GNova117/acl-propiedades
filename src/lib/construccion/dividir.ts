// Partir un cuarto en dos con una línea recta (para dibujar primero el contorno de
// la casa en "Plano completo" y repartirlo después en cuartos). Las paredes que
// quedan en común salen exactas porque los dos cuartos nuevos comparten los mismos
// dos puntos del corte.
import { clampOpeningsToWalls, pointInPolygon, polygonArea, projectPointOnSegment, wallSegmentsFromPolygon, type Point } from "./geometry";
import type { Abertura, Habitacion, Proyecto } from "./types";

const EPS = 1e-6;
/** Dos puntos a menos de esto (m) se consideran el mismo vértice. */
const MISMO_PUNTO_M = 1e-3;
/** Un punto de corte a menos de esto (m) de una esquina se pega a ella — evita astillas de 2 cm. */
const PEGAR_A_ESQUINA_M = 0.04;
/** Si el corte va a menos de este ángulo de la horizontal o vertical, se endereza. */
const ENDEREZAR_GRADOS = 8;
const AREA_MINIMA_M2 = 0.05;

const r4 = (v: number) => Math.round(v * 10_000) / 10_000;
const cerca = (a: Point, b: Point, tol = MISMO_PUNTO_M) => Math.hypot(a.x - b.x, a.z - b.z) < tol;

function pegarAEsquina(puntos: Point[], p: Point): Point {
  const esquina = puntos.find((q) => cerca(q, p, PEGAR_A_ESQUINA_M));
  return esquina ? { ...esquina } : { x: r4(p.x), z: r4(p.z) };
}

/** Punto del borde del cuarto más cercano a `p`, si está a menos de `tol` m; null si no. */
export function puntoEnBorde(puntos: Point[], p: Point, tol: number): Point | null {
  let mejor: { point: Point; distance: number } | null = null;
  for (const seg of wallSegmentsFromPolygon(puntos)) {
    const hit = projectPointOnSegment(p, seg);
    if (!mejor || hit.distance < mejor.distance) mejor = hit;
  }
  return mejor && mejor.distance <= tol ? pegarAEsquina(puntos, mejor.point) : null;
}

/**
 * Hasta dónde llega un corte que sale de `desde` (un punto del borde) hacia `hacia`: el primer muro
 * que encuentra. Si la dirección queda a menos de 8° de la horizontal o vertical se endereza, así un
 * cuarto rectangular se parte exacto aunque el clic no haya quedado perfecto.
 */
export function puntoDeCorte(puntos: Point[], desde: Point, hacia: Point): Point | null {
  let dx = hacia.x - desde.x;
  let dz = hacia.z - desde.z;
  if (Math.hypot(dx, dz) < 0.05) return null;
  const tolerancia = Math.tan((ENDEREZAR_GRADOS * Math.PI) / 180);
  if (Math.abs(dz) <= Math.abs(dx) * tolerancia) dz = 0;
  else if (Math.abs(dx) <= Math.abs(dz) * tolerancia) dx = 0;
  const n = Math.hypot(dx, dz);
  dx /= n;
  dz /= n;

  let mejorT = Infinity;
  for (const seg of wallSegmentsFromPolygon(puntos)) {
    const ex = seg.end.x - seg.start.x;
    const ez = seg.end.z - seg.start.z;
    const denom = dx * ez - dz * ex;
    if (Math.abs(denom) < EPS) continue; // paralelo
    const sx = seg.start.x - desde.x;
    const sz = seg.start.z - desde.z;
    const t = (sx * ez - sz * ex) / denom; // distancia sobre el corte
    const u = (sx * dz - sz * dx) / denom; // posición sobre el muro (0..1)
    if (t > 1e-4 && u >= -EPS && u <= 1 + EPS && t < mejorT) mejorT = t;
  }
  if (!Number.isFinite(mejorT)) return null;
  return pegarAEsquina(puntos, { x: desde.x + dx * mejorT, z: desde.z + dz * mejorT });
}

/** Mete `p` en el anillo (si no es ya un vértice) y devuelve el anillo nuevo con su posición. */
function insertar(anillo: Point[], p: Point): { anillo: Point[]; index: number } | null {
  const existente = anillo.findIndex((q) => cerca(q, p));
  if (existente >= 0) return { anillo, index: existente };
  const segs = wallSegmentsFromPolygon(anillo);
  let mejor = -1;
  let distancia = Infinity;
  segs.forEach((s, i) => {
    const d = projectPointOnSegment(p, s).distance;
    if (d < distancia) {
      distancia = d;
      mejor = i;
    }
  });
  if (mejor < 0 || distancia > MISMO_PUNTO_M) return null;
  return { anillo: [...anillo.slice(0, mejor + 1), p, ...anillo.slice(mejor + 1)], index: mejor + 1 };
}

/** Parte el polígono por la recta A–B (ambos sobre el borde). null si el corte no produce dos cuartos válidos. */
export function partirPoligono(puntos: Point[], a: Point, b: Point): [Point[], Point[]] | null {
  const conA = insertar(puntos, a);
  if (!conA) return null;
  const conB = insertar(conA.anillo, b);
  if (!conB) return null;
  const anillo = conB.anillo;
  const ia = anillo.findIndex((q) => cerca(q, a));
  const ib = anillo.findIndex((q) => cerca(q, b));
  if (ia < 0 || ib < 0 || ia === ib) return null;

  const recorrer = (desde: number, hasta: number) => {
    const out: Point[] = [];
    let i = desde;
    for (;;) {
      out.push(anillo[i]);
      if (i === hasta) break;
      i = (i + 1) % anillo.length;
    }
    return out;
  };
  const uno = recorrer(ia, ib);
  const otro = recorrer(ib, ia);
  if (uno.length < 3 || otro.length < 3) return null;
  if (polygonArea(uno) < AREA_MINIMA_M2 || polygonArea(otro) < AREA_MINIMA_M2) return null;
  return [uno, otro];
}

/** Lleva las puertas/ventanas de un cuarto a los muros equivalentes de las dos partes. */
function repartirAberturas(aberturas: Abertura[], original: Point[], partes: Point[][]): Abertura[][] {
  const segsOriginal = wallSegmentsFromPolygon(original);
  const resultado: Abertura[][] = partes.map(() => []);
  for (const ab of aberturas) {
    const seg = segsOriginal[ab.segmentIndex];
    if (!seg || seg.length === 0) continue;
    const f = ab.offsetM / seg.length;
    const centro = { x: seg.start.x + (seg.end.x - seg.start.x) * f, z: seg.start.z + (seg.end.z - seg.start.z) * f };
    for (let k = 0; k < partes.length; k++) {
      const segs = wallSegmentsFromPolygon(partes[k]);
      const j = segs.findIndex((s) => projectPointOnSegment(centro, s).distance < MISMO_PUNTO_M);
      if (j < 0) continue;
      resultado[k].push({ ...ab, segmentIndex: j, offsetM: Math.hypot(centro.x - segs[j].start.x, centro.z - segs[j].start.z) });
      break;
    }
  }
  return resultado.map((lista, k) => clampOpeningsToWalls(partes[k], lista));
}

/**
 * Divide el cuarto `id` con un corte que sale de `desde` (sobre su borde) hacia `hacia`. La primera parte
 * conserva el id, el nombre y todo lo demás del cuarto original; la segunda es un cuarto nuevo del mismo
 * tipo. Las puertas/ventanas y los muebles se reparten según la parte en la que caen. null si el corte
 * no cabe dentro del cuarto.
 */
export function dividirHabitacion(
  proyecto: Proyecto,
  id: string,
  desde: Point,
  hacia: Point,
): { proyecto: Proyecto; nuevaId: string } | null {
  const hab = proyecto.habitaciones.find((h) => h.id === id);
  if (!hab || hab.puntos.length < 3) return null;
  const fin = puntoDeCorte(hab.puntos, desde, hacia);
  if (!fin) return null;
  // El corte debe ir por adentro del cuarto (en un cuarto en "L" el primer muro que topa podría ser el de afuera).
  if (!pointInPolygon({ x: (desde.x + fin.x) / 2, z: (desde.z + fin.z) / 2 }, hab.puntos)) return null;
  const partes = partirPoligono(hab.puntos, desde, fin);
  if (!partes) return null;

  const [aberturasA, aberturasB] = repartirAberturas(hab.aberturas, hab.puntos, partes);
  const nuevaId = crypto.randomUUID();
  const parteA: Habitacion = { ...hab, puntos: partes[0], aberturas: aberturasA };
  const parteB: Habitacion = {
    ...hab,
    id: nuevaId,
    nombre: `Habitación ${proyecto.habitaciones.length + 1}`,
    puntos: partes[1],
    aberturas: aberturasB,
  };
  return {
    nuevaId,
    proyecto: {
      ...proyecto,
      habitaciones: proyecto.habitaciones.flatMap((h) => (h.id === id ? [parteA, parteB] : [h])),
      objetos: proyecto.objetos.map((o) => {
        if (o.habitacionId !== id) return o;
        const centro = { x: o.x, z: o.z };
        return !pointInPolygon(centro, partes[0]) && pointInPolygon(centro, partes[1]) ? { ...o, habitacionId: nuevaId } : o;
      }),
    },
  };
}
