import { forwardRef, useState } from "react";
import {
  openPolylineSegments,
  projectPointOnSegment,
  snap,
  wallSegmentsFromPolygon,
  type Point,
  type WallSegment,
} from "../../lib/construccion/geometry";
import type { Habitacion } from "../../lib/construccion/types";

const GRID_M = 0.25;
const VIEW_W = 12;
const VIEW_H = 9;
const FONT_M = 0.28;
const WALL_THICKNESS_M = 0.15;
const CLICK_TOLERANCE_M = 0.4;

function toPlanPoint(svg: SVGSVGElement, clientX: number, clientY: number): Point {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const { x, y } = pt.matrixTransform(svg.getScreenCTM()!.inverse());
  return { x: snap(x, GRID_M), z: snap(y, GRID_M) };
}

function PlanGrid() {
  const lines = [];
  for (let x = 0; x <= VIEW_W; x += 1) {
    lines.push(<line key={`gx${x}`} x1={x} y1={0} x2={x} y2={VIEW_H} stroke="#f4f4f5" strokeWidth={0.015} />);
  }
  for (let z = 0; z <= VIEW_H; z += 1) {
    lines.push(<line key={`gz${z}`} x1={0} y1={z} x2={VIEW_W} y2={z} stroke="#f4f4f5" strokeWidth={0.015} />);
  }
  return <g>{lines}</g>;
}

function Cota({ segment }: { segment: WallSegment }) {
  const nx = -Math.sin(segment.angle);
  const nz = Math.cos(segment.angle);
  const offset = 0.22;
  return (
    <text
      x={segment.center.x + nx * offset}
      y={segment.center.z + nz * offset}
      fontSize={FONT_M}
      fill="#52525b"
      textAnchor="middle"
      dominantBaseline="middle"
    >
      {segment.length.toFixed(2)} m
    </text>
  );
}

type Props = {
  /** Puntos ya colocados de la habitación que se está dibujando (aún sin cerrar). */
  draftPoints: Point[];
  /** Habitación ya cerrada que se está viendo/editando (aberturas). Mutuamente excluyente con draftPoints activo. */
  habitacion: Habitacion | null;
  onCanvasClick: (p: Point) => void;
  onWallClick?: (segmentIndex: number, offsetM: number) => void;
};

const PlanCanvas2D = forwardRef<SVGSVGElement, Props>(function PlanCanvas2D(
  { draftPoints, habitacion, onCanvasClick, onWallClick },
  ref,
) {
  const [cursor, setCursor] = useState<Point | null>(null);
  const drawing = !habitacion;
  const points = habitacion ? habitacion.puntos : draftPoints;
  const segments = habitacion ? wallSegmentsFromPolygon(points) : openPolylineSegments(points);
  const canClose = drawing && points.length >= 3;

  function handleClick(e: React.MouseEvent<SVGSVGElement>) {
    const p = toPlanPoint(e.currentTarget, e.clientX, e.clientY);

    if (habitacion && onWallClick) {
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
      if (best >= 0 && bestDist < CLICK_TOLERANCE_M) onWallClick(best, bestOffset);
      return;
    }

    onCanvasClick(p);
  }

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!drawing) return;
    setCursor(toPlanPoint(e.currentTarget, e.clientX, e.clientY));
  }

  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      className="construccion-plan-svg"
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setCursor(null)}
    >
      <PlanGrid />

      {points.length >= 3 && (
        <polygon points={points.map((p) => `${p.x},${p.z}`).join(" ")} fill="#eef2ff" stroke="none" />
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
            <Cota segment={seg} />
          </g>
        );
      })}

      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.z}
          r={i === 0 && canClose ? 0.14 : 0.07}
          fill={i === 0 && canClose ? "#16a34a" : "#3f3f46"}
        />
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
        />
      )}
    </svg>
  );
});

export default PlanCanvas2D;
