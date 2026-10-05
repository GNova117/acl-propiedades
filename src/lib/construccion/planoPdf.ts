// Trazos del plano esquemático de la ficha PDF, en metros del plano: muros con sus puertas y ventanas, escaleras,
// el lote, el nombre y área de cada zona, la medida de cada muro y las cotas generales del edificio. Aquí solo se
// calcula la geometría; fichaPdf.ts la pasa a la página.
import { pointInPolygon, polygonArea, polygonBounds, wallSegmentsFromPolygon, type Point, type WallSegment } from "./geometry";
import { estiloDe } from "./estilosAbertura";
import { geometriaEscalera } from "./escaleras";
import { objetoDef } from "./objetos";
import { esAreaExterior } from "./stats";
import type { Habitacion, Objeto } from "./types";

export type ColorTrazo = "negro" | "gris" | "azul" | "cafe" | "blanco";
export type Trazo =
  | { tipo: "linea"; a: Point; b: Point; grosor: number; color: ColorTrazo; punteada?: boolean }
  | { tipo: "texto"; p: Point; texto: string; tam: number; color: ColorTrazo; /** Ángulo en el plano (rad, z hacia abajo). */ angulo: number };

const MIN_COTA_M = 0.8;

function interiorDe(h: Habitacion, seg: WallSegment): Point {
  let nx = -Math.sin(seg.angle);
  let nz = Math.cos(seg.angle);
  if (!pointInPolygon({ x: seg.center.x + nx * 0.12, z: seg.center.z + nz * 0.12 }, h.puntos)) {
    nx = -nx;
    nz = -nz;
  }
  return { x: nx, z: nz };
}

/** Ángulo para que un texto quede siempre legible (nunca de cabeza). */
function anguloLegible(a: number): number {
  let x = a;
  while (x > Math.PI / 2) x -= Math.PI;
  while (x <= -Math.PI / 2) x += Math.PI;
  return x;
}

export function trazosDePlano(habs: Habitacion[], objetos: Objeto[]): { trazos: Trazo[]; puntos: Point[] } {
  const trazos: Trazo[] = [];
  const puntos: Point[] = [];
  const lineas = (pts: Point[], color: ColorTrazo, grosor: number, cerrar = false, punteada = false) => {
    for (let i = 0; i + 1 < pts.length + (cerrar ? 1 : 0); i++) trazos.push({ tipo: "linea", a: pts[i], b: pts[(i + 1) % pts.length], grosor, color, punteada });
  };

  const cerradas = habs.filter((h) => h.puntos.length >= 3);
  const terrenos = cerradas.filter((h) => h.tipo === "terreno");
  const zonas = cerradas.filter((h) => h.tipo !== "terreno");

  for (const t of terrenos) {
    lineas(t.puntos, "gris", 0.9, true, true);
    puntos.push(...t.puntos);
    const b = polygonBounds(t.puntos);
    trazos.push({ tipo: "texto", p: { x: b.minX + (b.maxX - b.minX) / 2, z: b.maxZ - 0.3 }, texto: `${t.nombre} - ${polygonArea(t.puntos).toFixed(1)} m2`, tam: 6.5, color: "gris", angulo: 0 });
  }

  const vistos = new Set<string>();
  const redondo = (v: number) => Math.round(v * 50) / 50;
  for (const h of zonas) {
    puntos.push(...h.puntos);
    const exterior = esAreaExterior(h);
    const segs = wallSegmentsFromPolygon(h.puntos);
    for (const seg of segs) trazos.push({ tipo: "linea", a: seg.start, b: seg.end, grosor: exterior ? 0.7 : 1.4, color: exterior ? "gris" : "negro", punteada: exterior });

    // Puertas y ventanas.
    for (const ab of h.aberturas) {
      const seg = segs[ab.segmentIndex];
      if (!seg || seg.length === 0 || exterior) continue;
      const ux = (seg.end.x - seg.start.x) / seg.length;
      const uz = (seg.end.z - seg.start.z) / seg.length;
      const n = interiorDe(h, seg);
      const at = (t: number, off = 0): Point => ({ x: seg.start.x + ux * t + n.x * off, z: seg.start.z + uz * t + n.z * off });
      const t0 = Math.max(0, ab.offsetM - ab.anchoM / 2);
      const t1 = Math.min(seg.length, ab.offsetM + ab.anchoM / 2);
      trazos.push({ tipo: "linea", a: at(t0), b: at(t1), grosor: 3.4, color: "blanco" });
      const estilo = estiloDe(ab);
      if (ab.tipo === "ventana") {
        for (const off of [-0.05, 0, 0.05]) trazos.push({ tipo: "linea", a: at(t0, off), b: at(t1, off), grosor: off === 0 ? 0.9 : 0.5, color: "azul" });
        continue;
      }
      if (estilo === "arco") {
        trazos.push({ tipo: "linea", a: at(t0), b: at(t1), grosor: 0.5, color: "cafe", punteada: true });
        continue;
      }
      if (estilo === "corrediza" || estilo === "cochera") {
        trazos.push({ tipo: "linea", a: at(t0, -0.04), b: at((t0 + t1) / 2 + 0.05, -0.04), grosor: 1, color: "azul" });
        trazos.push({ tipo: "linea", a: at((t0 + t1) / 2 - 0.05, 0.04), b: at(t1, 0.04), grosor: 1, color: "azul" });
        continue;
      }
      // Hoja abierta 90° hacia el interior, con su arco de giro (doble hoja: una hoja por lado).
      const hoja = (hinge: number, largo: number, dir: 1 | -1) => {
        const bisagra = at(hinge);
        trazos.push({ tipo: "linea", a: bisagra, b: at(hinge, largo), grosor: 1, color: "cafe" });
        const pasos = 10;
        let previo = at(hinge + dir * largo);
        for (let i = 1; i <= pasos; i++) {
          const ang = (i / pasos) * (Math.PI / 2);
          const p: Point = { x: bisagra.x + ux * dir * largo * Math.cos(ang) + n.x * largo * Math.sin(ang), z: bisagra.z + uz * dir * largo * Math.cos(ang) + n.z * largo * Math.sin(ang) };
          trazos.push({ tipo: "linea", a: previo, b: p, grosor: 0.4, color: "cafe", punteada: true });
          previo = p;
        }
      };
      if (estilo === "doble") {
        hoja(t0, (t1 - t0) / 2, 1);
        hoja(t1, (t1 - t0) / 2, -1);
      } else hoja(t0, t1 - t0, 1);
    }

    // Medida de cada muro (una sola vez si dos zonas lo comparten), del lado de afuera de la zona.
    for (const seg of segs) {
      if (seg.length < MIN_COTA_M) continue;
      const a = `${redondo(seg.start.x)},${redondo(seg.start.z)}`;
      const b = `${redondo(seg.end.x)},${redondo(seg.end.z)}`;
      const k = a < b ? `${a}|${b}` : `${b}|${a}`;
      if (vistos.has(k)) continue;
      vistos.add(k);
      const dentro = interiorDe(h, seg);
      trazos.push({ tipo: "texto", p: { x: seg.center.x - dentro.x * 0.2, z: seg.center.z - dentro.z * 0.2 }, texto: seg.length.toFixed(2), tam: 5.5, color: "gris", angulo: anguloLegible(seg.angle) });
    }

    const b = polygonBounds(h.puntos);
    trazos.push({ tipo: "texto", p: { x: (b.minX + b.maxX) / 2, z: (b.minZ + b.maxZ) / 2 - 0.1 }, texto: h.nombre, tam: 7, color: "negro", angulo: 0 });
    trazos.push({ tipo: "texto", p: { x: (b.minX + b.maxX) / 2, z: (b.minZ + b.maxZ) / 2 + 0.25 }, texto: `${polygonArea(h.puntos).toFixed(1)} m2`, tam: 5.5, color: "gris", angulo: 0 });
  }

  // Escaleras: contorno y peldaños.
  const nivelDe = new Set(zonas.map((h) => h.nivelId));
  for (const o of objetos) {
    const def = objetoDef(o.tipo);
    if (!def?.tipoEspecial || !nivelDe.has(o.nivelId)) continue;
    const geo = geometriaEscalera(def.tipoEspecial, o.anchoM, o.largoM, def.altoM);
    const a = (o.rotDeg * Math.PI) / 180;
    const aMundo = (p: Point): Point => ({ x: o.x + p.x * Math.cos(a) - p.z * Math.sin(a), z: o.z + p.x * Math.sin(a) + p.z * Math.cos(a) });
    lineas(geo.contorno.map(aMundo), "cafe", 0.8, true);
    for (const [p, q] of geo.peldanos) trazos.push({ tipo: "linea", a: aMundo(p), b: aMundo(q), grosor: 0.35, color: "cafe" });
    lineas(geo.flecha.map(aMundo), "cafe", 0.6);
  }

  // Cotas generales del edificio: ancho arriba y largo a la izquierda.
  const base = zonas.length > 0 ? zonas : terrenos;
  if (base.length > 0) {
    const cajas = base.map((h) => polygonBounds(h.puntos));
    const minX = Math.min(...cajas.map((b) => b.minX));
    const maxX = Math.max(...cajas.map((b) => b.maxX));
    const minZ = Math.min(...cajas.map((b) => b.minZ));
    const maxZ = Math.max(...cajas.map((b) => b.maxZ));
    const zc = minZ - 0.55;
    const xc = minX - 0.55;
    const marca = (p: Point, q: Point) => trazos.push({ tipo: "linea", a: p, b: q, grosor: 0.5, color: "gris" });
    marca({ x: minX, z: zc }, { x: maxX, z: zc });
    marca({ x: minX, z: zc - 0.1 }, { x: minX, z: zc + 0.1 });
    marca({ x: maxX, z: zc - 0.1 }, { x: maxX, z: zc + 0.1 });
    trazos.push({ tipo: "texto", p: { x: (minX + maxX) / 2, z: zc - 0.2 }, texto: `${(maxX - minX).toFixed(2)} m`, tam: 6.5, color: "negro", angulo: 0 });
    marca({ x: xc, z: minZ }, { x: xc, z: maxZ });
    marca({ x: xc - 0.1, z: minZ }, { x: xc + 0.1, z: minZ });
    marca({ x: xc - 0.1, z: maxZ }, { x: xc + 0.1, z: maxZ });
    trazos.push({ tipo: "texto", p: { x: xc - 0.2, z: (minZ + maxZ) / 2 }, texto: `${(maxZ - minZ).toFixed(2)} m`, tam: 6.5, color: "negro", angulo: -Math.PI / 2 });
    puntos.push({ x: xc - 0.3, z: zc - 0.3 });
  }
  return { trazos, puntos };
}
