import { forwardRef, useState } from "react";
import {
  openPolylineSegments,
  projectPointOnSegment,
  snap,
  snapToAxes,
  wallSegmentsFromPolygon,
  type Point,
  type WallSegment,
} from "../../lib/construccion/geometry";
import type { Habitacion, Objeto } from "../../lib/construccion/types";
import { zonaDe } from "../../lib/construccion/objetos";
import ObjetosLayer from "./plan-objetos";
import PlanGrid from "./plan-grid";
import { OBJ_GRID_M, VERTEX_GRID_M, svgPoint, type usePlanDrag } from "./plan-drag";
import type { PlanViewport } from "./use-plan-viewport";

const WALL_THICKNESS_M = 0.15;
const CLICK_TOLERANCE_PX = 22;
const ALIGN_TOLERANCE_PX = 10;
const LABEL_PX = 12;
const HANDLE_PX = 7;

function Cota({ segment, mpp }: { segment: WallSegment; mpp: number }) {
  const nx = -Math.sin(segment.angle);
  const nz = Math.cos(segment.angle);
  const label = `${segment.length.toFixed(2)} m`;
  const fontSize = LABEL_PX * mpp;
  // La etiqueta se separa del muro según su orientación: en un muro vertical hay que
  // apartarla la mitad de su ancho de texto; en uno horizontal, la mitad de su alto.
  const halfW = (fontSize * 0.55 * label.length) / 2;
  const offset = WALL_THICKNESS_M / 2 + 0.06 + Math.abs(nx) * halfW + Math.abs(nz) * fontSize * 0.6;
  return (
    <text
      className="construccion-cota"
      x={segment.center.x + nx * offset}
      y={segment.center.z + nz * offset}
      fontSize={fontSize}
      fill="#52525b"
      textAnchor="middle"
      dominantBaseline="middle"
      pointerEvents="none"
    >
      {label}
    </text>
  );
}

type Props = {
  vp: PlanViewport;
  /** Puntos ya colocados de la habitación que se está dibujando (aún sin cerrar). */
  draftPoints: Point[];
  /** Habitación ya cerrada que se está viendo/editando (aberturas). Mutuamente excluyente con draftPoints activo. */
  habitacion: Habitacion | null;
  onCanvasClick: (p: Point) => void;
  onWallClick?: (segmentIndex: number, offsetM: number) => void;
  /** Muebles a dibujar (los de esta habitación). */
  objetos?: Objeto[];
  selectedObjetoId?: string | null;
  /** Arrastre de objetos y vértices (viene de `usePlanDrag` en el editor). */
  drag?: ReturnType<typeof usePlanDrag>;
  /** Hay un objeto "armado" del catálogo: el siguiente clic lo coloca en vez de agregar una puerta. */
  placing?: boolean;
  onPlace?: (p: Point) => void;
  onObjetoSelect?: (id: string | null) => void;
  /** Muro resaltado (el que se está editando en el panel de medidas). */
  highlightWall?: number | null;
};

const PlanCanvas2D = forwardRef<SVGSVGElement, Props>(function PlanCanvas2D(
  { vp, draftPoints, habitacion, onCanvasClick, onWallClick, objetos = [], selectedObjetoId = null, drag, placing, onPlace, onObjetoSelect, highlightWall = null },
  ref,
) {
  const [cursor, setCursor] = useState<Point | null>(null);
  const drawing = !habitacion;
  const points = habitacion ? habitacion.puntos : draftPoints;
  const segments = habitacion ? wallSegmentsFromPolygon(points) : openPolylineSegments(points);
  const canClose = drawing && points.length >= 3;
  const mpp = vp.mpp;

  // Al dibujar: imán de 5 cm y alineación con los puntos ya puestos (misma x o misma z) si
  // el cursor queda a menos de ~10 px. Así un rectángulo sale recto sin pelear con el mouse.
  function toDrawPoint(svg: SVGSVGElement, clientX: number, clientY: number): Point {
    const raw = svgPoint(svg, clientX, clientY);
    const snapped = { x: snap(raw.x, VERTEX_GRID_M), z: snap(raw.z, VERTEX_GRID_M) };
    return snapToAxes(snapped, draftPoints, ALIGN_TOLERANCE_PX * mpp);
  }

  function handleClick(e: React.MouseEvent<SVGSVGElement>) {
    if (vp.consumeClick() || drag?.consumeClick()) return;

    if (habitacion && placing && onPlace) {
      const raw = svgPoint(e.currentTarget, e.clientX, e.clientY);
      onPlace({ x: snap(raw.x, OBJ_GRID_M), z: snap(raw.z, OBJ_GRID_M) });
      return;
    }

    if (habitacion && onWallClick) {
      const p = svgPoint(e.currentTarget, e.clientX, e.clientY);
      const segs = wallSegmentsFromPolygon(habitacion.puntos);
      let best = -1;
      let bestDist = Infinity;
      let bestOffset = 0;
      segs.forEach((seg, i) => {
        const { t, distance } = projectPointOnSegment(p, seg);
        if (distance < bestDist) {
          bestDist = distance;
          best = i;
          bestOffset = t * seg.length;
        }
      });
      if (best >= 0 && bestDist < Math.max(0.15, CLICK_TOLERANCE_PX * mpp)) onWallClick(best, bestOffset);
      else onObjetoSelect?.(null);
      return;
    }

    onCanvasClick(toDrawPoint(e.currentTarget, e.clientX, e.clientY));
  }

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!drawing) return;
    setCursor(toDrawPoint(e.currentTarget, e.clientX, e.clientY));
  }

  // Líneas guía punteadas cuando el cursor está alineado con un punto ya puesto.
  const guides =
    drawing && cursor
      ? draftPoints.flatMap((r) => [
          ...(cursor.x === r.x && cursor.z !== r.z ? [{ x1: r.x, z1: r.z, x2: cursor.x, z2: cursor.z }] : []),
          ...(cursor.z === r.z && cursor.x !== r.x ? [{ x1: r.x, z1: r.z, x2: cursor.x, z2: cursor.z }] : []),
        ])
      : [];

  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={vp.viewBox}
      className="construccion-plan-svg"
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setCursor(null)}
      onPointerDown={vp.handlers.onPointerDown}
      onPointerMove={(e) => {
        vp.handlers.onPointerMove(e);
        drag?.handlers.onPointerMove(e);
      }}
      onPointerUp={(e) => {
        vp.handlers.onPointerUp(e);
        drag?.handlers.onPointerUp();
      }}
      onPointerCancel={vp.handlers.onPointerCancel}
      onPointerLeave={() => drag?.handlers.onPointerLeave()}
      style={placing ? { cursor: "copy" } : undefined}
    >
      <PlanGrid visible={vp.visible} />

      {points.length >= 3 && (
        <polygon points={points.map((p) => `${p.x},${p.z}`).join(" ")} fill={zonaDe(habitacion?.tipo).fill} stroke="none" />
      )}

      {highlightWall !== null && segments[highlightWall] && (
        <line
          className="construccion-plan-ui"
          x1={segments[highlightWall].start.x}
          y1={segments[highlightWall].start.z}
          x2={segments[highlightWall].end.x}
          y2={segments[highlightWall].end.z}
          stroke="#2563eb"
          strokeOpacity={0.35}
          strokeWidth={WALL_THICKNESS_M * 2.4}
          strokeLinecap="round"
          pointerEvents="none"
        />
      )}

      {segments.map((seg, i) => {
        const openings = habitacion ? habitacion.aberturas.filter((a) => a.segmentIndex === i) : [];
        return (
          <g key={i}>
            <line
              x1={seg.start.x}
              y1={seg.start.z}
              x2={seg.end.x}
              y2={seg.end.z}
              stroke="#3f3f46"
              strokeWidth={WALL_THICKNESS_M}
              strokeLinecap="square"
            />
            {openings.map((ab) => {
              const half = ab.anchoM / 2;
              const t0 = Math.max(0, (ab.offsetM - half) / seg.length);
              const t1 = Math.min(1, (ab.offsetM + half) / seg.length);
              const p0 = {
                x: seg.start.x + (seg.end.x - seg.start.x) * t0,
                z: seg.start.z + (seg.end.z - seg.start.z) * t0,
              };
              const p1 = {
                x: seg.start.x + (seg.end.x - seg.start.x) * t1,
                z: seg.start.z + (seg.end.z - seg.start.z) * t1,
              };
              return (
                <line
                  key={ab.id}
                  x1={p0.x}
                  y1={p0.z}
                  x2={p1.x}
                  y2={p1.z}
                  stroke={ab.tipo === "puerta" ? "#b45309" : "#0369a1"}
                  strokeWidth={WALL_THICKNESS_M * 0.9}
                  strokeLinecap="butt"
                />
              );
            })}
            <Cota segment={seg} mpp={mpp} />
          </g>
        );
      })}

      {habitacion && (
        <ObjetosLayer
          objetos={objetos}
          selectedId={selectedObjetoId}
          onPointerDown={
            drag && !placing
              ? (e, o) => {
                  onObjetoSelect?.(o.id);
                  drag.startObjeto(e, o.id, { x: o.x, z: o.z });
                }
              : undefined
          }
        />
      )}

      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.z}
          r={i === 0 && canClose ? 0.14 : 0.07}
          fill={i === 0 && canClose ? "#16a34a" : "#3f3f46"}
          pointerEvents="none"
        />
      ))}

      {/* Asas para arrastrar los vértices de la habitación (no salen en las exportaciones). */}
      {habitacion &&
        !placing &&
        drag &&
        points.map((p, i) => (
          <circle
            key={`h${i}`}
            className="construccion-plan-ui construccion-vertex"
            cx={p.x}
            cy={p.z}
            r={HANDLE_PX * mpp}
            fill="#ffffff"
            stroke="#2563eb"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
            onPointerDown={(e) => drag.startVertice(e, habitacion.id, i)}
          />
        ))}

      {guides.map((g, i) => (
        <line key={`g${i}`} x1={g.x1} y1={g.z1} x2={g.x2} y2={g.z2} stroke="#16a34a" strokeWidth={1} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" pointerEvents="none" />
      ))}

      {drawing && cursor && points.length > 0 && (
        <line
          x1={points[points.length - 1].x}
          y1={points[points.length - 1].z}
          x2={cursor.x}
          y2={cursor.z}
          stroke="#94a3b8"
          strokeWidth={1.5}
          strokeDasharray="6 5"
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
      )}
    </svg>
  );
});

export default PlanCanvas2D;
