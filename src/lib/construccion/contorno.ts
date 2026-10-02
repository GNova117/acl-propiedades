// Contorno por tabla: los muros de una figura abierta (la que se está dibujando) como filas
// "largo + giro", y las operaciones para editar una fila sin deformar el resto de la figura.
import type { Point } from "./geometry";
import type { Habitacion } from "./types";

const r4 = (v: number) => Math.round(v * 10_000) / 10_000;
const r2 = (v: number) => Math.round(v * 100) / 100;

export type MuroFila = {
  largoM: number;
  /** Giro respecto al muro anterior en grados (+ = derecha en pantalla). null en el primer muro. */
  giroDeg: number | null;
};

const rumbo = (a: Point, b: Point) => Math.atan2(b.z - a.z, b.x - a.x);

function normalizarGrados(g: number): number {
  let x = ((g + 180) % 360 + 360) % 360 - 180;
  if (x === -180) x = 180;
  return x;
}

/** Filas de la polilínea abierta `puntos` (n puntos → n−1 muros). */
export function murosDeContorno(puntos: Point[]): MuroFila[] {
  const filas: MuroFila[] = [];
  for (let i = 0; i + 1 < puntos.length; i++) {
    const giro = i === 0 ? null : r2(normalizarGrados(((rumbo(puntos[i], puntos[i + 1]) - rumbo(puntos[i - 1], puntos[i])) * 180) / Math.PI));
    filas.push({ largoM: r2(Math.hypot(puntos[i + 1].x - puntos[i].x, puntos[i + 1].z - puntos[i].z)), giroDeg: giro });
  }
  return filas;
}

/** Cambia el largo del muro `i` (de puntos[i] a puntos[i+1]); todo lo que sigue se corre con él, sin deformarse. */
export function setLargoContorno(puntos: Point[], i: number, largoM: number): Point[] {
  if (i < 0 || i + 1 >= puntos.length || !(largoM > 0)) return puntos;
  const a = puntos[i];
  const b = puntos[i + 1];
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  if (len < 1e-9) return puntos;
  const dx = ((b.x - a.x) / len) * (largoM - len);
  const dz = ((b.z - a.z) / len) * (largoM - len);
  return puntos.map((p, idx) => (idx > i ? { x: r4(p.x + dx), z: r4(p.z + dz) } : p));
}

/** Cambia el giro en el vértice `i` (entre el muro i−1 y el i); lo que sigue gira alrededor de ese vértice. */
export function setGiroContorno(puntos: Point[], i: number, giroDeg: number): Point[] {
  if (i < 1 || i + 1 >= puntos.length || !Number.isFinite(giroDeg)) return puntos;
  const actual = murosDeContorno(puntos)[i]?.giroDeg;
  if (actual === null || actual === undefined) return puntos;
  const th = (normalizarGrados(giroDeg - actual) * Math.PI) / 180;
  const c = Math.cos(th);
  const s = Math.sin(th);
  const o = puntos[i];
  return puntos.map((p, idx) => {
    if (idx <= i) return p;
    const x = p.x - o.x;
    const z = p.z - o.z;
    return { x: r4(o.x + x * c - z * s), z: r4(o.z + x * s + z * c) };
  });
}

/** Rectángulo `ancho` × `largo` con la esquina superior izquierda en `origen`. */
export function rectanguloPuntos(origen: Point, anchoM: number, largoM: number): Point[] {
  return [
    { x: origen.x, z: origen.z },
    { x: r4(origen.x + anchoM), z: origen.z },
    { x: r4(origen.x + anchoM), z: r4(origen.z + largoM) },
    { x: origen.x, z: r4(origen.z + largoM) },
  ];
}

/**
 * Reemplaza los puntos del cuarto `id` y arrastra con ellos los vértices de los demás cuartos que estaban
 * exactamente en el mismo lugar, para que un muro compartido no se desfase al cambiarle la medida.
 */
export function moverVerticesLigados(habitaciones: Habitacion[], id: string, nuevos: Point[]): Habitacion[] {
  const hab = habitaciones.find((h) => h.id === id);
  if (!hab || hab.puntos.length !== nuevos.length) return habitaciones;
  const cambios = hab.puntos
    .map((p, i) => ({ de: p, a: nuevos[i] }))
    .filter(({ de, a }) => Math.abs(de.x - a.x) > 1e-6 || Math.abs(de.z - a.z) > 1e-6);
  return habitaciones.map((h) => {
    if (h.id === id) return { ...h, puntos: nuevos };
    if (h.nivelId !== hab.nivelId) return h;
    let tocado = false;
    const puntos = h.puntos.map((p) => {
      const c = cambios.find(({ de }) => Math.abs(de.x - p.x) < 1e-3 && Math.abs(de.z - p.z) < 1e-3);
      if (!c) return p;
      tocado = true;
      return { x: c.a.x, z: c.a.z };
    });
    return tocado ? { ...h, puntos } : h;
  });
}
