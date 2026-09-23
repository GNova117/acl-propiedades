import { forwardRef } from "react";
import { polygonArea, snap, wallSegmentsFromPolygon, type Point } from "../../lib/construccion/geometry";
import { zonaDe } from "../../lib/construccion/objetos";
import type { Habitacion, Objeto } from "../../lib/construccion/types";
import ObjetosLayer from "./plan-objetos";
import { OBJ_GRID_M, svgPoint, type usePlanDrag } from "./plan-drag";

const BASE_W = 12;
const BASE_H = 9;
const WALL_THICKNESS_M = 0.15;

/** Tamaño del lienzo: crece en pasos (4:3) para que cuartos lejanos sigan cabiendo sin saltos al arrastrar. */
export function mapViewSize(habitaciones: Habitacion[], objetos: Objeto[]): { w: number; h: number } {
  let maxX = 0;
  let maxZ = 0;
  for (const h of habitaciones) {
    for (const p of h.puntos) {
      maxX = Math.max(maxX, p.x);
      maxZ = Math.max(maxZ, p.z);
    }
  }
  for (const o of objetos) {
    maxX = Math.max(maxX, o.x + Math.max(o.anchoM, o.largoM) / 2);
    maxZ = Math.max(maxZ, o.z + Math.max(o.anchoM, o.largoM) / 2);
  }
  const scale = Math.max(1, Math.ceil(((maxX + 2) / BASE_W) * 2) / 2, Math.ceil(((maxZ + 2) / BASE_H) * 2) / 2);
  return { w: BASE_W * scale, h: BASE_H * scale };
}

type Props = {
  habitaciones: Habitacion[];
  objetos: Objeto[];
  selectedId: string | null;
  selectedObjetoId: string | null;
  drag: ReturnType<typeof usePlanDrag>;
  placing: boolean;
  onPlace: (p: Point) => void;
  onSelectRoom: (id: string | null) => void;
  onSelectObjeto: (id: string | null) => void;
};

const PlanMap2D = forwardRef<SVGSVGElement, Props>(function PlanMap2D(
  { habitaciones, objetos, selectedId, selectedObjetoId, drag, placing, onPlace, onSelectRoom, onSelectObjeto },
  ref,
) {
  const { w, h } = mapViewSize(habitaciones, objetos);

  function handleClick(e: React.MouseEvent<SVGSVGElement>) {
    if (drag.consumeClick()) return;
    if (placing) {
      const raw = svgPoint(e.currentTarget, e.clientX, e.clientY);
      onPlace({ x: snap(raw.x, OBJ_GRID_M), z: snap(raw.z, OBJ_GRID_M) });
      return;
    }
    onSelectRoom(null);
    onSelectObjeto(null);
  }

  const grid = [];
  for (let x = 0; x <= w; x += 1) grid.push(<line key={`gx${x}`} x1={x} y1={0} x2={x} y2={h} stroke="#f4f4f5" strokeWidth={0.015} />);
  for (let z = 0; z <= h; z += 1) grid.push(<line key={`gz${z}`} x1={0} y1={z} x2={w} y2={z} stroke="#f4f4f5" strokeWidth={0.015} />);

  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${w} ${h}`}
      className="construccion-plan-svg construccion-plan-svg--map"
      style={placing ? { cursor: "copy" } : undefined}
      onClick={handleClick}
      {...drag.handlers}
    >
      <g>{grid}</g>

      {habitaciones.map((hab) => {
        if (hab.puntos.length < 3) return null;
        const zona = zonaDe(hab.tipo);
        const selected = hab.id === selectedId;
        const segs = wallSegmentsFromPolygon(hab.puntos);
        const cx = hab.puntos.reduce((s, p) => s + p.x, 0) / hab.puntos.length;
        const cz = hab.puntos.reduce((s, p) => s + p.z, 0) / hab.puntos.length;
        return (
          <g key={hab.id}>
            <polygon
              points={hab.puntos.map((p) => `${p.x},${p.z}`).join(" ")}
              fill={zona.fill}
              stroke="none"
              className={placing ? undefined : "construccion-room-hit"}
              onPointerDown={
                placing
                  ? undefined
                  : (e) => {
                      onSelectRoom(hab.id);
                      onSelectObjeto(null);
                      drag.startHabitacion(e, hab.id);
                    }
              }
            />
            {segs.map((seg, i) => (
              <g key={i} pointerEvents="none">
                <line
                  x1={seg.start.x}
                  y1={seg.start.z}
                  x2={seg.end.x}
                  y2={seg.end.z}
                  stroke={selected ? "#2563eb" : "#3f3f46"}
                  strokeWidth={WALL_THICKNESS_M}
                  strokeLinecap="square"
                />
                {hab.aberturas
                  .filter((a) => a.segmentIndex === i)
                  .map((ab) => {
                    const t0 = Math.max(0, (ab.offsetM - ab.anchoM / 2) / seg.length);
                    const t1 = Math.min(1, (ab.offsetM + ab.anchoM / 2) / seg.length);
                    return (
                      <line
                        key={ab.id}
                        x1={seg.start.x + (seg.end.x - seg.start.x) * t0}
                        y1={seg.start.z + (seg.end.z - seg.start.z) * t0}
                        x2={seg.start.x + (seg.end.x - seg.start.x) * t1}
                        y2={seg.start.z + (seg.end.z - seg.start.z) * t1}
                        stroke={ab.tipo === "puerta" ? "#b45309" : "#0369a1"}
                        strokeWidth={WALL_THICKNESS_M * 0.9}
                      />
                    );
                  })}
              </g>
            ))}
            <text x={cx} y={cz - 0.1} fontSize={0.32} fontWeight={600} fill="#27272a" textAnchor="middle" pointerEvents="none">
              {hab.nombre}
            </text>
            <text x={cx} y={cz + 0.25} fontSize={0.22} fill="#52525b" textAnchor="middle" pointerEvents="none">
              {polygonArea(hab.puntos).toFixed(1)} m²
            </text>
          </g>
        );
      })}

      <ObjetosLayer
        objetos={objetos}
        selectedId={selectedObjetoId}
        onPointerDown={
          placing
            ? undefined
            : (e, o) => {
                onSelectObjeto(o.id);
                onSelectRoom(null);
                drag.startObjeto(e, o.id, { x: o.x, z: o.z });
              }
        }
      />
    </svg>
  );
});

export default PlanMap2D;
