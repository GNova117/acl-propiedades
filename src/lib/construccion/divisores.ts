// Líneas divisorias: el muro que dos cuartos del mismo nivel comparten (típicamente un corte hecho con
// "Dividir cuarto"). Moverla mueve a la vez los vértices de TODOS los cuartos que quedan sobre ella, así
// las dos zonas se reacomodan juntas y la pared sigue siendo una sola.
import { clampOpeningsToWalls, polygonBounds, wallSegmentsFromPolygon, type Point } from "./geometry";
import type { Habitacion } from "./types";

const TOL = 2e-3;
const SOLAPE_MINIMO_M = 0.05;
const AREA_MINIMA_M2 = 0.05;
const r4 = (v: number) => Math.round(v * 10_000) / 10_000;

export type Divisor = {
  /** Extremos del tramo compartido (para dibujar el asa). */
  a: Point;
  b: Point;
  /** Normal unitaria: mover la línea d metros = desplazar sus vértices d * n. */
  n: Point;
  /** Vértices que se mueven, con su posición original. */
  miembros: { habId: string; index: number; x0: number; z0: number }[];
};

type Tramo = { n: Point; u: Point; c: number; t0: number; t1: number };

/** Orientación canónica de la normal para que una misma recta dé siempre la misma (n, c). */
function canonica(u: Point): { u: Point; n: Point } {
  let n = { x: -u.z, z: u.x };
  if (n.x < -1e-9 || (Math.abs(n.x) <= 1e-9 && n.z < 0)) {
    n = { x: -n.x, z: -n.z };
    u = { x: -u.x, z: -u.z };
  }
  return { u, n };
}

function tramosCompartidos(a: Habitacion, b: Habitacion): Tramo[] {
  const out: Tramo[] = [];
  for (const sa of wallSegmentsFromPolygon(a.puntos)) {
    if (sa.length < SOLAPE_MINIMO_M) continue;
    const { u, n } = canonica({ x: (sa.end.x - sa.start.x) / sa.length, z: (sa.end.z - sa.start.z) / sa.length });
    const c = n.x * sa.start.x + n.z * sa.start.z;
    const tA0 = Math.min(u.x * sa.start.x + u.z * sa.start.z, u.x * sa.end.x + u.z * sa.end.z);
    const tA1 = Math.max(u.x * sa.start.x + u.z * sa.start.z, u.x * sa.end.x + u.z * sa.end.z);
    for (const sb of wallSegmentsFromPolygon(b.puntos)) {
      if (Math.abs(n.x * sb.start.x + n.z * sb.start.z - c) > TOL || Math.abs(n.x * sb.end.x + n.z * sb.end.z - c) > TOL) continue;
      const tb0 = u.x * sb.start.x + u.z * sb.start.z;
      const tb1 = u.x * sb.end.x + u.z * sb.end.z;
      const t0 = Math.max(tA0, Math.min(tb0, tb1));
      const t1 = Math.min(tA1, Math.max(tb0, tb1));
      if (t1 - t0 > SOLAPE_MINIMO_M) out.push({ n, u, c, t0, t1 });
    }
  }
  return out;
}

/** Todas las líneas divisorias de un conjunto de cuartos (los de un mismo nivel). */
export function divisoresDe(habitaciones: Habitacion[]): Divisor[] {
  // El lote (terreno) no es una zona que se reparta: sus lindes no son divisorias.
  const hs = habitaciones.filter((h) => h.puntos.length >= 3 && h.tipo !== "terreno");
  const tramos: Tramo[] = [];
  for (let i = 0; i < hs.length; i++) for (let j = i + 1; j < hs.length; j++) tramos.push(...tramosCompartidos(hs[i], hs[j]));

  // Mismo recta (misma normal y desplazamiento) y tramos que se tocan → una sola divisoria.
  const grupos: { n: Point; u: Point; c: number; ivs: [number, number][] }[] = [];
  for (const t of tramos) {
    let g = grupos.find((x) => Math.abs(x.n.x - t.n.x) < 1e-6 && Math.abs(x.n.z - t.n.z) < 1e-6 && Math.abs(x.c - t.c) < TOL);
    if (!g) {
      g = { n: t.n, u: t.u, c: t.c, ivs: [] };
      grupos.push(g);
    }
    g.ivs.push([t.t0, t.t1]);
  }

  const out: Divisor[] = [];
  for (const g of grupos) {
    g.ivs.sort((p, q) => p[0] - q[0]);
    const cadenas: [number, number][] = [];
    for (const iv of g.ivs) {
      const ult = cadenas[cadenas.length - 1];
      if (ult && iv[0] <= ult[1] + TOL) ult[1] = Math.max(ult[1], iv[1]);
      else cadenas.push([iv[0], iv[1]]);
    }
    for (const [T0, T1] of cadenas) {
      const miembros: Divisor["miembros"] = [];
      for (const h of hs) {
        h.puntos.forEach((p, index) => {
          const t = g.u.x * p.x + g.u.z * p.z;
          if (Math.abs(g.n.x * p.x + g.n.z * p.z - g.c) <= TOL && t >= T0 - TOL && t <= T1 + TOL) {
            miembros.push({ habId: h.id, index, x0: p.x, z0: p.z });
          }
        });
      }
      out.push({
        a: { x: g.u.x * T0 + g.n.x * g.c, z: g.u.z * T0 + g.n.z * g.c },
        b: { x: g.u.x * T1 + g.n.x * g.c, z: g.u.z * T1 + g.n.z * g.c },
        n: g.n,
        miembros,
      });
    }
  }
  return out;
}

function areaConSigno(pts: Point[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    s += p.x * q.z - q.x * p.z;
  }
  return s / 2;
}

/**
 * Desplaza la divisoria `d` metros a lo largo de su normal (desde las posiciones originales guardadas en
 * `div`). null si algún cuarto quedaría invertido o casi sin área.
 */
export function aplicarDivisor(habitaciones: Habitacion[], div: Divisor, d: number): Habitacion[] | null {
  const porHab = new Map<string, Map<number, Point>>();
  for (const m of div.miembros) {
    if (!porHab.has(m.habId)) porHab.set(m.habId, new Map());
    porHab.get(m.habId)!.set(m.index, { x: r4(m.x0 + div.n.x * d), z: r4(m.z0 + div.n.z * d) });
  }
  const resultado: Habitacion[] = [];
  for (const h of habitaciones) {
    const mov = porHab.get(h.id);
    if (!mov) {
      resultado.push(h);
      continue;
    }
    const puntos = h.puntos.map((p, i) => mov.get(i) ?? p);
    const antes = areaConSigno(h.puntos);
    const despues = areaConSigno(puntos);
    if (Math.abs(despues) < AREA_MINIMA_M2 || Math.sign(antes) !== Math.sign(despues)) return null;
    resultado.push({ ...h, puntos, aberturas: clampOpeningsToWalls(puntos, h.aberturas) });
  }
  return resultado;
}

export function esRectangulo(h: Habitacion): { minX: number; maxX: number; minZ: number; maxZ: number } | null {
  if (h.puntos.length !== 4) return null;
  const xs = h.puntos.map((p) => p.x);
  const zs = h.puntos.map((p) => p.z);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  const enEsquinas = h.puntos.every((p) => (Math.abs(p.x - minX) < TOL || Math.abs(p.x - maxX) < TOL) && (Math.abs(p.z - minZ) < TOL || Math.abs(p.z - maxZ) < TOL));
  return enEsquinas && maxX - minX > TOL && maxZ - minZ > TOL ? { minX, maxX, minZ, maxZ } : null;
}

/** Ancho (x) y largo (z) de un cuarto rectangular; null si no es un rectángulo con lados rectos. */
export function medidasRectangulo(h: Habitacion): { anchoM: number; largoM: number } | null {
  const r = esRectangulo(h);
  return r ? { anchoM: r4(r.maxX - r.minX), largoM: r4(r.maxZ - r.minZ) } : null;
}

export type Lado = "n" | "s" | "e" | "w";

/**
 * Mueve un lado de un cuarto rectangular `delta` metros (+ = hacia +x / +z). Si ese lado es una divisoria compartida
 * los cuartos de enfrente se ajustan con él; si es un muro exterior, solo cambia este cuarto. null si no es
 * rectangular o el resultado no es válido (cuarto invertido o casi sin área).
 */
export function moverLado(habitaciones: Habitacion[], id: string, lado: Lado, delta: number): Habitacion[] | null {
  const hab = habitaciones.find((h) => h.id === id);
  if (!hab) return null;
  const rect = esRectangulo(hab);
  if (!rect) return null;
  if (Math.abs(delta) < 1e-6) return habitaciones;
  const alX = lado === "e" || lado === "w";
  const coord = lado === "w" ? rect.minX : lado === "e" ? rect.maxX : lado === "n" ? rect.minZ : rect.maxZ;
  const indices = hab.puntos.map((p, i) => (Math.abs((alX ? p.x : p.z) - coord) < TOL ? i : -1)).filter((i) => i >= 0);
  const n = alX ? { x: 1, z: 0 } : { x: 0, z: 1 };
  const sobreLinea = (p: Point) => Math.abs((alX ? p.x : p.z) - coord) < TOL;
  const along = (p: Point) => (alX ? p.z : p.x);
  const tramo = indices.map((i) => along(hab.puntos[i]));
  const t0 = Math.min(...tramo);
  const t1 = Math.max(...tramo);

  // Los cuartos pegados a ese lado se mueven con él: todo vértice que esté sobre la línea y dentro del tramo del lado.
  // Un cuarto cuyo muro sobre esa línea se pasa más allá del tramo (queda más largo) no se toca: su muro seguiría ahí.
  const miembros: Divisor["miembros"] = indices.map((i) => ({ habId: id, index: i, x0: hab.puntos[i].x, z0: hab.puntos[i].z }));
  for (const otra of habitaciones) {
    if (otra.id === id || otra.nivelId !== hab.nivelId || otra.tipo === "terreno" || otra.puntos.length < 3) continue;
    const m = otra.puntos.length;
    const seSale = otra.puntos.some((p, i) => {
      const q = otra.puntos[(i + 1) % m];
      return sobreLinea(p) && sobreLinea(q) && (Math.min(along(p), along(q)) < t0 - TOL || Math.max(along(p), along(q)) > t1 + TOL);
    });
    if (seSale) continue;
    otra.puntos.forEach((p, i) => {
      if (sobreLinea(p) && along(p) >= t0 - TOL && along(p) <= t1 + TOL) miembros.push({ habId: otra.id, index: i, x0: p.x, z0: p.z });
    });
  }
  const div: Divisor = { a: hab.puntos[indices[0]], b: hab.puntos[indices[indices.length - 1]], n, miembros };
  return aplicarDivisor(habitaciones, div, r4(delta));
}

/**
 * Cambia el ancho o el largo de un cuarto rectangular moviendo su lado derecho (ancho) o inferior (largo).
 * Si ese lado es una divisoria compartida, el cuarto vecino se ajusta con él; si es un muro exterior,
 * solo cambia este cuarto. null si no es rectangular o el resultado no es válido.
 */
export function cambiarMedidaZona(habitaciones: Habitacion[], id: string, eje: "ancho" | "largo", nuevoM: number): Habitacion[] | null {
  const hab = habitaciones.find((h) => h.id === id);
  if (!hab || !(nuevoM > 0.1)) return null;
  const rect = esRectangulo(hab);
  if (!rect) return null;
  const alX = eje === "ancho";
  const actual = alX ? rect.maxX - rect.minX : rect.maxZ - rect.minZ;
  return moverLado(habitaciones, id, alX ? "e" : "s", r4(nuevoM - actual));
}

/** Asas para redimensionar un cuarto rectangular: los cuatro lados (en el centro) y las cuatro esquinas. */
export type Asa = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export function asasDe(h: Habitacion): { asa: Asa; p: Point }[] {
  const r = esRectangulo(h);
  if (!r) return [];
  const mx = (r.minX + r.maxX) / 2;
  const mz = (r.minZ + r.maxZ) / 2;
  return [
    { asa: "nw", p: { x: r.minX, z: r.minZ } },
    { asa: "n", p: { x: mx, z: r.minZ } },
    { asa: "ne", p: { x: r.maxX, z: r.minZ } },
    { asa: "e", p: { x: r.maxX, z: mz } },
    { asa: "se", p: { x: r.maxX, z: r.maxZ } },
    { asa: "s", p: { x: mx, z: r.maxZ } },
    { asa: "sw", p: { x: r.minX, z: r.maxZ } },
    { asa: "w", p: { x: r.minX, z: mz } },
  ];
}

/** Lado más corto permitido al redimensionar (m). */
const LADO_MINIMO_M = 0.3;

/** Al soltar el mouse en `p`, el valor `v` va a la línea de la cuadrícula (de paso `paso`) más cercana. */
const aCuadricula = (v: number, paso: number) => (paso > 0 ? r4(Math.round(v / paso) * paso) : r4(v));

/**
 * Arrastrar un asa de un cuarto rectangular: el lado (o los dos lados de una esquina) queda sobre la línea de la
 * cuadrícula más cercana al puntero `p`. Los cuartos pegados a ese lado se ajustan con él. Devuelve las mismas
 * habitaciones si no hay cambio y null si el movimiento no es válido (por ejemplo, dejaría un lado de menos de 30 cm).
 */
export function redimensionarZona(habitaciones: Habitacion[], id: string, asa: Asa, p: Point, paso: number): Habitacion[] | null {
  let actual = habitaciones;
  for (const lado of asa.split("") as Lado[]) {
    const hab = actual.find((h) => h.id === id);
    const r = hab && esRectangulo(hab);
    if (!r) return null;
    const objetivo = aCuadricula(lado === "w" || lado === "e" ? p.x : p.z, paso);
    const hoy = lado === "w" ? r.minX : lado === "e" ? r.maxX : lado === "n" ? r.minZ : r.maxZ;
    const cabe =
      lado === "e" ? objetivo - r.minX >= LADO_MINIMO_M - 1e-6 : lado === "w" ? r.maxX - objetivo >= LADO_MINIMO_M - 1e-6 : lado === "s" ? objetivo - r.minZ >= LADO_MINIMO_M - 1e-6 : r.maxZ - objetivo >= LADO_MINIMO_M - 1e-6;
    if (!cabe) continue; // ese lado no se mueve más allá del mínimo; los demás sí
    const siguiente = moverLado(actual, id, lado, r4(objetivo - hoy));
    if (!siguiente) return null;
    actual = siguiente;
  }
  if (actual === habitaciones) return habitaciones;
  // Ningún cuarto afectado (el propio o un vecino) puede quedar con un lado de menos de 20 cm.
  for (let i = 0; i < actual.length; i++) {
    if (actual[i] === habitaciones[i]) continue;
    const b = polygonBounds(actual[i].puntos);
    if (b.maxX - b.minX < 0.2 || b.maxZ - b.minZ < 0.2) return null;
  }
  return actual;
}
