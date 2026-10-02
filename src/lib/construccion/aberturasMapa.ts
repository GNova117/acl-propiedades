// Puertas y ventanas puestas desde "Plano completo": un clic sobre cualquier muro de cualquier zona.
// Si el muro se comparte con otra zona, la abertura se pone también del otro lado (en la misma posición
// absoluta), para que una puerta entre dos zonas sea puerta en las dos.
import { clampOpeningsToWalls, projectPointOnSegment, wallSegmentsFromPolygon, type Point } from "./geometry";
import { ABERTURA_DEFAULTS, type Abertura, type Habitacion, type Proyecto, type TipoAbertura } from "./types";

const MISMO_LUGAR_M = 0.06;
export const ANCHO_DEFECTO_M: Record<TipoAbertura, number> = { puerta: 0.9, ventana: 1.2 };

export type MuroCercano = { hab: Habitacion; segmentIndex: number; offsetM: number; length: number; point: Point };

/** El muro (de cualquier zona de `habs`) más cercano a `p`, si está a menos de `tol` metros. */
export function muroCercano(habs: Habitacion[], p: Point, tol: number): MuroCercano | null {
  let mejor: (MuroCercano & { d: number }) | null = null;
  for (const hab of habs) {
    wallSegmentsFromPolygon(hab.puntos).forEach((seg, segmentIndex) => {
      if (seg.length < 0.05) return;
      const hit = projectPointOnSegment(p, seg);
      if (hit.distance <= tol && (!mejor || hit.distance < mejor.d)) {
        mejor = { hab, segmentIndex, offsetM: hit.t * seg.length, length: seg.length, point: hit.point, d: hit.distance };
      }
    });
  }
  return mejor;
}

/** Centro de una abertura en coordenadas del plano. */
export function centroAbertura(hab: Habitacion, ab: Abertura): Point | null {
  const seg = wallSegmentsFromPolygon(hab.puntos)[ab.segmentIndex];
  if (!seg || seg.length === 0) return null;
  const f = ab.offsetM / seg.length;
  return { x: seg.start.x + (seg.end.x - seg.start.x) * f, z: seg.start.z + (seg.end.z - seg.start.z) * f };
}

/** La abertura de otra zona del mismo nivel que está en el mismo lugar (el otro lado de la misma puerta). */
export function espejoDe(habs: Habitacion[], habId: string, abId: string): { hab: Habitacion; ab: Abertura } | null {
  const hab = habs.find((h) => h.id === habId);
  const ab = hab?.aberturas.find((a) => a.id === abId);
  if (!hab || !ab) return null;
  const c = centroAbertura(hab, ab);
  if (!c) return null;
  for (const otra of habs) {
    if (otra.id === habId || otra.nivelId !== hab.nivelId) continue;
    for (const a of otra.aberturas) {
      const c2 = centroAbertura(otra, a);
      if (c2 && Math.hypot(c.x - c2.x, c.z - c2.z) < MISMO_LUGAR_M) return { hab: otra, ab: a };
    }
  }
  return null;
}

const dentroDelMuro = (length: number, ancho: number, offset: number) => {
  const a = Math.min(ancho, Math.max(length - 0.2, 0.3));
  return { ancho: a, offset: Math.min(Math.max(offset, a / 2), Math.max(length - a / 2, a / 2)) };
};

/** Coloca `base` en `muro` de su zona y, si ese muro es compartido, el espejo del otro lado. */
function colocar(proyecto: Proyecto, habs: Habitacion[], muro: MuroCercano, base: Abertura): { proyecto: Proyecto; seleccion: { habId: string; id: string } } {
  const { ancho, offset } = dentroDelMuro(muro.length, base.anchoM, muro.offsetM);
  const nueva: Abertura = { ...base, segmentIndex: muro.segmentIndex, offsetM: offset, anchoM: ancho };
  const centro = centroAbertura(muro.hab, nueva);
  const agregadas = new Map<string, Abertura>([[muro.hab.id, nueva]]);
  if (centro) {
    for (const otra of habs) {
      if (otra.id === muro.hab.id) continue;
      wallSegmentsFromPolygon(otra.puntos).forEach((seg, i) => {
        if (agregadas.has(otra.id) || seg.length < 0.05) return;
        const hit = projectPointOnSegment(centro, seg);
        if (hit.distance > 0.02) return;
        // Solo hay "otro lado" si la abertura cabe entera en ese muro; si no, quedaría desfasada y huérfana.
        const pos = hit.t * seg.length;
        if (pos < ancho / 2 - 0.02 || pos > seg.length - ancho / 2 + 0.02) return;
        const d = dentroDelMuro(seg.length, ancho, pos);
        agregadas.set(otra.id, { ...nueva, id: crypto.randomUUID(), segmentIndex: i, offsetM: d.offset, anchoM: d.ancho });
      });
    }
  }
  return {
    seleccion: { habId: muro.hab.id, id: nueva.id },
    proyecto: {
      ...proyecto,
      habitaciones: proyecto.habitaciones.map((h) => {
        const ab = agregadas.get(h.id);
        return ab ? { ...h, aberturas: [...h.aberturas, ab] } : h;
      }),
    },
  };
}

/** Pone una puerta o ventana en el muro más cercano a `p` (y del otro lado, si ese muro es compartido). */
export function agregarAberturaEnMapa(
  proyecto: Proyecto,
  nivelId: string,
  p: Point,
  tipo: TipoAbertura,
  tol: number,
): { proyecto: Proyecto; seleccion: { habId: string; id: string } } | null {
  const habs = proyecto.habitaciones.filter((h) => h.nivelId === nivelId && h.puntos.length >= 3);
  const muro = muroCercano(habs, p, tol);
  if (!muro) return null;
  const base: Abertura = { id: crypto.randomUUID(), segmentIndex: 0, tipo, offsetM: 0, anchoM: ANCHO_DEFECTO_M[tipo], ...ABERTURA_DEFAULTS[tipo] };
  return colocar(proyecto, habs, muro, base);
}

/**
 * Arrastra una abertura ya puesta: se pega al muro más cercano al puntero (puede cambiar de muro o de zona)
 * y, si el muro es compartido, el otro lado se mueve con ella. `soloHabId` limita los muros a los de esa zona
 * (en la vista de un cuarto, donde las demás no se ven). null si el puntero queda lejos de todo muro.
 */
export function moverAberturaEnMapa(
  proyecto: Proyecto,
  habId: string,
  abId: string,
  p: Point,
  tol: number,
  soloHabId?: string,
): { proyecto: Proyecto; seleccion: { habId: string; id: string } } | null {
  // La abertura puede haber cambiado de zona durante el arrastre: se busca por su id.
  const hab = proyecto.habitaciones.find((h) => h.aberturas.some((a) => a.id === abId)) ?? proyecto.habitaciones.find((h) => h.id === habId);
  const ab = hab?.aberturas.find((a) => a.id === abId);
  if (!hab || !ab) return null;
  const sinEllas = quitarAberturaEnMapa(proyecto, hab.id, abId);
  const habs = sinEllas.habitaciones.filter((h) => h.nivelId === hab.nivelId && h.puntos.length >= 3 && (!soloHabId || h.id === soloHabId));
  const muro = muroCercano(habs, p, tol);
  if (!muro) return null;
  return colocar(sinEllas, sinEllas.habitaciones.filter((h) => h.nivelId === hab.nivelId && h.puntos.length >= 3), muro, ab);
}

/** Cambia una abertura y su espejo (el otro lado de la misma puerta). */
export function actualizarAberturaEnMapa(proyecto: Proyecto, habId: string, abId: string, patch: Partial<Abertura>): Proyecto {
  const espejo = espejoDe(proyecto.habitaciones, habId, abId);
  const ids = new Set([abId, ...(espejo ? [espejo.ab.id] : [])]);
  return {
    ...proyecto,
    habitaciones: proyecto.habitaciones.map((h) => {
      if (!h.aberturas.some((a) => ids.has(a.id))) return h;
      // Cada lado conserva su posición propia; solo se comparten tipo, medidas y altura.
      const { segmentIndex: _s, offsetM: _o, id: _i, ...compartido } = patch;
      void _s;
      void _o;
      void _i;
      return { ...h, aberturas: clampOpeningsToWalls(h.puntos, h.aberturas.map((a) => (ids.has(a.id) ? { ...a, ...compartido } : a))) };
    }),
  };
}

export function quitarAberturaEnMapa(proyecto: Proyecto, habId: string, abId: string): Proyecto {
  const espejo = espejoDe(proyecto.habitaciones, habId, abId);
  const ids = new Set([abId, ...(espejo ? [espejo.ab.id] : [])]);
  return { ...proyecto, habitaciones: proyecto.habitaciones.map((h) => (h.aberturas.some((a) => ids.has(a.id)) ? { ...h, aberturas: h.aberturas.filter((a) => !ids.has(a.id)) } : h)) };
}
