import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import { snap, type Point } from "../../lib/construccion/geometry";

// Imán fino (5 cm): la exactitud real se logra tecleando las medidas; el imán solo evita los
// "casi" al arrastrar. (Antes los cuartos se dibujaban y movían con imán de 25 cm.)
export const ROOM_GRID_M = 0.05;
export const OBJ_GRID_M = 0.05;
export const VERTEX_GRID_M = 0.05;

export function svgPoint(svg: SVGSVGElement, clientX: number, clientY: number): Point {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const { x, y } = pt.matrixTransform(svg.getScreenCTM()!.inverse());
  return { x, z: y };
}

type Drag =
  | { kind: "objeto"; id: string; offX: number; offZ: number }
  | { kind: "vertice"; id: string; index: number }
  | { kind: "habitacion"; id: string; startX: number; startZ: number; appliedX: number; appliedZ: number }
  | { kind: "fondo"; startX: number; startZ: number; appliedX: number; appliedZ: number };

type Callbacks = {
  onObjetoMove: (id: string, center: Point) => void;
  /** Vértice `index` de la habitación `id` arrastrado a `p` (ya con imán de 5 cm; la alineación a ejes la pone quien recibe). */
  onVerticeMove?: (id: string, index: number, p: Point) => void;
  onHabitacionMove?: (id: string, dx: number, dz: number) => void;
  onHabitacionDrop?: (id: string) => void;
  onObjetoDrop?: (id: string) => void;
  /** Arrastrar la imagen de fondo (plano calcado) — sin imán: debe poder quedar exacta. */
  onFondoMove?: (dx: number, dz: number) => void;
  onFondoDrop?: () => void;
};

/**
 * Arrastre de objetos y habitaciones sobre un <svg> del plano. Los manejadores `pointer*` van en el
 * <svg>; `startObjeto`/`startHabitacion` en el elemento que se agarra. `consumeClick()` devuelve true
 * si el `click` que sigue a un arrastre/agarre debe ignorarse (no debe agregar puertas ni colocar nada).
 */
export function usePlanDrag(cb: Callbacks) {
  const dragRef = useRef<Drag | null>(null);
  const interacted = useRef(false);
  const cbRef = useRef(cb);
  cbRef.current = cb;

  function startObjeto(e: ReactPointerEvent<SVGElement>, id: string, center: Point) {
    const svg = e.currentTarget.ownerSVGElement;
    if (!svg) return;
    e.stopPropagation();
    interacted.current = true;
    const p = svgPoint(svg, e.clientX, e.clientY);
    dragRef.current = { kind: "objeto", id, offX: p.x - center.x, offZ: p.z - center.z };
  }

  function startVertice(e: ReactPointerEvent<SVGElement>, id: string, index: number) {
    e.stopPropagation();
    interacted.current = true;
    dragRef.current = { kind: "vertice", id, index };
  }

  function startHabitacion(e: ReactPointerEvent<SVGElement>, id: string) {
    const svg = e.currentTarget.ownerSVGElement;
    if (!svg) return;
    e.stopPropagation();
    interacted.current = true;
    const p = svgPoint(svg, e.clientX, e.clientY);
    dragRef.current = { kind: "habitacion", id, startX: p.x, startZ: p.z, appliedX: 0, appliedZ: 0 };
  }

  function startFondo(e: ReactPointerEvent<SVGElement>) {
    const svg = e.currentTarget.ownerSVGElement;
    if (!svg) return;
    e.stopPropagation();
    interacted.current = true;
    const p = svgPoint(svg, e.clientX, e.clientY);
    dragRef.current = { kind: "fondo", startX: p.x, startZ: p.z, appliedX: 0, appliedZ: 0 };
  }

  function onPointerMove(e: ReactPointerEvent<SVGSVGElement>) {
    const d = dragRef.current;
    if (!d) return;
    const p = svgPoint(e.currentTarget, e.clientX, e.clientY);
    if (d.kind === "objeto") {
      cbRef.current.onObjetoMove(d.id, { x: snap(p.x - d.offX, OBJ_GRID_M), z: snap(p.z - d.offZ, OBJ_GRID_M) });
    } else if (d.kind === "vertice") {
      cbRef.current.onVerticeMove?.(d.id, d.index, { x: snap(p.x, VERTEX_GRID_M), z: snap(p.z, VERTEX_GRID_M) });
    } else if (d.kind === "habitacion") {
      const dx = snap(p.x - d.startX, ROOM_GRID_M);
      const dz = snap(p.z - d.startZ, ROOM_GRID_M);
      if (dx !== d.appliedX || dz !== d.appliedZ) {
        cbRef.current.onHabitacionMove?.(d.id, dx - d.appliedX, dz - d.appliedZ);
        d.appliedX = dx;
        d.appliedZ = dz;
      }
    } else {
      const dx = p.x - d.startX;
      const dz = p.z - d.startZ;
      cbRef.current.onFondoMove?.(dx - d.appliedX, dz - d.appliedZ);
      d.appliedX = dx;
      d.appliedZ = dz;
    }
  }

  function end() {
    const d = dragRef.current;
    dragRef.current = null;
    if (d?.kind === "habitacion") cbRef.current.onHabitacionDrop?.(d.id);
    if (d?.kind === "objeto") cbRef.current.onObjetoDrop?.(d.id);
    if (d?.kind === "fondo") cbRef.current.onFondoDrop?.();
    // El `click` llega justo después del pointerup: se limpia hasta después de él.
    if (interacted.current) setTimeout(() => (interacted.current = false), 0);
  }

  function consumeClick(): boolean {
    if (!interacted.current) return false;
    interacted.current = false;
    return true;
  }

  return { startObjeto, startVertice, startHabitacion, startFondo, consumeClick, handlers: { onPointerMove, onPointerUp: end, onPointerLeave: end } };
}
