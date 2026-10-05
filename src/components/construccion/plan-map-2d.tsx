import { forwardRef, useMemo, useState } from "react";
import { asasDe, divisoresDe, type Asa } from "../../lib/construccion/divisores";
import { openPolylineSegments, polygonArea, polygonBounds, snap, snapToAxes, wallSegmentsFromPolygon, type Point } from "../../lib/construccion/geometry";
import { puntoDeCorte, puntoEnBorde } from "../../lib/construccion/dividir";
import { zonaDe } from "../../lib/construccion/objetos";
import { muroCercano } from "../../lib/construccion/aberturasMapa";
import type { FondoNivel, Habitacion, Objeto, TipoAbertura } from "../../lib/construccion/types";
import ObjetosLayer from "./plan-objetos";
import AberturaSvg, { aberturasRepetidas, ladoInterior } from "./plan-aberturas";
import { esTipoExterior } from "../../lib/construccion/stats";
import PlanGrid from "./plan-grid";
import { Cota } from "./plan-canvas-2d";
import { OBJ_GRID_M, VERTEX_GRID_M, svgPoint, type usePlanDrag } from "./plan-drag";
import type { PlanViewport } from "./use-plan-viewport";

const WALL_THICKNESS_M = 0.15;
const CURSOR_ASA: Record<Asa, string> = { n: "ns-resize", s: "ns-resize", e: "ew-resize", w: "ew-resize", ne: "nesw-resize", sw: "nesw-resize", nw: "nwse-resize", se: "nwse-resize" };
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
  tool?: "draw" | "split" | "opening" | "measure" | null;
  /** Qué se pone con la herramienta "opening". */
  openingTipo?: TipoAbertura;
  onOpeningClick?: (p: Point) => void;
  /** Puntos de la regla (0, 1 o 2) y su clic. */
  medicion?: Point[];
  onMeasureClick?: (p: Point) => void;
  /** Abertura seleccionada (la que se edita en la barra de abajo) y cómo seleccionar otra. */
  selectedAbertura?: { habId: string; id: string } | null;
  /** Escaleras que vienen del nivel de abajo: se ven punteadas con su hueco en este piso. */
  /** Desnivel real de cada escalera conectada (id de objeto → m). */
  rises?: Record<string, number>;
  /** Escribe la medida de cada muro sobre el plano (los muros compartidos, una sola vez). */
  mostrarMedidas?: boolean;
  /** Paso fijo del imán (se dibuja en la cuadrícula); null = el de la cuadrícula visible. */
  pasoImán?: number | null;
  fantasmas?: { huella: Point[]; hueco: Point[]; etiqueta: string }[];
  onSelectAbertura?: (habId: string, id: string) => void;
  /** Puntos ya puestos del contorno que se está dibujando (herramienta "draw"). */
  draftPoints?: Point[];
  onDrawClick?: (p: Point) => void;
  /** Cuarto que se está dividiendo y, si ya hizo el primer clic, el punto de su muro donde empieza el corte. */
  splitRoom?: Habitacion | null;
  splitFrom?: Point | null;
  onSplitClick?: (p: Point) => void;
};

const PlanMap2D = forwardRef<SVGSVGElement, Props>(function PlanMap2D(
  { vp, habitaciones, objetos, selectedId, selectedObjetoId, drag, placing, onPlace, onSelectRoom, onSelectObjeto, fondo, fondoDraggable, tool = null, draftPoints = [], onDrawClick, splitRoom = null, splitFrom = null, onSplitClick, openingTipo = "puerta", onOpeningClick, medicion = [], onMeasureClick, selectedAbertura = null, onSelectAbertura, fantasmas = [], rises, mostrarMedidas = false, pasoImán = null },
  ref,
) {
  const [cursor, setCursor] = useState<Point | null>(null);
  const selHab = habitaciones.find((h) => h.id === selectedId) ?? null;
  // Con una herramienta activa los cuartos y muebles no se agarran: cada clic es de la herramienta.
  const blocked = placing || tool !== null;
  const divisores = useMemo(() => divisoresDe(habitaciones), [habitaciones]);
  // El lote va debajo de todo lo demás.
  const ordenadas = useMemo(() => [...habitaciones.filter((h) => h.tipo === "terreno"), ...habitaciones.filter((h) => h.tipo !== "terreno")], [habitaciones]);
  // Una medida por muro: si dos zonas comparten el mismo muro, se escribe una vez.
  const murosUnicos = useMemo(() => {
    if (!mostrarMedidas) return [];
    const vistos = new Set<string>();
    const redondo = (v: number) => Math.round(v * 50) / 50;
    return habitaciones.flatMap((h) =>
      wallSegmentsFromPolygon(h.puntos).filter((seg) => {
        if (seg.length < 0.4) return false;
        const a = `${redondo(seg.start.x)},${redondo(seg.start.z)}`;
        const b = `${redondo(seg.end.x)},${redondo(seg.end.z)}`;
        const k = a < b ? `${a}|${b}` : `${b}|${a}`;
        if (vistos.has(k)) return false;
        vistos.add(k);
        return true;
      }),
    );
  }, [habitaciones, mostrarMedidas]);
  const repetidas = useMemo(() => aberturasRepetidas(habitaciones), [habitaciones]);

  // Igual que al dibujar un cuarto suelto: imán de 5 cm y alineación con los puntos ya puestos.
  function toDrawPoint(svg: SVGSVGElement, clientX: number, clientY: number): Point {
    const raw = svgPoint(svg, clientX, clientY);
    const snapped = { x: snap(raw.x, VERTEX_GRID_M), z: snap(raw.z, VERTEX_GRID_M) };
    return snapToAxes(snapped, draftPoints, ALIGN_TOLERANCE_PX * vp.mpp);
  }

  // La regla se pega a las esquinas de las zonas (a 14 px) y, si no, al imán de 5 cm.
  function toMeasurePoint(svg: SVGSVGElement, clientX: number, clientY: number): Point {
    const raw = svgPoint(svg, clientX, clientY);
    const tol = 14 * vp.mpp;
    let mejor: Point | null = null;
    let mejorD = tol;
    for (const h of habitaciones) {
      for (const p of h.puntos) {
        const d = Math.hypot(p.x - raw.x, p.z - raw.z);
        if (d < mejorD) {
          mejorD = d;
          mejor = p;
        }
      }
    }
    return mejor ?? { x: snap(raw.x, VERTEX_GRID_M), z: snap(raw.z, VERTEX_GRID_M) };
  }

  function handleClick(e: React.MouseEvent<SVGSVGElement>) {
    if (vp.consumeClick() || drag.consumeClick()) return;
    if (tool === "opening" && onOpeningClick) {
      onOpeningClick(svgPoint(e.currentTarget, e.clientX, e.clientY));
      return;
    }
    if (tool === "measure" && onMeasureClick) {
      onMeasureClick(toMeasurePoint(e.currentTarget, e.clientX, e.clientY));
      return;
    }
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
        else if (tool === "split" || tool === "opening") setCursor(svgPoint(e.currentTarget, e.clientX, e.clientY));
        else if (tool === "measure") setCursor(toMeasurePoint(e.currentTarget, e.clientX, e.clientY));
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

      <PlanGrid visible={vp.visible} paso={pasoImán} />

      {ordenadas.map((hab) => {
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
                  stroke={selected ? "#2563eb" : hab.tipo === "terreno" ? "#374151" : esTipoExterior(hab.tipo) ? zona.color : "#3f3f46"}
                  strokeWidth={hab.tipo === "terreno" ? 0.09 : esTipoExterior(hab.tipo) ? WALL_THICKNESS_M * 0.45 : WALL_THICKNESS_M}
                  strokeDasharray={hab.tipo === "terreno" ? "0.6 0.25" : esTipoExterior(hab.tipo) ? "0.3 0.18" : undefined}
                  strokeLinecap={esTipoExterior(hab.tipo) || hab.tipo === "terreno" ? "butt" : "square"}
                />
                {hab.aberturas
                  .filter((a) => a.segmentIndex === i)
                  .map((ab) => {
                    const esSel = selectedAbertura?.id === ab.id;
                    return (
                      <g key={ab.id}>
                        <AberturaSvg seg={seg} ab={ab} relleno={zona.fill} lado={ladoInterior(hab.puntos, seg)} dibujarHoja={!repetidas.has(ab.id)} selected={esSel} />
                      </g>
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

      {!blocked &&
        divisores.map((dv, i) => {
          const vertical = Math.abs(dv.n.x) > 0.5;
          const mx = (dv.a.x + dv.b.x) / 2;
          const mz = (dv.a.z + dv.b.z) / 2;
          return (
            <g key={`dv${i}`} className="construccion-plan-ui">
              <line
                x1={dv.a.x}
                y1={dv.a.z}
                x2={dv.b.x}
                y2={dv.b.z}
                stroke="transparent"
                strokeWidth={14 * vp.mpp}
                style={{ cursor: Math.abs(dv.n.x) < 1e-6 ? "row-resize" : Math.abs(dv.n.z) < 1e-6 ? "col-resize" : "move" }}
                onPointerDown={(e) => drag.startDivisor(e, dv)}
              />
              <circle
                cx={mx}
                cy={mz}
                r={6 * vp.mpp}
                fill="#ffffff"
                stroke="#2563eb"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
                style={{ cursor: vertical ? "col-resize" : "row-resize" }}
                onPointerDown={(e) => drag.startDivisor(e, dv)}
              />
            </g>
          );
        })}

      {murosUnicos.map((seg, i) => (
        <g key={`cota${i}`} pointerEvents="none">
          <Cota segment={seg} mpp={vp.mpp} />
        </g>
      ))}

      {fantasmas.map((f, i) => {
        const cx = f.huella.reduce((s, p) => s + p.x, 0) / f.huella.length;
        const cz = f.huella.reduce((s, p) => s + p.z, 0) / f.huella.length;
        return (
          <g key={`fant${i}`} pointerEvents="none">
            <polygon points={f.hueco.map((p) => `${p.x},${p.z}`).join(" ")} fill="#f59e0b" fillOpacity={0.2} />
            <polygon points={f.huella.map((p) => `${p.x},${p.z}`).join(" ")} fill="none" stroke="#b45309" strokeWidth={0.05} strokeDasharray="0.2 0.12" />
            <text x={cx} y={cz} fontSize={0.2} fontWeight={700} fill="#92400e" textAnchor="middle" dominantBaseline="middle" stroke="#ffffff" strokeWidth={0.05} paintOrder="stroke">
              {f.etiqueta}
            </text>
          </g>
        );
      })}

      {!blocked && onSelectAbertura &&
        habitaciones.flatMap((hab) =>
          wallSegmentsFromPolygon(hab.puntos).flatMap((seg, i) =>
            hab.aberturas
              .filter((a) => a.segmentIndex === i)
              .map((ab) => {
                const t0 = Math.max(0, (ab.offsetM - ab.anchoM / 2) / seg.length);
                const t1 = Math.min(1, (ab.offsetM + ab.anchoM / 2) / seg.length);
                return (
                  <line
                    key={`hit${ab.id}`}
                    className="construccion-plan-ui"
                    x1={seg.start.x + (seg.end.x - seg.start.x) * t0}
                    y1={seg.start.z + (seg.end.z - seg.start.z) * t0}
                    x2={seg.start.x + (seg.end.x - seg.start.x) * t1}
                    y2={seg.start.z + (seg.end.z - seg.start.z) * t1}
                    stroke="transparent"
                    strokeWidth={14 * vp.mpp}
                    style={{ cursor: "grab" }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      onSelectRoom(hab.id);
                      onSelectObjeto(null);
                      onSelectAbertura(hab.id, ab.id);
                      drag.startAbertura(e, hab.id, ab.id);
                    }}
                  />
                );
              }),
          ),
        )}

      <ObjetosLayer
        objetos={objetos}
        selectedId={selectedObjetoId}
        rises={rises}
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

      {tool === "opening" && cursor && (() => {
        const muro = muroCercano(habitaciones, cursor, Math.max(0.3, PICK_TOLERANCE_PX * vp.mpp));
        if (!muro) return null;
        return (
          <g className="construccion-plan-ui" pointerEvents="none">
            <circle cx={muro.point.x} cy={muro.point.z} r={7 * vp.mpp} fill={openingTipo === "puerta" ? "#b45309" : "#0369a1"} stroke="#ffffff" strokeWidth={2} vectorEffect="non-scaling-stroke" />
          </g>
        );
      })()}

      {tool === "measure" && (medicion.length > 0 || cursor) && (() => {
        const a = medicion[0] ?? cursor;
        const b = medicion.length >= 2 ? medicion[1] : medicion.length === 1 ? cursor : null;
        const punto = (p: Point) => <circle cx={p.x} cy={p.z} r={5 * vp.mpp} fill="#7c3aed" stroke="#ffffff" strokeWidth={2} vectorEffect="non-scaling-stroke" />;
        if (!a) return null;
        if (!b || (b.x === a.x && b.z === a.z)) return <g className="construccion-plan-ui" pointerEvents="none">{punto(a)}</g>;
        const d = Math.hypot(b.x - a.x, b.z - a.z);
        return (
          <g className="construccion-plan-ui" pointerEvents="none">
            <line x1={a.x} y1={a.z} x2={b.x} y2={a.z} stroke="#c4b5fd" strokeWidth={1.5} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
            <line x1={b.x} y1={a.z} x2={b.x} y2={b.z} stroke="#c4b5fd" strokeWidth={1.5} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
            <line x1={a.x} y1={a.z} x2={b.x} y2={b.z} stroke="#7c3aed" strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
            {punto(a)}
            {punto(b)}
            <text x={(a.x + b.x) / 2} y={(a.z + b.z) / 2 - 10 * vp.mpp} fontSize={14 * vp.mpp} fontWeight={700} fill="#6d28d9" textAnchor="middle" stroke="#ffffff" strokeWidth={3 * vp.mpp} paintOrder="stroke">
              {d.toFixed(2)} m
            </text>
            <text x={(a.x + b.x) / 2} y={(a.z + b.z) / 2 + 8 * vp.mpp} fontSize={11 * vp.mpp} fill="#6d28d9" textAnchor="middle" stroke="#ffffff" strokeWidth={3 * vp.mpp} paintOrder="stroke">
              Δx {Math.abs(b.x - a.x).toFixed(2)} · Δz {Math.abs(b.z - a.z).toFixed(2)}
            </text>
          </g>
        );
      })()}

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
      {!blocked && selHab && selHab.puntos.length >= 3 && (() => {
        const asas = asasDe(selHab);
        const lado = 9 * vp.mpp;
        if (asas.length === 0) {
          // Zona que no es un rectángulo: se mueve vértice por vértice.
          return (
            <g className="construccion-plan-ui">
              {selHab.puntos.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.z} r={6 * vp.mpp} fill="#ffffff" stroke="#2563eb" strokeWidth={2} vectorEffect="non-scaling-stroke" style={{ cursor: "move" }} onPointerDown={(e) => drag.startVertice(e, selHab.id, i)} />
              ))}
            </g>
          );
        }
        const b = polygonBounds(selHab.puntos);
        const etiqueta = { fontSize: 12 * vp.mpp, fontWeight: 700, fill: "#1d4ed8", stroke: "#ffffff", strokeWidth: 3 * vp.mpp, paintOrder: "stroke" as const, pointerEvents: "none" as const };
        return (
          <g className="construccion-plan-ui">
            <text x={(b.minX + b.maxX) / 2} y={b.minZ - 12 * vp.mpp} textAnchor="middle" {...etiqueta}>
              {(b.maxX - b.minX).toFixed(2)} m
            </text>
            <text x={b.maxX + 12 * vp.mpp} y={(b.minZ + b.maxZ) / 2} textAnchor="start" dominantBaseline="central" {...etiqueta}>
              {(b.maxZ - b.minZ).toFixed(2)} m
            </text>
            {asas.map((a) => (
              <rect
                key={a.asa}
                x={a.p.x - lado / 2}
                y={a.p.z - lado / 2}
                width={lado}
                height={lado}
                fill="#ffffff"
                stroke="#2563eb"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
                style={{ cursor: CURSOR_ASA[a.asa] }}
                onPointerDown={(e) => drag.startLado(e, selHab.id, a.asa)}
              />
            ))}
          </g>
        );
      })()}
    </svg>
  );
});

export default PlanMap2D;
