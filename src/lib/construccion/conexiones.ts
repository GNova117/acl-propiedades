// Conexiones entre niveles: una escalera puesta en un nivel sube al siguiente. Del nivel de arriba sale el
// hueco (el piso se corta donde sube la escalera) y la escalera salva exactamente el desnivel entre pisos.
import { pointInPolygon, type Point } from "./geometry";
import { elevacionesPorNivel } from "./niveles";
import { geometriaEscalera, numeroDePeldanos } from "./escaleras";
import { objetoDef } from "./objetos";
import type { Objeto, Proyecto } from "./types";

export type ConexionEscalera = {
  objetoId: string;
  nivelOrigenId: string;
  nivelDestinoId: string;
  /** Desnivel que salva: de un piso al siguiente (altura del nivel + losa). */
  riseM: number;
  /** Huella completa de la escalera en el plano (coordenadas del plano). */
  huella: Point[];
  /** Parte de la huella que se corta en el piso de arriba (sin el último peldaño, que ya es el piso). */
  hueco: Point[];
};

function aMundo(o: Objeto, locales: Point[]): Point[] {
  const a = (o.rotDeg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return locales.map((p) => ({ x: Math.round((o.x + p.x * c - p.z * s) * 1e4) / 1e4, z: Math.round((o.z + p.x * s + p.z * c) * 1e4) / 1e4 }));
}

export function conexionesEscaleras(p: Pick<Proyecto, "niveles" | "habitaciones" | "objetos">): ConexionEscalera[] {
  const elev = elevacionesPorNivel(p);
  const out: ConexionEscalera[] = [];
  for (const o of p.objetos) {
    const def = objetoDef(o.tipo);
    if (!def?.tipoEspecial) continue;
    const i = p.niveles.findIndex((n) => n.id === o.nivelId);
    const destino = i >= 0 ? p.niveles[i + 1] : undefined;
    if (!destino) continue;
    const riseM = elev[destino.id] - elev[o.nivelId];
    const geo = geometriaEscalera(def.tipoEspecial, o.anchoM, o.largoM, riseM);
    let hueco = geo.contorno;
    if (def.tipoEspecial === "escalera_recta") {
      // La recta sube hacia −z local: el último peldaño (el de más arriba) ya queda a nivel del piso de arriba.
      const L = o.largoM;
      const W = o.anchoM;
      const corte = -L / 2 + L / numeroDePeldanos(riseM);
      hueco = [{ x: -W / 2, z: L / 2 }, { x: -W / 2, z: corte }, { x: W / 2, z: corte }, { x: W / 2, z: L / 2 }];
    }
    out.push({ objetoId: o.id, nivelOrigenId: o.nivelId, nivelDestinoId: destino.id, riseM, huella: aMundo(o, geo.contorno), hueco: aMundo(o, hueco) });
  }
  return out;
}

/** Texto de aviso si la escalera no encaja en el nivel de arriba; null si está bien. */
export function problemaDeConexion(c: ConexionEscalera, p: Pick<Proyecto, "habitaciones">): string | null {
  const arriba = p.habitaciones.filter((h) => h.nivelId === c.nivelDestinoId && h.puntos.length >= 3);
  if (arriba.length === 0) return "El nivel de arriba todavía no tiene zonas: dibújalas ahí para que el piso lleve el hueco de la escalera.";
  const cabe = arriba.some((h) => c.hueco.every((pt) => pointInPolygon(pt, h.puntos)));
  return cabe ? null : "El hueco queda fuera de las zonas del nivel de arriba (o a caballo entre dos): mueve la escalera o ajusta las zonas de arriba para que el hueco quede dentro de una sola.";
}
