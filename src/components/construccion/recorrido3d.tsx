// Recorrido en primera persona: caminar dentro del modelo con WASD / flechas y mirar arrastrando el mouse.
// Las paredes bloquean el paso (las puertas y arcos no), y las escaleras que unen niveles se suben de verdad.
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { wallSegmentsFromPolygon } from "../../lib/construccion/geometry";
import { geometriaEscalera } from "../../lib/construccion/escaleras";
import { objetoDef } from "../../lib/construccion/objetos";
import { esTipoExterior } from "../../lib/construccion/stats";
import type { ConexionEscalera } from "../../lib/construccion/conexiones";
import type { Habitacion, Objeto } from "../../lib/construccion/types";

const ALTURA_OJOS_M = 1.6;
const RADIO_M = 0.25;
const VELOCIDAD = 2.2;

type Tope = { ax: number; az: number; bx: number; bz: number };

type Props = {
  habitaciones: Habitacion[];
  objetos: Objeto[];
  conexiones: ConexionEscalera[];
  elevacion: (nivelId: string) => number;
  inicio: { x: number; z: number; nivelId: string };
};

function distanciaASegmento(px: number, pz: number, s: Tope): number {
  const dx = s.bx - s.ax;
  const dz = s.bz - s.az;
  const l2 = dx * dx + dz * dz;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - s.ax) * dx + (pz - s.az) * dz) / l2));
  return Math.hypot(px - (s.ax + t * dx), pz - (s.az + t * dz));
}

/** Tramos de pared que bloquean el paso: todo el muro menos el ancho de las puertas, arcos y portones. */
function topesDeNivel(habs: Habitacion[]): Tope[] {
  const out: Tope[] = [];
  for (const h of habs) {
    if (h.puntos.length < 3 || h.tipo === "terreno" || esTipoExterior(h.tipo)) continue;
    wallSegmentsFromPolygon(h.puntos).forEach((seg, i) => {
      if (seg.length < 0.01) return;
      const ux = (seg.end.x - seg.start.x) / seg.length;
      const uz = (seg.end.z - seg.start.z) / seg.length;
      const pasos = h.aberturas
        .filter((a) => a.segmentIndex === i && a.tipo === "puerta")
        .map((a) => [Math.max(0, a.offsetM - a.anchoM / 2), Math.min(seg.length, a.offsetM + a.anchoM / 2)] as const)
        .sort((p, q) => p[0] - q[0]);
      let cursor = 0;
      const tramo = (t0: number, t1: number) => {
        if (t1 - t0 > 0.01) out.push({ ax: seg.start.x + ux * t0, az: seg.start.z + uz * t0, bx: seg.start.x + ux * t1, bz: seg.start.z + uz * t1 });
      };
      for (const [a, b] of pasos) {
        tramo(cursor, a);
        cursor = Math.max(cursor, b);
      }
      tramo(cursor, seg.length);
    });
  }
  return out;
}

export default function Caminante({ habitaciones, objetos, conexiones, elevacion, inicio }: Props) {
  const { camera, gl } = useThree();
  const teclas = useRef(new Set<string>());
  const estado = useRef({ x: inicio.x, z: inicio.z, y: elevacion(inicio.nivelId), yaw: 0, pitch: 0, piso: inicio.nivelId });

  const nivelIds = useMemo(() => [...new Set(habitaciones.map((h) => h.nivelId))], [habitaciones]);
  const topes = useMemo(() => {
    const m = new Map<string, Tope[]>();
    for (const id of nivelIds) m.set(id, topesDeNivel(habitaciones.filter((h) => h.nivelId === id)));
    return m;
  }, [habitaciones, nivelIds]);

  // Peldaños de cada escalera conectada, para saber a qué altura queda el piso bajo los pies.
  const escaleras = useMemo(
    () =>
      conexiones.flatMap((c) => {
        const o = objetos.find((x) => x.id === c.objetoId);
        const def = o ? objetoDef(o.tipo) : undefined;
        if (!o || !def?.tipoEspecial) return [];
        return [{ c, o, pasos: geometriaEscalera(def.tipoEspecial, o.anchoM, o.largoM, c.riseM).pasos }];
      }),
    [conexiones, objetos],
  );

  useEffect(() => {
    camera.rotation.reorder("YXZ");
    const enCampo = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      return !!t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA");
    };
    const down = (e: KeyboardEvent) => {
      if (enCampo(e)) return;
      const k = e.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", "shift"].includes(k)) {
        teclas.current.add(k);
        if (k.startsWith("arrow")) e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => teclas.current.delete(e.key.toLowerCase());
    let arrastrando = false;
    const pd = (e: PointerEvent) => {
      arrastrando = true;
      gl.domElement.setPointerCapture(e.pointerId);
    };
    const pm = (e: PointerEvent) => {
      if (!arrastrando) return;
      estado.current.yaw -= e.movementX * 0.004;
      estado.current.pitch = Math.max(-1.2, Math.min(1.2, estado.current.pitch - e.movementY * 0.004));
    };
    const pu = () => (arrastrando = false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    gl.domElement.addEventListener("pointerdown", pd);
    gl.domElement.addEventListener("pointermove", pm);
    gl.domElement.addEventListener("pointerup", pu);
    gl.domElement.addEventListener("pointerleave", pu);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      gl.domElement.removeEventListener("pointerdown", pd);
      gl.domElement.removeEventListener("pointermove", pm);
      gl.domElement.removeEventListener("pointerup", pu);
      gl.domElement.removeEventListener("pointerleave", pu);
    };
  }, [camera, gl]);

  useFrame((_, delta) => {
    const s = estado.current;
    const k = teclas.current;
    const dt = Math.min(delta, 0.05);
    const avance = (k.has("w") || k.has("arrowup") ? 1 : 0) - (k.has("s") || k.has("arrowdown") ? 1 : 0);
    const lado = (k.has("d") ? 1 : 0) - (k.has("a") ? 1 : 0);
    const giro = (k.has("arrowleft") ? 1 : 0) - (k.has("arrowright") ? 1 : 0);
    s.yaw += giro * 1.8 * dt;
    if (avance !== 0 || lado !== 0) {
      const v = VELOCIDAD * (k.has("shift") ? 2 : 1) * dt;
      const dx = -Math.sin(s.yaw) * avance * v + Math.cos(s.yaw) * lado * v;
      const dz = -Math.cos(s.yaw) * avance * v - Math.sin(s.yaw) * lado * v;
      const lista = topes.get(s.piso) ?? [];
      const libre = (x: number, z: number) => lista.every((t) => distanciaASegmento(x, z, t) >= RADIO_M);
      // Se intenta el paso completo y, si choca, se desliza por cada eje por separado.
      if (libre(s.x + dx, s.z + dz)) {
        s.x += dx;
        s.z += dz;
      } else if (libre(s.x + dx, s.z)) s.x += dx;
      else if (libre(s.x, s.z + dz)) s.z += dz;
    }

    // Altura del piso bajo los pies: la de un peldaño si se está sobre una escalera; si no, la del nivel más cercano.
    let objetivo: number | null = null;
    for (const e of escaleras) {
      const a = (-e.o.rotDeg * Math.PI) / 180;
      const dx = s.x - e.o.x;
      const dz = s.z - e.o.z;
      const lx = dx * Math.cos(a) - dz * Math.sin(a);
      const lz = dx * Math.sin(a) + dz * Math.cos(a);
      let mejor: { d: number; top: number } | null = null;
      for (const p of e.pasos) {
        const reach = Math.max(p.w, p.d) / 2;
        const d = Math.hypot(lx - p.x, lz - p.z);
        if (d < reach && (!mejor || d < mejor.d)) mejor = { d, top: p.top };
      }
      if (mejor) {
        objetivo = elevacion(e.c.nivelOrigenId) + mejor.top;
        break;
      }
    }
    if (objetivo === null) {
      let cerca = nivelIds[0];
      for (const id of nivelIds) if (Math.abs(elevacion(id) - s.y) < Math.abs(elevacion(cerca) - s.y)) cerca = id;
      objetivo = elevacion(cerca);
    }
    s.y += (objetivo - s.y) * Math.min(1, dt * 10);
    let mas = nivelIds[0];
    for (const id of nivelIds) if (Math.abs(elevacion(id) - s.y) < Math.abs(elevacion(mas) - s.y)) mas = id;
    s.piso = mas;

    camera.position.set(s.x, s.y + ALTURA_OJOS_M, s.z);
    camera.rotation.set(s.pitch, s.yaw, 0);
  });

  return null;
}
