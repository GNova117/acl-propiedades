// Techos del edificio en 3D: una losa plana, o un techo de dos o cuatro aguas sobre todo el volumen cuando la
// planta es un rectángulo. Solo llevan techo las zonas que no tienen otra encima (el piso de arriba es su techo).
import { useMemo } from "react";
import { BufferGeometry, DoubleSide, ExtrudeGeometry, Float32BufferAttribute, Shape } from "three";
import { pointInPolygon, polygonArea, polygonBounds, type Point } from "../../lib/construccion/geometry";
import { acabadoDe, type FormaTecho } from "../../lib/construccion/acabados";
import { esTipoExterior } from "../../lib/construccion/stats";
import type { Habitacion } from "../../lib/construccion/types";

const LOSA_ESPESOR = 0.15;
const VOLADO_M = 0.35;
const PENDIENTE = 0.45;

export type TechoSpec = {
  key: string;
  forma: FormaTecho;
  color: string;
  /** Altura absoluta donde terminan los muros (arranque del techo). */
  y: number;
  caja?: { minX: number; maxX: number; minZ: number; maxZ: number };
  poligono?: Point[];
};

const centroide = (pts: Point[]): Point => ({ x: pts.reduce((s, p) => s + p.x, 0) / pts.length, z: pts.reduce((s, p) => s + p.z, 0) / pts.length });

/** Punto que seguro cae dentro de la zona (el centroide, o el de su primer triángulo si la zona es cóncava). */
function puntoInterior(h: Habitacion): Point {
  const c = centroide(h.puntos);
  if (pointInPolygon(c, h.puntos)) return c;
  const [a, b, d] = h.puntos;
  return { x: (a.x + b.x + d.x) / 3, z: (a.z + b.z + d.z) / 3 };
}

export function planearTechos(habs: Habitacion[], elevacion: (nivelId: string) => number): TechoSpec[] {
  const cerradas = habs.filter((h) => h.puntos.length >= 3 && h.tipo !== "terreno" && !esTipoExterior(h.tipo));
  // Solo las zonas sin nada encima.
  const arriba = (h: Habitacion) => cerradas.some((o) => elevacion(o.nivelId) > elevacion(h.nivelId) + 0.01 && pointInPolygon(puntoInterior(h), o.puntos));
  const descubiertas = cerradas.filter((h) => !arriba(h));

  const porNivel = new Map<string, Habitacion[]>();
  for (const h of descubiertas) porNivel.set(h.nivelId, [...(porNivel.get(h.nivelId) ?? []), h]);

  const out: TechoSpec[] = [];
  for (const [nivelId, grupo] of porNivel) {
    const cajas = grupo.map((h) => polygonBounds(h.puntos));
    const caja = { minX: Math.min(...cajas.map((b) => b.minX)), maxX: Math.max(...cajas.map((b) => b.maxX)), minZ: Math.min(...cajas.map((b) => b.minZ)), maxZ: Math.max(...cajas.map((b) => b.maxZ)) };
    const areaCaja = (caja.maxX - caja.minX) * (caja.maxZ - caja.minZ);
    const areaZonas = grupo.reduce((s, h) => s + polygonArea(h.puntos), 0);
    const y = elevacion(nivelId) + Math.max(...grupo.map((h) => h.alturaM));
    if (areaZonas >= areaCaja * 0.97) {
      // Planta rectangular: un solo techo sobre todo el volumen, con la forma que más zonas pidieron.
      const votos = new Map<string, number>();
      for (const h of grupo) votos.set(h.acabados?.techo ?? "losa", (votos.get(h.acabados?.techo ?? "losa") ?? 0) + 1);
      const elegido = [...votos.entries()].sort((a, b) => b[1] - a[1])[0][0];
      const a = acabadoDe("techo", elegido);
      out.push({ key: `n-${nivelId}`, forma: a?.forma ?? "plano", color: a?.color ?? "#a8a29e", y, caja });
    } else {
      // Planta irregular: cada zona con su losa (un techo inclinado sobre una forma en L no cierra bien).
      for (const h of grupo) {
        const a = acabadoDe("techo", h.acabados?.techo);
        if (a?.forma === "ninguno") continue;
        out.push({ key: h.id, forma: "plano", color: a?.color ?? "#a8a29e", y: elevacion(nivelId) + h.alturaM, poligono: h.puntos });
      }
    }
  }
  return out.filter((t) => t.forma !== "ninguno");
}

function geometriaInclinada(caja: NonNullable<TechoSpec["caja"]>, y0: number, cuatroAguas: boolean): BufferGeometry {
  const x0 = caja.minX - VOLADO_M;
  const x1 = caja.maxX + VOLADO_M;
  const z0 = caja.minZ - VOLADO_M;
  const z1 = caja.maxZ + VOLADO_M;
  const w = x1 - x0;
  const d = z1 - z0;
  const largoX = w >= d; // la cumbrera corre por el lado más largo
  const corto = Math.min(w, d);
  const alto = y0 + (corto / 2) * PENDIENTE;
  const mx = (x0 + x1) / 2;
  const mz = (z0 + z1) / 2;
  const inset = cuatroAguas ? corto / 2 : 0;
  const A: V = [x0, y0, z0], B: V = [x1, y0, z0], C: V = [x1, y0, z1], D: V = [x0, y0, z1];
  const R1: V = largoX ? [x0 + inset, alto, mz] : [mx, alto, z0 + inset];
  const R2: V = largoX ? [x1 - inset, alto, mz] : [mx, alto, z1 - inset];
  const tris: V[][] = largoX
    ? [[A, B, R2], [A, R2, R1], [D, C, R2], [D, R2, R1], [A, D, R1], [B, C, R2]]
    : [[A, D, R2], [A, R2, R1], [B, C, R2], [B, R2, R1], [A, B, R1], [D, C, R2]];
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(tris.flat(2), 3));
  g.computeVertexNormals();
  return g;
}
type V = [number, number, number];

export function Techo({ spec }: { spec: TechoSpec }) {
  const geometria = useMemo(() => {
    if (spec.forma === "plano" && spec.poligono) {
      const s = new Shape();
      s.moveTo(spec.poligono[0].x, spec.poligono[0].z);
      for (let i = 1; i < spec.poligono.length; i++) s.lineTo(spec.poligono[i].x, spec.poligono[i].z);
      s.closePath();
      return new ExtrudeGeometry(s, { depth: LOSA_ESPESOR, bevelEnabled: false });
    }
    if (spec.caja && spec.forma !== "plano") return geometriaInclinada(spec.caja, spec.y, spec.forma === "cuatro_aguas");
    return null;
  }, [spec]);

  if (spec.forma === "plano" && spec.caja) {
    const c = spec.caja;
    return (
      <mesh position={[(c.minX + c.maxX) / 2, spec.y + LOSA_ESPESOR / 2, (c.minZ + c.maxZ) / 2]}>
        <boxGeometry args={[c.maxX - c.minX + 0.3, LOSA_ESPESOR, c.maxZ - c.minZ + 0.3]} />
        <meshStandardMaterial color={spec.color} />
      </mesh>
    );
  }
  if (!geometria) return null;
  // La losa extruida sale hacia abajo desde y (rotación +90° en x): se sube su espesor para que apoye sobre los muros.
  const flat = spec.forma === "plano";
  return (
    <mesh geometry={geometria} position={[0, flat ? spec.y + LOSA_ESPESOR : 0, 0]} rotation={flat ? [Math.PI / 2, 0, 0] : [0, 0, 0]}>
      <meshStandardMaterial color={spec.color} side={DoubleSide} />
    </mesh>
  );
}
