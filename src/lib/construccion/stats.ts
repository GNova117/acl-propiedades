import { areaAberturas, areaMurosBruta } from "./budget";
import { polygonArea, polygonPerimeter } from "./geometry";
import type { Habitacion, Nivel, Objeto, Proyecto } from "./types";

/** Una habitación "Exterior" (jardín, alberca, patio) no cuenta como superficie construida. */
export const esAreaExterior = (h: Habitacion) => h.tipo === "exterior";

export type EstadisticasHabitacion = {
  areaM2: number;
  perimetroM: number;
  alturaM: number;
  /** Área × altura. */
  volumenM3: number;
  /** Muros sin descontar puertas ni ventanas. */
  murosBrutosM2: number;
  /** Superficie de puertas y ventanas. */
  aberturasM2: number;
  murosNetosM2: number;
  /** Largo de zócalo: perímetro menos lo que ocupan las puertas. */
  zocaloM: number;
  puertas: number;
  ventanas: number;
  objetos: number;
};

export function estadisticasHabitacion(h: Habitacion, objetos: Objeto[] = []): EstadisticasHabitacion {
  const areaM2 = polygonArea(h.puntos);
  const perimetroM = polygonPerimeter(h.puntos);
  const murosBrutosM2 = areaMurosBruta(h);
  const aberturasM2 = areaAberturas(h);
  const anchoPuertas = h.aberturas.filter((a) => a.tipo === "puerta").reduce((sum, a) => sum + a.anchoM, 0);
  return {
    areaM2,
    perimetroM,
    alturaM: h.alturaM,
    volumenM3: areaM2 * h.alturaM,
    murosBrutosM2,
    aberturasM2,
    murosNetosM2: Math.max(0, murosBrutosM2 - aberturasM2),
    zocaloM: Math.max(0, perimetroM - anchoPuertas),
    puertas: h.aberturas.filter((a) => a.tipo === "puerta").length,
    ventanas: h.aberturas.filter((a) => a.tipo === "ventana").length,
    objetos: objetos.filter((o) => o.habitacionId === h.id).length,
  };
}

export type EstadisticasNivel = {
  nivel: Nivel;
  habitaciones: number;
  /** Superficie construida: todo menos las áreas exteriores. */
  construidaM2: number;
  exteriorM2: number;
  volumenM3: number;
  puertas: number;
  ventanas: number;
};

export type EstadisticasProyecto = {
  niveles: EstadisticasNivel[];
  construidaM2: number;
  exteriorM2: number;
  volumenM3: number;
};

export function estadisticasProyecto(p: Pick<Proyecto, "niveles" | "habitaciones" | "objetos">): EstadisticasProyecto {
  const niveles = p.niveles.map((nivel): EstadisticasNivel => {
    const habs = p.habitaciones.filter((h) => h.nivelId === nivel.id);
    let construidaM2 = 0;
    let exteriorM2 = 0;
    let volumenM3 = 0;
    let puertas = 0;
    let ventanas = 0;
    for (const h of habs) {
      const e = estadisticasHabitacion(h, p.objetos);
      if (esAreaExterior(h)) exteriorM2 += e.areaM2;
      else {
        construidaM2 += e.areaM2;
        volumenM3 += e.volumenM3;
      }
      puertas += e.puertas;
      ventanas += e.ventanas;
    }
    return { nivel, habitaciones: habs.length, construidaM2, exteriorM2, volumenM3, puertas, ventanas };
  });
  return {
    niveles,
    construidaM2: niveles.reduce((s, n) => s + n.construidaM2, 0),
    exteriorM2: niveles.reduce((s, n) => s + n.exteriorM2, 0),
    volumenM3: niveles.reduce((s, n) => s + n.volumenM3, 0),
  };
}
