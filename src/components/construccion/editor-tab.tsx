import { lazy, Suspense, useRef, useState, type Dispatch, type SetStateAction } from "react";
import PlanCanvas2D from "./plan-canvas-2d";
import { polygonArea, polygonPerimeter, wallSegmentsFromPolygon, type Point } from "../../lib/construccion/geometry";
import { exportPlanAsPdf, exportPlanAsPng } from "../../lib/construccion/export-plan";
import { ABERTURA_DEFAULTS, type Abertura, type Habitacion, type Proyecto, type TipoAbertura } from "../../lib/construccion/types";

const CLOSE_TOLERANCE_M = 0.35;
const DEFAULT_ALTURA_M = 2.5;

// three.js/@react-three/fiber son pesados (~250kB gzip) — se difieren hasta que
// alguien de verdad hace clic en "Vista 3D", en vez de bajarlos siempre que se
// abre un proyecto (la mayoría de las ediciones son solo en el plano 2D).
const RoomPreview = lazy(() => import("./room-preview"));

type Props = {
  proyecto: Proyecto;
  setProyecto: Dispatch<SetStateAction<Proyecto>>;
  selectedId: string | null;
  setSelectedId: Dispatch<SetStateAction<string | null>>;
};

export default function EditorTab({ proyecto, setProyecto, selectedId, setSelectedId }: Props) {
  const [draftPoints, setDraftPoints] = useState<Point[]>([]);
  const [view, setView] = useState<"2d" | "3d">("2d");
  const svgRef = useRef<SVGSVGElement>(null);

  const selected = proyecto.habitaciones.find((h) => h.id === selectedId) ?? null;
  const drawing = !selected;

  function updateSelected(fn: (h: Habitacion) => Habitacion) {
    setProyecto((p) => ({
      ...p,
      habitaciones: p.habitaciones.map((h) => (h.id === selectedId ? fn(h) : h)),
    }));
  }

  function handleCanvasClick(p: Point) {
    if (draftPoints.length >= 3) {
      const first = draftPoints[0];
      if (Math.hypot(p.x - first.x, p.z - first.z) <= CLOSE_TOLERANCE_M) {
        closeDraftRoom();
        return;
      }
    }
    setDraftPoints((pts) => [...pts, p]);
  }

  function closeDraftRoom() {
    if (draftPoints.length < 3) return;
    const nueva: Habitacion = {
      id: crypto.randomUUID(),
      nombre: `Habitación ${proyecto.habitaciones.length + 1}`,
      puntos: draftPoints,
      alturaM: DEFAULT_ALTURA_M,
      aberturas: [],
    };
    setProyecto((p) => ({ ...p, habitaciones: [...p.habitaciones, nueva] }));
    setSelectedId(nueva.id);
    setDraftPoints([]);
  }

  function undoLastPoint() {
    setDraftPoints((pts) => pts.slice(0, -1));
  }

  function startNewRoom() {
    setSelectedId(null);
    setDraftPoints([]);
    setView("2d");
  }

  function deleteRoom(id: string) {
    if (!window.confirm("¿Eliminar esta habitación? No se puede deshacer.")) return;
    setProyecto((p) => ({ ...p, habitaciones: p.habitaciones.filter((h) => h.id !== id) }));
    if (selectedId === id) setSelectedId(null);
  }

  function handleWallClick(segmentIndex: number, offsetM: number) {
    if (!selected) return;
    const seg = wallSegmentsFromPolygon(selected.puntos)[segmentIndex];
    if (!seg) return;
    const ancho = Math.min(0.9, Math.max(0.4, seg.length - 0.2));
    const offset = Math.min(Math.max(offsetM, ancho / 2), Math.max(seg.length - ancho / 2, ancho / 2));
    const nueva: Abertura = {
      id: crypto.randomUUID(),
      segmentIndex,
      tipo: "puerta",
      offsetM: offset,
      anchoM: ancho,
      ...ABERTURA_DEFAULTS.puerta,
    };
    updateSelected((h) => ({ ...h, aberturas: [...h.aberturas, nueva] }));
  }

  function updateAbertura(id: string, patch: Partial<Abertura>) {
    updateSelected((h) => ({
      ...h,
      aberturas: h.aberturas.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    }));
  }

  function setAberturaTipo(id: string, tipo: TipoAbertura) {
    updateAbertura(id, { tipo, ...ABERTURA_DEFAULTS[tipo] });
  }

  function deleteAbertura(id: string) {
    updateSelected((h) => ({ ...h, aberturas: h.aberturas.filter((a) => a.id !== id) }));
  }

  const areaM2 = selected ? polygonArea(selected.puntos) : 0;
  const perimetroM = selected ? polygonPerimeter(selected.puntos) : 0;

  async function handleExport(kind: "png" | "pdf") {
    if (!selected || !svgRef.current) return;
    const meta = { nombre: selected.nombre, areaM2, perimetroM };
    if (kind === "png") await exportPlanAsPng(svgRef.current, meta);
    else await exportPlanAsPdf(svgRef.current, meta);
  }

  return (
    <div className="construccion-editor">
      <aside className="construccion-editor__sidebar">
        <button onClick={startNewRoom} className="btn btn-primary construccion-editor__new-btn">
          + Nueva habitación
        </button>
        <ul className="construccion-editor__rooms">
          {proyecto.habitaciones.map((h) => (
            <li key={h.id}>
              <button
                onClick={() => {
                  setSelectedId(h.id);
                  setDraftPoints([]);
                }}
                className={`construccion-editor__room${h.id === selectedId ? " construccion-editor__room--active" : ""}`}
              >
                <span className="construccion-editor__room-name">{h.nombre}</span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteRoom(h.id);
                  }}
                  className="construccion-editor__room-delete"
                  aria-label={`Eliminar ${h.nombre}`}
                >
                  ×
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <main className="construccion-editor__main">
        <div className="construccion-editor__topbar">
          {drawing ? (
            <div className="construccion-editor__topbar-left">
              <span className="construccion-editor__hint-text">
                Clic para agregar puntos del muro · clic cerca del primer punto (verde) para cerrar
                {draftPoints.length > 0 ? ` · ${draftPoints.length} punto(s)` : ""}
              </span>
              {draftPoints.length > 0 && (
                <button onClick={undoLastPoint} className="btn btn-outline btn-sm">
                  Deshacer punto
                </button>
              )}
              {draftPoints.length >= 3 && (
                <button onClick={closeDraftRoom} className="construccion-editor__confirm-btn">
                  Cerrar habitación
                </button>
              )}
            </div>
          ) : (
            <div className="construccion-editor__topbar-left">
              <input
                value={selected.nombre}
                onChange={(e) => updateSelected((h) => ({ ...h, nombre: e.target.value }))}
                className="construccion-editor__name-input"
              />
              <label className="construccion-editor__altura-field">
                Altura (m)
                <input
                  type="number"
                  step={0.1}
                  min={2}
                  value={selected.alturaM}
                  onChange={(e) => updateSelected((h) => ({ ...h, alturaM: Number(e.target.value) || DEFAULT_ALTURA_M }))}
                  className="construccion-editor__altura-input"
                />
              </label>
              <div className="construccion-editor__view-toggle">
                <button
                  onClick={() => setView("2d")}
                  className={`construccion-editor__view-btn${view === "2d" ? " construccion-editor__view-btn--active" : ""}`}
                >
                  Plano 2D
                </button>
                <button
                  onClick={() => setView("3d")}
                  className={`construccion-editor__view-btn${view === "3d" ? " construccion-editor__view-btn--active" : ""}`}
                >
                  Vista 3D
                </button>
              </div>
            </div>
          )}

          {!drawing && (
            <div className="construccion-editor__topbar-right">
              <button onClick={() => handleExport("png")} className="btn btn-outline btn-sm">
                Exportar PNG
              </button>
              <button onClick={() => handleExport("pdf")} className="btn btn-outline btn-sm">
                Exportar PDF
              </button>
            </div>
          )}
        </div>

        <div className="construccion-editor__canvas">
          {view === "2d" || drawing ? (
            <PlanCanvas2D
              ref={svgRef}
              draftPoints={draftPoints}
              habitacion={selected}
              onCanvasClick={handleCanvasClick}
              onWallClick={handleWallClick}
            />
          ) : (
            <Suspense fallback={<div className="construccion-3d-empty">Cargando visor 3D…</div>}>
              <RoomPreview habitacion={selected} />
            </Suspense>
          )}
        </div>

        {!drawing && (
          <div className="construccion-editor__footer">
            <div className="construccion-editor__metrics">
              Área: <strong>{areaM2.toFixed(2)} m²</strong> · Perímetro: <strong>{perimetroM.toFixed(2)} m</strong>
            </div>
            <div className="construccion-editor__aberturas">
              <p className="construccion-editor__aberturas-hint">
                Aberturas — clic sobre un muro en el plano 2D para agregar una puerta
              </p>
              <ul className="construccion-editor__abertura-list">
                {selected.aberturas.map((a) => (
                  <li key={a.id} className="construccion-editor__abertura-row">
                    <select
                      value={a.tipo}
                      onChange={(e) => setAberturaTipo(a.id, e.target.value as TipoAbertura)}
                      className="construccion-editor__abertura-select"
                    >
                      <option value="puerta">Puerta</option>
                      <option value="ventana">Ventana</option>
                    </select>
                    <label className="construccion-editor__abertura-label">
                      ancho
                      <input
                        type="number"
                        step={0.1}
                        min={0.3}
                        value={a.anchoM}
                        onChange={(e) => updateAbertura(a.id, { anchoM: Number(e.target.value) || a.anchoM })}
                        className="construccion-editor__abertura-input"
                      />
                      m
                    </label>
                    <label className="construccion-editor__abertura-label">
                      alto
                      <input
                        type="number"
                        step={0.1}
                        min={0.3}
                        value={a.altoM}
                        onChange={(e) => updateAbertura(a.id, { altoM: Number(e.target.value) || a.altoM })}
                        className="construccion-editor__abertura-input"
                      />
                      m
                    </label>
                    <label className="construccion-editor__abertura-label">
                      desde piso
                      <input
                        type="number"
                        step={0.1}
                        min={0}
                        value={a.altoDesdePisoM}
                        onChange={(e) => updateAbertura(a.id, { altoDesdePisoM: Number(e.target.value) || 0 })}
                        className="construccion-editor__abertura-input"
                      />
                      m
                    </label>
                    <button onClick={() => deleteAbertura(a.id)} className="construccion-editor__abertura-delete">
                      eliminar
                    </button>
                  </li>
                ))}
                {selected.aberturas.length === 0 && <li className="empty-state">Ninguna todavía</li>}
              </ul>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
