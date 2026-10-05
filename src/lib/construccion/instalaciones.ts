// Instalaciones (contactos, apagadores, luminarias, salidas de agua/gas, datos, clima, seguridad):
// se pegan al muro más cercano al colocarlas y se cuentan para el presupuesto.
import { pointInPolygon, projectPointOnSegment, wallSegmentsFromPolygon, type Point } from "./geometry";
import { FAMILIAS_INSTALACION, objetoDef } from "./objetos";
import type { Habitacion, Objeto } from "./types";

/**
 * Pega un punto al muro más cercano (dentro de `tol` m) por el lado de adentro de su zona: devuelve dónde queda
 * y el giro para que el frente de la pieza mire hacia el interior de la zona.
 */
export function pegarAPared(habs: Habitacion[], p: Point, tol: number): { x: number; z: number; rotDeg: number; habId: string } | null {
  let mejor: { d: number; x: number; z: number; rotDeg: number; habId: string } | null = null;
  for (const h of habs) {
    if (h.puntos.length < 3 || h.tipo === "terreno") continue;
    for (const seg of wallSegmentsFromPolygon(h.puntos)) {
      if (seg.length < 0.2) continue;
      const hit = projectPointOnSegment(p, seg);
      if (hit.distance > tol || (mejor && hit.distance >= mejor.d)) continue;
      let nx = -Math.sin(seg.angle);
      let nz = Math.cos(seg.angle);
      if (!pointInPolygon({ x: hit.point.x + nx * 0.12, z: hit.point.z + nz * 0.12 }, h.puntos)) {
        nx = -nx;
        nz = -nz;
      }
      // Sobre la cara interior del muro (mitad del espesor de 15 cm).
      mejor = { d: hit.distance, x: Math.round((hit.point.x + nx * 0.075) * 1e3) / 1e3, z: Math.round((hit.point.z + nz * 0.075) * 1e3) / 1e3, rotDeg: Math.round((Math.atan2(-nx, nz) * 180) / Math.PI), habId: h.id };
    }
  }
  return mejor && { x: mejor.x, z: mejor.z, rotDeg: mejor.rotDeg, habId: mejor.habId };
}

// ── Precios por pieza que el usuario ajusta (por navegador) ──
const CLAVE = "construccion:precios-instalaciones";
export function leerPreciosInstalaciones(): Record<string, number> {
  try {
    return JSON.parse(window.localStorage.getItem(CLAVE) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
}
export function guardarPrecioInstalacion(id: string, precio: number | null) {
  const actual = leerPreciosInstalaciones();
  if (precio === null) delete actual[id];
  else actual[id] = precio;
  try {
    window.localStorage.setItem(CLAVE, JSON.stringify(actual));
  } catch {
    /* sin almacenamiento */
  }
}

export type FilaInstalacion = { id: string; nombre: string; familia: string; familiaNombre: string; cantidad: number; precio: number; subtotal: number };

/** Cuenta las instalaciones colocadas, por tipo, con su costo (precio de referencia o el que el usuario puso). */
export function resumenInstalaciones(objetos: Objeto[], precios: Record<string, number> = leerPreciosInstalaciones()): FilaInstalacion[] {
  const mapa = new Map<string, FilaInstalacion>();
  for (const o of objetos) {
    const def = objetoDef(o.tipo);
    if (!def?.instalacion) continue;
    const fila = mapa.get(def.id) ?? {
      id: def.id,
      nombre: def.nombre,
      familia: def.instalacion.familia,
      familiaNombre: FAMILIAS_INSTALACION[def.instalacion.familia]?.nombre ?? def.instalacion.familia,
      cantidad: 0,
      precio: precios[def.id] ?? def.instalacion.precio,
      subtotal: 0,
    };
    fila.cantidad += 1;
    mapa.set(def.id, fila);
  }
  for (const f of mapa.values()) f.subtotal = f.cantidad * f.precio;
  return [...mapa.values()].sort((a, b) => a.familia.localeCompare(b.familia) || b.subtotal - a.subtotal);
}

export const totalInstalaciones = (filas: FilaInstalacion[]) => filas.reduce((s, f) => s + f.subtotal, 0);
