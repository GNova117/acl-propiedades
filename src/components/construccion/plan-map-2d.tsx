import { forwardRef, useState } from "react";
import { openPolylineSegments, polygonArea, snap, snapToAxes, wallSegmentsFromPolygon, type Point } from "../../lib/construccion/geometry";
import { puntoDeCorte, puntoEnBorde } from "../../lib/construccion/dividir";
import { zonaDe } from "../../lib/construccion/objetos";
import type { FondoNivel, Habitacion, Objeto } from "../../lib/construccion/types";
import ObjetosLayer from "./plan-objetos";
import PlanGrid from "./plan-grid";
import { Cota } from "./plan-canvas-2d";
import { OBJ_GRID_M, VERTEX_GRID_M, svgPoint, type usePlanDrag } from "./plan-drag";
import type { PlanViewport } from "./use-plan-viewport";

const WALL_THICKNESS_M = 0.15;
const ALIGN_TOLERANCE_PX = 10;
const PICK_TOLERANCE_PX = 24;

type Props = {
  vp: PlanViewport;
  habitaciones: Habitacion[];
  objetos: Objeto[];
  selectedId: string | null;
  selectedObjetoId: string | null;
  drag: ReturnType<typeof usePlanDrag>;
  placing: boolean;
  onPlace: (p: Point) => void;
  onSelectRoom: (id: string | null) => void;
  onSelectObjeto: (id: string | null) => void;
  /** Plano/croquis de fondo para calcar encima — null si este nivel no tiene uno. */
  fondo?: FondoNivel | null;
  /** true mientras el botón "Mover" del fondo está activo: el fondo se puede arrastrar. */
  fondoDraggable?: boolean;
  /** Herramienta activa: dibujar un contorno nuevo o dividir el cuarto seleccionado. */
  tool?: "draw" | "split" | null;
  /** Puntos ya puestos del contorno que se está dibujando (herramienta "draw"). */
  draftPoints?: Point[];
  onDrawClick?: (p: Point) => void;
  /** Cuarto que se está dividiendo y, si ya hizo el primer clic, el punto de su muro donde empieza el corte. */
  splitRoom?: Habitacion | null;
  splitFrom?: Point | null;
  onSplitClick?: (p: Point) => void;
};

const PlanMap2D = forwardRef<SVGSVGElement, Props>(function PlanMap2D(
  { vp, habitaciones, objetos, selectedId, selectedObjetoId, drag, placing, onPlace, onSelectRoom, onSelectObjeto, fondo, fondoDraggable, tool = null, draftPoints = [], onDrawClick, splitRoom = null, splitFrom = null, onSplitClick },
  ref,
) {
  const [cursor, setCursor] = useState<Point | null>(null);
  // Con una herramienta activa los cuartos y muebles no se agarran: cada clic es de la herramienta.
  const blocked = placing || tool !== null;

  // Igual que al dibujar un cuarto suelto: imán de 5 cm y alineación con los puntos ya puestos.
  function toDrawPoint(svg: SVGSVGElement, clientX: number, clientY: number): Point {
    const raw = svgPoint(svg, clientX, clientY);
    const snapped = { x: snap(raw.x, VERTEX_GRID_M), z: snap(raw.z, VERTEX_GRID_M) };
    return snapToAxes(snapped, draftPoints, ALIGN_TOLERANCE_PX * vp.mpp);
  }

  function handleClick(e: React.MouseEvent<SVGSVGElement>) {
    if (vp.consumeClick() || drag.consumeClick()) return;
    if (tool === "draw" && onDrawClick) {
      onDrawClick(toDrawPoint(e.currentTarget, e.clientX, e.clientY));
      return;
    }
    if (tool === "split" && onSplitClick) {
      onSplitClick(svgPoint(e.currentTarget, e.clientX, e.clientY));
      return;
    }
    if (placing) {
      const raw = svgPoint(e.currentTarget, e.clientX, e.clientY);
      onPlace({ x: snap(raw.x, OBJ_GRID_M), z: snap(raw.z, OBJ_GRID_M) });
      return;
    }
    onSelectRoom(null);
    onSelectObjeto(null);
  }

  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={vp.viewBox}
      className="construccion-plan-svg construccion-plan-svg--map"
      style={placing ? { cursor: "copy" } : tool ? { cursor: "crosshair" } : undefined}
      onClick={handleClick}
      onMouseMove={(e) => {
        if (tool === "draw") setCursor(toDrawPoint(e.currentTarget, e.clientX, e.clientY));
        else if (tool === "split") setCursor(svgPoint(e.currentTarget, e.clientX, e.clientY));
      }}
      onMouseLeave={() => setCursor(null)}
      onPointerDown={vp.handlers.onPointerDown}
      onPointerMove={(e) => {
        vp.handlers.onPointerMove(e);
        drag.handlers.onPointerMove(e);
      }}
      onPointerUp={(e) => {
        vp.handlers.onPointerUp(e);
        drag.handlers.onPointerUp();
      }}
      onPointerCancel={vp.handlers.onPointerCancel}
      onPointerLeave={() => drag.handlers.onPointerLeave()}
    >
      {fondo?.signedUrl && (
        <image
          href={fondo.signedUrl}
          x={fondo.xM}
          y={fondo.zM}
          width={fondo.widthM}
          height={fondo.heightM}
          opacity={fondo.opacidad}
          preserveAspectRatio="none"
          style={fondoDraggable ? { cursor: "move" } : undefined}
          onPointerDown={fondoDraggable ? (e) => drag.startFondo(e) : undefined}
        />
      )}

      <PlanGrid visible={vp.visible} />

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
              className={blocked ? undefined : "construccion-room-hit"}
              onPointerDown={
                blocked
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
          blocked
            ? undefined
            : (e, o) => {
                onSelectObjeto(o.id);
                onSelectRoom(null);
                drag.startObjeto(e, o.id, { x: o.x, z: o.z });
              }
        }
      />
      {tool === "draw" && (
        <g className="construccion-plan-ui" pointerEvents="none">
          {draftPoints.length >= 3 && (
            <polygon points={draftPoints.map((p) => `${p.x},${p.z}`).join(" ")} fill="#3b82f6" fillOpacity={0.12} stroke="none" />
          )}
          {openPolylineSegments(draftPoints).map((seg, i) => (
            <Cota key={`c${i}`} segment={seg} mpp={vp.mpp} />
          ))}
          {cursor && draftPoints.length > 0 && Math.hypot(cursor.x - draftPoints[draftPoints.length - 1].x, cursor.z - draftPoints[draftPoints.length - 1].z) > 0.05 && (
            <Cota segment={openPolylineSegments([draftPoints[draftPoints.length - 1], cursor])[0]} mpp={vp.mpp} />
          )}
          {draftPoints.length >= 2 &&
            draftPoints.slice(1).map((p, i) => (
              <line key={i} x1={draftPoints[i].x} y1={draftPoints[i].z} x2={p.x} y2={p.z} stroke="#3f3f46" strokeWidth={WALL_THICKNESS_M} strokeLinecap="square" />
            ))}
          {draftPoints.length > 0 && cursor && (
            <line
              x1={draftPoints[draftPoints.length - 1].x}
              y1={draftPoints[draftPoints.length - 1].z}
              x2={cursor.x}
              y2={cursor.z}
              stroke="#94a3b8"
              strokeWidth={1.5}
              strokeDasharray="6 5"
              vectorEffect="non-scaling-stroke"
            />
          )}
          {draftPoints.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.z} r={i === 0 && draftPoints.length >= 3 ? 0.14 : 0.07} fill={i === 0 && draftPoints.length >= 3 ? "#16a34a" : "#3f3f46"} />
          ))}
        </g>
      )}

      {tool === "split" && splitRoom && (
        <g className="construccion-plan-ui" pointerEvents="none">
          {(() => {
            const marcador = (p: Point, color: string) => <circle cx={p.x} cy={p.z} r={7 * vp.mpp} fill={color} stroke="#ffffff" strokeWidth={2} vectorEffect="non-scaling-stroke" />;
            if (!splitFrom) {
              const cerca = cursor ? puntoEnBorde(splitRoom.puntos, cursor, Math.max(0.3, PICK_TOLERANCE_PX * vp.mpp)) : null;
              return cerca ? marcador(cerca, "#f59e0b") : null;
            }
            const fin = cursor ? puntoDeCorte(splitRoom.puntos, splitFrom, cursor) : null;
            return (
              <>
                {fin && (
                  <>
                    <line x1={splitFrom.x} y1={splitFrom.z} x2={fin.x} y2={fin.z} stroke="#dc2626" strokeWidth={2.5} strokeDasharray="8 5" vectorEffect="non-scaling-stroke" />
                    {marcador(fin, "#dc2626")}
                    <text
                      x={(splitFrom.x + fin.x) / 2}
                      y={(splitFrom.z + fin.z) / 2 - 8 * vp.mpp}
                      fontSize={12 * vp.mpp}
                      fontWeight={600}
                      fill="#b91c1c"
                      textAnchor="middle"
                    >
                      {Math.hypot(fin.x - splitFrom.x, fin.z - splitFrom.z).toFixed(2)} m
                    </text>
                  </>
                )}
                {marcador(splitFrom, "#dc2626")}
              </>
            );
          })()}
        </g>
      )}
    </svg>
  );
});

export default PlanMap2D;
