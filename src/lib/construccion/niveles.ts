import type { Abertura, Habitacion, Nivel, Objeto, Proyecto } from "./types";

export const NIVEL_BASE_NOMBRE = "Planta baja";
/** Espesor de la losa entre pisos (m): suma a la altura de cada nivel para saber a qué altura queda el siguiente. */
export const LOSA_M = 0.15;
const ALTURA_DEFAULT_M = 2.5;

export function crearNivel(nombre: string): Nivel {
  return { id: crypto.randomUUID(), nombre };
}

/** Nombre que se propone para el siguiente nivel: Planta alta, Nivel 3, Nivel 4… */
export function nombreNivelSugerido(niveles: Nivel[]): string {
  if (niveles.length === 0) return NIVEL_BASE_NOMBRE;
  if (niveles.length === 1) return "Planta alta";
  return `Nivel ${niveles.length + 1}`;
}

type ProyectoSinNiveles = Omit<Proyecto, "niveles" | "habitaciones" | "objetos"> & {
  niveles?: Nivel[];
  habitaciones: (Omit<Habitacion, "nivelId"> & { nivelId?: string | null })[];
  objetos: (Omit<Objeto, "nivelId"> & { nivelId?: string | null })[];
};

/**
 * Deja el proyecto en un estado coherente: siempre hay al menos un nivel, y todo cuarto y objeto apunta a
 * uno que existe. Es lo que permite abrir proyectos viejos (guardados antes de que existieran los niveles):
 * se les crea una "Planta baja" y todo cae ahí. No toca nada si ya está en orden (devuelve el mismo objeto).
 */
export function normalizarNiveles(p: ProyectoSinNiveles): Proyecto {
  const niveles = p.niveles && p.niveles.length > 0 ? p.niveles : [crearNivel(NIVEL_BASE_NOMBRE)];
  const ids = new Set(niveles.map((n) => n.id));
  const base = niveles[0].id;
  const fix = (nivelId: string | null | undefined) => (nivelId && ids.has(nivelId) ? nivelId : base);

  const habOk = p.habitaciones.every((h) => h.nivelId && ids.has(h.nivelId));
  const objOk = p.objetos.every((o) => o.nivelId && ids.has(o.nivelId));
  if (p.niveles === niveles && habOk && objOk) return p as Proyecto;

  return {
    ...p,
    niveles,
    habitaciones: p.habitaciones.map((h) => (h.nivelId && ids.has(h.nivelId) ? (h as Habitacion) : { ...h, nivelId: fix(h.nivelId) })),
    objetos: p.objetos.map((o) => (o.nivelId && ids.has(o.nivelId) ? (o as Objeto) : { ...o, nivelId: fix(o.nivelId) })),
  };
}

/** Altura (m) a la que queda el piso de cada nivel: 0 para el primero; después, suma de alturas + losas. */
export function elevacionesPorNivel(p: Pick<Proyecto, "niveles" | "habitaciones">): Record<string, number> {
  const out: Record<string, number> = {};
  let acumulada = 0;
  for (const nivel of p.niveles) {
    out[nivel.id] = acumulada;
    const alturas = p.habitaciones.filter((h) => h.nivelId === nivel.id && h.puntos.length >= 3).map((h) => h.alturaM);
    acumulada += (alturas.length > 0 ? Math.max(...alturas) : ALTURA_DEFAULT_M) + LOSA_M;
  }
  return out;
}

/** Copia las habitaciones de un nivel a uno nuevo (misma planta, ids nuevos) — para pisos que repiten los muros del de abajo. */
export function duplicarNivel(
  p: Proyecto,
  nivelId: string,
  opciones: { incluirObjetos?: boolean } = {},
): { proyecto: Proyecto; nivelNuevoId: string } {
  const origen = p.niveles.find((n) => n.id === nivelId);
  const nuevo = crearNivel(origen ? `${origen.nombre} (copia)` : nombreNivelSugerido(p.niveles));
  const idxOrigen = p.niveles.findIndex((n) => n.id === nivelId);

  const mapaHab = new Map<string, string>();
  const habitaciones: Habitacion[] = p.habitaciones
    .filter((h) => h.nivelId === nivelId)
    .map((h) => {
      const id = crypto.randomUUID();
      mapaHab.set(h.id, id);
      const aberturas: Abertura[] = h.aberturas.map((a) => ({ ...a, id: crypto.randomUUID() }));
      return { ...h, id, nivelId: nuevo.id, puntos: h.puntos.map((pt) => ({ ...pt })), aberturas };
    });
  const objetos: Objeto[] = opciones.incluirObjetos
    ? p.objetos
        .filter((o) => o.nivelId === nivelId)
        .map((o) => ({ ...o, id: crypto.randomUUID(), nivelId: nuevo.id, habitacionId: o.habitacionId ? (mapaHab.get(o.habitacionId) ?? null) : null }))
    : [];

  // El nivel nuevo va justo encima del copiado.
  const niveles = [...p.niveles.slice(0, idxOrigen + 1), nuevo, ...p.niveles.slice(idxOrigen + 1)];
  return { proyecto: { ...p, niveles, habitaciones: [...p.habitaciones, ...habitaciones], objetos: [...p.objetos, ...objetos] }, nivelNuevoId: nuevo.id };
}

/** Quita un nivel con sus cuartos y objetos. Nunca deja el proyecto sin niveles (si es el único, no hace nada). */
export function quitarNivel(p: Proyecto, nivelId: string): Proyecto {
  if (p.niveles.length <= 1 || !p.niveles.some((n) => n.id === nivelId)) return p;
  return {
    ...p,
    niveles: p.niveles.filter((n) => n.id !== nivelId),
    habitaciones: p.habitaciones.filter((h) => h.nivelId !== nivelId),
    objetos: p.objetos.filter((o) => o.nivelId !== nivelId),
  };
}
