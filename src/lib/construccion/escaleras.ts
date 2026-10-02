// Geometría de las escaleras: contorno, peldaños y flecha de subida para el plano (2D) y los bloques de
// cada peldaño para el render 3D. Todo en coordenadas locales centradas en (0, 0), con x a la derecha y
// z hacia abajo (igual que el plano); el objeto se coloca y se gira después.
import type { Point } from "./geometry";

export type TipoEscalera = "escalera_recta" | "escalera_L" | "escalera_caracol";

export type Paso = {
  /** Centro del peldaño en planta. */
  x: number;
  z: number;
  /** Medidas en planta (w a lo largo de x local, d a lo largo de z local). */
  w: number;
  d: number;
  /** Altura de la cara de arriba del peldaño desde el piso. */
  top: number;
  /** Giro del bloque sobre el eje vertical (rad) — solo el caracol. */
  rot?: number;
};

export type GeoEscalera = {
  contorno: Point[];
  peldanos: [Point, Point][];
  flecha: Point[];
  pasos: Paso[];
  /** Radio del poste central (solo caracol). */
  poste?: number;
};

const CONTRAHUELLA_M = 0.18;
const flechaHacia = (desde: Point, hasta: Point): Point[] => {
  const dx = hasta.x - desde.x;
  const dz = hasta.z - desde.z;
  const n = Math.hypot(dx, dz) || 1;
  const ux = dx / n;
  const uz = dz / n;
  const a = 0.14;
  return [desde, hasta, { x: hasta.x - ux * a - uz * a * 0.6, z: hasta.z - uz * a + ux * a * 0.6 }, hasta, { x: hasta.x - ux * a + uz * a * 0.6, z: hasta.z - uz * a - ux * a * 0.6 }];
};

/** Cuántos peldaños (contrahuellas) hacen falta para salvar `alturaM`. */
export const numeroDePeldanos = (alturaM: number) => Math.max(3, Math.round(alturaM / CONTRAHUELLA_M));

export function geometriaEscalera(tipo: TipoEscalera, anchoM: number, largoM: number, alturaM: number): GeoEscalera {
  const n = numeroDePeldanos(alturaM);
  const h = alturaM / n;

  if (tipo === "escalera_caracol") {
    const R = Math.max(anchoM, largoM) / 2;
    const r0 = Math.min(0.12, R / 4);
    const contorno = Array.from({ length: 36 }, (_, i) => ({ x: Math.cos((i / 36) * 2 * Math.PI) * R, z: Math.sin((i / 36) * 2 * Math.PI) * R }));
    const peldanos: [Point, Point][] = [];
    const pasos: Paso[] = [];
    for (let k = 0; k < n; k++) {
      const phi = ((k + 0.5) / n) * 2 * Math.PI - Math.PI / 2;
      const phi0 = (k / n) * 2 * Math.PI - Math.PI / 2;
      peldanos.push([
        { x: Math.cos(phi0) * r0, z: Math.sin(phi0) * r0 },
        { x: Math.cos(phi0) * R, z: Math.sin(phi0) * R },
      ]);
      const largoRadial = R - r0;
      const rc = r0 + largoRadial / 2;
      pasos.push({ x: Math.cos(phi) * rc, z: Math.sin(phi) * rc, w: largoRadial, d: ((2 * Math.PI * rc) / n) * 1.08, top: (k + 1) * h, rot: -phi });
    }
    // Flecha: un arco en el sentido de subida (horario visto desde arriba) con la punta al final.
    const rf = R * 0.62;
    const arco = Array.from({ length: 13 }, (_, i) => {
      const a = -Math.PI / 2 + (i / 12) * Math.PI * 1.5;
      return { x: Math.cos(a) * rf, z: Math.sin(a) * rf };
    });
    const fin = arco[arco.length - 1];
    const previo = arco[arco.length - 2];
    return { contorno, peldanos, flecha: [...arco, ...flechaHacia(previo, fin).slice(2)], pasos, poste: r0 };
  }

  if (tipo === "escalera_L") {
    const A = anchoM;
    const L = largoM;
    const W = Math.min(1.0, Math.min(A, L) / 2.2);
    const f1 = L - W;
    const f2 = A - W;
    const k1 = Math.max(1, Math.round(((n - 1) * f1) / (f1 + f2)));
    const k2 = Math.max(1, n - 1 - k1);
    const x0 = -A / 2;
    const z0 = -L / 2;
    const pasos: Paso[] = [];
    const peldanos: [Point, Point][] = [];
    for (let i = 0; i < k1; i++) {
      pasos.push({ x: x0 + W / 2, z: L / 2 - ((i + 0.5) * f1) / k1, w: W, d: f1 / k1, top: (i + 1) * h });
      const z = L / 2 - ((i + 1) * f1) / k1;
      peldanos.push([{ x: x0, z }, { x: x0 + W, z }]);
    }
    pasos.push({ x: x0 + W / 2, z: z0 + W / 2, w: W, d: W, top: (k1 + 1) * h });
    for (let j = 0; j < k2; j++) {
      pasos.push({ x: x0 + W + ((j + 0.5) * f2) / k2, z: z0 + W / 2, w: f2 / k2, d: W, top: (k1 + 2 + j) * h });
      if (j > 0) {
        const x = x0 + W + (j * f2) / k2;
        peldanos.push([{ x, z: z0 }, { x, z: z0 + W }]);
      }
    }
    peldanos.push([{ x: x0 + W, z: z0 }, { x: x0 + W, z: z0 + W }]);
    const contorno = [
      { x: x0, z: L / 2 },
      { x: x0, z: z0 },
      { x: A / 2, z: z0 },
      { x: A / 2, z: z0 + W },
      { x: x0 + W, z: z0 + W },
      { x: x0 + W, z: L / 2 },
    ];
    const flecha = [{ x: x0 + W / 2, z: L / 2 - 0.15 }, { x: x0 + W / 2, z: z0 + W / 2 }, ...flechaHacia({ x: x0 + W / 2, z: z0 + W / 2 }, { x: A / 2 - 0.15, z: z0 + W / 2 })];
    return { contorno, peldanos, flecha, pasos };
  }

  const W = anchoM;
  const L = largoM;
  const peldanos: [Point, Point][] = [];
  const pasos: Paso[] = [];
  for (let i = 0; i < n; i++) {
    pasos.push({ x: 0, z: L / 2 - ((i + 0.5) * L) / n, w: W, d: L / n, top: (i + 1) * h });
    if (i > 0) {
      const z = L / 2 - (i * L) / n;
      peldanos.push([{ x: -W / 2, z }, { x: W / 2, z }]);
    }
  }
  return {
    contorno: [{ x: -W / 2, z: L / 2 }, { x: -W / 2, z: -L / 2 }, { x: W / 2, z: -L / 2 }, { x: W / 2, z: L / 2 }],
    peldanos,
    flecha: flechaHacia({ x: 0, z: L / 2 - 0.15 }, { x: 0, z: -L / 2 + 0.15 }),
    pasos,
  };
}
