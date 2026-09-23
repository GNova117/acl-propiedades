import { lazy, Suspense, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import PlanCanvas2D from "./plan-canvas-2d";
import PlanMap2D from "./plan-map-2d";
import ObjetosPalette from "./objetos-palette";
import { usePlanDrag } from "./plan-drag";
import {
  pointInPolygon,
  polygonArea,
  polygonBounds,
  polygonPerimeter,
  snapBoundsToNeighbors,
  wallSegmentsFromPolygon,
  type Point,
} from "../../lib/construccion/geometry";
import { ZONAS, zonaDe, colocarKit, nuevoObjeto, objetoDef, type Kit } from "../../lib/construccion/objetos";
import { exportPlanAsPdf, exportPlanAsPng } from "../../lib/construccion/export-plan";
import {
  ABERTURA_DEFAULTS,
  type Abertura,
  type Habitacion,
  type Objeto,
  type Proyecto,
  type TipoAbertura,
  type TipoHabitacion,
} from "../../lib/construccion/types";

const CLOSE_TOLERANCE_M = 0.35;
const DEFAULT_ALTURA_M = 2.5;
const SNAP_ROOMS_M = 0.3;

function trasladarHabitacion(p: Proyecto, id: string, dx: number, dz: number): Proyecto {
  return {
    ...p,
    habitaciones: p.habitaciones.map((h) => (h.id === id ? { ...h, puntos: h.puntos.map((pt) => ({ x: pt.x + dx, z: pt.z + dz })) } : h)),
    objetos: p.objetos.map((o) => (o.habitacionId === id ? { ...o, x: o.x + dx, z: o.z + dz } : o)),
  };
}

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
  const [mode, setMode] = useState<"cuarto" | "mapa">("cuarto");
  const [placing, setPlacing] = useState<string | null>(null);
  const [selectedObjetoId, setSelectedObjetoId] = useState<string | null>(null);
  const [categoria, setCategoria] = useState<TipoHabitacion>("sala");
  const svgRef = useRef<SVGSVGElement>(null);

  const selected = proyecto.habitaciones.find((h) => h.id === selectedId) ?? null;
  const isMap = mode === "mapa";
  const drawing = !selected && !isMap;
  const selectedObjeto = proyecto.objetos.find((o) => o.id === selectedObjetoId) ?? null;
  const objetosDeSelected = selected ? proyecto.objetos.filter((o) => o.habitacionId === selected.id) : [];

  function updateSelected(fn: (h: Habitacion) => Habitacion) {
    setProyecto((p) => ({
      ...p,
      habitaciones: p.habitaciones.map((h) => (h.id === selectedId ? fn(h) : h)),
    }));
  }

  function habitacionEn(p: Point): Habitacion | undefined {
    return proyecto.habitaciones.find((h) => h.puntos.length >= 3 && pointInPolygon(p, h.puntos));
  }

  function updateObjeto(id: string, patch: Partial<Objeto>) {
    setProyecto((p) => ({ ...p, objetos: p.objetos.map((o) => (o.id === id ? { ...o, ...patch } : o)) }));
  }

  function deleteObjeto(id: string) {
    setProyecto((p) => ({ ...p, objetos: p.objetos.filter((o) => o.id !== id) }));
    setSelectedObjetoId((cur) => (cur === id ? null : cur));
  }

  function duplicateObjeto(o: Objeto) {
    const copia = { ...o, id: crypto.randomUUID(), x: o.x + 0.3, z: o.z + 0.3 };
    setProyecto((p) => ({ ...p, objetos: [...p.objetos, copia] }));
    setSelectedObjetoId(copia.id);
  }

  function handlePlace(p: Point) {
    if (!placing) return;
    const nuevo = nuevoObjeto(placing, p.x, p.z, habitacionEn(p)?.id ?? null);
    if (!nuevo) return;
    setProyecto((pr) => ({ ...pr, objetos: [...pr.objetos, nuevo] }));
    setSelectedObjetoId(nuevo.id);
  }

  function addKit(kit: Kit) {
    const room = selected;
    const area = room
      ? polygonBounds(room.puntos)
      : { minX: 0.5, maxX: 6.5, minZ: 0.5, maxZ: 0.5 };
    const items = colocarKit(kit, area, room?.id ?? null);
    setProyecto((p) => ({ ...p, objetos: [...p.objetos, ...items] }));
    setPlacing(null);
    setSelectedObjetoId(null);
  }

  function pickObjeto(defId: string | null) {
    setPlacing(defId);
    if (defId) {
      setSelectedObjetoId(null);
      setView("2d");
    }
  }

  const drag = usePlanDrag({
    onObjetoMove: (id, c) => updateObjeto(id, { x: c.x, z: c.z }),
    onObjetoDrop: (id) =>
      setProyecto((pr) => {
        const o = pr.objetos.find((x) => x.id === id);
        if (!o) return pr;
        const hab = pr.habitaciones.find((h) => h.puntos.length >= 3 && pointInPolygon({ x: o.x, z: o.z }, h.puntos));
        return { ...pr, objetos: pr.objetos.map((x) => (x.id === id ? { ...x, habitacionId: hab?.id ?? null } : x)) };
      }),
    onHabitacionMove: (id, dx, dz) =>
      setProyecto((pr) => {
        const h = pr.habitaciones.find((x) => x.id === id);
        if (!h) return pr;
        // No se deja salir del lienzo (coordenadas negativas quedarían fuera de la vista).
        const b = polygonBounds(h.puntos);
        return trasladarHabitacion(pr, id, Math.max(dx, -b.minX), Math.max(dz, -b.minZ));
      }),
    onHabitacionDrop: (id) =>
      setProyecto((pr) => {
        const h = pr.habitaciones.find((x) => x.id === id);
        if (!h) return pr;
        const otros = pr.habitaciones.filter((x) => x.id !== id && x.puntos.length >= 3).map((x) => polygonBounds(x.puntos));
        const { dx, dz } = snapBoundsToNeighbors(polygonBounds(h.puntos), otros, SNAP_ROOMS_M);
        if (dx === 0 && dz === 0) return pr;
        const b = polygonBounds(h.puntos);
        return trasladarHabitacion(pr, id, Math.max(dx, -b.minX), Math.max(dz, -b.minZ));
      }),
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA")) return;
      if (e.key === "Escape") setPlacing(null);
      else if ((e.key === "Delete" || e.key === "Backspace") && selectedObjetoId) {
        e.preventDefault();
        deleteObjeto(selectedObjetoId);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // deleteObjeto solo usa setState funcional.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedObjetoId]);

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
    setSelectedObjetoId(null);
    setPlacing(null);
    setMode("cuarto");
    setView("2d");
  }

  function deleteRoom(id: string) {
    if (!window.confirm("¿Eliminar esta habitación (y los objetos que tiene dentro)? No se puede deshacer.")) return;
    setProyecto((p) => ({
      ...p,
      habitaciones: p.habitaciones.filter((h) => h.id !== id),
      objetos: p.objetos.filter((o) => o.habitacionId !== id),
    }));
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

  const areaM2 = isMap
    ? proyecto.habitaciones.reduce((sum, h) => sum + polygonArea(h.puntos), 0)
    : selected
      ? polygonArea(selected.puntos)
      : 0;
  const perimetroM = isMap
    ? proyecto.habitaciones.reduce((sum, h) => sum + polygonPerimeter(h.puntos), 0)
    : selected
      ? polygonPerimeter(selected.puntos)
      : 0;
  const puedeExportar = isMap ? proyecto.habitaciones.length > 0 : !!selected;

  async function handleExport(kind: "png" | "pdf") {
    if (!puedeExportar || !svgRef.current) return;
    const nombre = isMap ? `${proyecto.nombre} - plano completo` : (selected as Habitacion).nombre;
    const meta = { nombre, areaM2, perimetroM };
    if (kind === "png") await exportPlanAsPng(svgRef.current, meta);
    else await exportPlanAsPdf(svgRef.current, meta);
  }

  const placingDef = placing ? objetoDef(placing) : undefined;
  const habitacionesVista = isMap ? proyecto.habitaciones : selected ? [selected] : [];
  const objetosVista = isMap ? proyecto.objetos : objetosDeSelected;

  return (
    <div className="construccion-editor">
      <aside className="construccion-editor__sidebar">
        <div className="construccion-editor__view-toggle construccion-editor__mode-toggle">
          <button
            onClick={() => {
              setMode("cuarto");
              setPlacing(null);
              if (!selectedId && proyecto.habitaciones.length > 0) setSelectedId(proyecto.habitaciones[0].id);
            }}
            className={`construccion-editor__view-btn${!isMap ? " construccion-editor__view-btn--active" : ""}`}
          >
            Un cuarto
          </button>
          <button
            onClick={() => {
              setMode("mapa");
              setDraftPoints([]);
              setPlacing(null);
            }}
            className={`construccion-editor__view-btn${isMap ? " construccion-editor__view-btn--active" : ""}`}
          >
            Plano completo
          </button>
        </div>
        <button onClick={startNewRoom} className="btn btn-primary construccion-editor__new-btn">
          + Nueva habitación
        </button>
        <ul className="construccion-editor__rooms">
          {proyecto.habitaciones.map((h) => (
            <li key={h.id}>
              <button
                onClick={() => {
                  setSelectedId(h.id);
                  setSelectedObjetoId(null);
                  setDraftPoints([]);
                  if (h.tipo && h.tipo !== "otro") setCategoria(h.tipo);
                }}
                className={`construccion-editor__room${h.id === selectedId ? " construccion-editor__room--active" : ""}`}
              >
                <span className="construccion-editor__room-name">
                  <span className="construccion-editor__room-dot" style={{ background: zonaDe(h.tipo).color }} />
                  {h.nombre}
                </span>
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
        {!drawing && (
          <ObjetosPalette categoria={categoria} onCategoria={setCategoria} placing={placing} onPick={pickObjeto} onKit={addKit} />
        )}
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
              {selected ? (
                <>
                  <input
                    value={selected.nombre}
                    onChange={(e) => updateSelected((h) => ({ ...h, nombre: e.target.value }))}
                    className="construccion-editor__name-input"
                  />
                  <label className="construccion-editor__altura-field">
                    Zona
                    <select
                      value={selected.tipo ?? "otro"}
                      onChange={(e) => {
                        const tipo = e.target.value as TipoHabitacion;
                        updateSelected((h) => ({ ...h, tipo }));
                        if (tipo !== "otro") setCategoria(tipo);
                      }}
                      className="construccion-editor__abertura-select"
                    >
                      {ZONAS.map((z) => (
                        <option key={z.id} value={z.id}>
                          {z.nombre}
                        </option>
                      ))}
                    </select>
                  </label>
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
                </>
              ) : (
                <span className="construccion-editor__hint-text">
                  Arrastra las habitaciones para juntarlas — se pegan solas a las paredes vecinas. Arrastra también los objetos.
                </span>
              )}
              <div className="construccion-editor__view-toggle">
                <button
                  onClick={() => setView("2d")}
                  className={`construccion-editor__view-btn${view === "2d" ? " construccion-editor__view-btn--active" : ""}`}
                >
                  Plano 2D
                </button>
                <button
                  onClick={() => {
                    setView("3d");
                    setPlacing(null);
                  }}
                  className={`construccion-editor__view-btn${view === "3d" ? " construccion-editor__view-btn--active" : ""}`}
                >
                  Vista 3D
                </button>
              </div>
              {placingDef && (
                <span className="construccion-editor__placing">
                  Colocando: <strong>{placingDef.nombre}</strong> — clic en el plano
                  <button onClick={() => setPlacing(null)} className="btn btn-outline btn-sm">
                    Listo
                  </button>
                </span>
              )}
            </div>
          )}

          {puedeExportar && !drawing && (
            <div className="construccion-editor__topbar-right">
              <button onClick={() => handleExport("png")} className="btn btn-outline btn-sm" disabled={view === "3d"}>
                Exportar PNG
              </button>
              <button onClick={() => handleExport("pdf")} className="btn btn-outline btn-sm" disabled={view === "3d"}>
                Exportar PDF
              </button>
            </div>
          )}
        </div>

        <div className="construccion-editor__canvas">
          {view === "3d" && !drawing ? (
            <Suspense fallback={<div className="construccion-3d-empty">Cargando visor 3D…</div>}>
              <RoomPreview habitaciones={habitacionesVista} objetos={objetosVista} />
            </Suspense>
          ) : isMap ? (
            <PlanMap2D
              ref={svgRef}
              habitaciones={proyecto.habitaciones}
              objetos={proyecto.objetos}
              selectedId={selectedId}
              selectedObjetoId={selectedObjetoId}
              drag={drag}
              placing={!!placing}
              onPlace={handlePlace}
              onSelectRoom={setSelectedId}
              onSelectObjeto={setSelectedObjetoId}
            />
          ) : (
            <PlanCanvas2D
              ref={svgRef}
              draftPoints={draftPoints}
              habitacion={selected}
              onCanvasClick={handleCanvasClick}
              onWallClick={handleWallClick}
              objetos={objetosDeSelected}
              selectedObjetoId={selectedObjetoId}
              drag={drag}
              placing={!!placing}
              onPlace={handlePlace}
              onObjetoSelect={setSelectedObjetoId}
            />
          )}
        </div>

        {!drawing && (
          <div className="construccion-editor__footer">
            <div className="construccion-editor__metrics">
              {isMap ? "Total" : "Área"}: <strong>{areaM2.toFixed(2)} m²</strong> · Perímetro:{" "}
              <strong>{perimetroM.toFixed(2)} m</strong>
              {isMap && (
                <>
                  {" "}
                  · {proyecto.habitaciones.length} habitación(es) · {proyecto.objetos.length} objeto(s)
                </>
              )}
            </div>
            {selectedObjeto && (
              <div className="construccion-editor__aberturas">
                <p className="construccion-editor__aberturas-hint">
                  Objeto seleccionado: <strong>{objetoDef(selectedObjeto.tipo)?.nombre ?? selectedObjeto.tipo}</strong> — arrástralo
                  para moverlo (Supr para borrarlo)
                </p>
                <div className="construccion-editor__abertura-row">
                  <label className="construccion-editor__abertura-label">
                    ancho
                    <input
                      type="number"
                      step={0.05}
                      min={0.1}
                      value={selectedObjeto.anchoM}
                      onChange={(e) => updateObjeto(selectedObjeto.id, { anchoM: Number(e.target.value) || selectedObjeto.anchoM })}
                      className="construccion-editor__abertura-input"
                    />
                    m
                  </label>
                  <label className="construccion-editor__abertura-label">
                    largo
                    <input
                      type="number"
                      step={0.05}
                      min={0.1}
                      value={selectedObjeto.largoM}
                      onChange={(e) => updateObjeto(selectedObjeto.id, { largoM: Number(e.target.value) || selectedObjeto.largoM })}
                      className="construccion-editor__abertura-input"
                    />
                    m
                  </label>
                  <button
                    onClick={() => updateObjeto(selectedObjeto.id, { rotDeg: (selectedObjeto.rotDeg + 90) % 360 })}
                    className="btn btn-outline btn-sm"
                  >
                    Girar 90°
                  </button>
                  <button onClick={() => duplicateObjeto(selectedObjeto)} className="btn btn-outline btn-sm">
                    Duplicar
                  </button>
                  <button onClick={() => deleteObjeto(selectedObjeto.id)} className="construccion-editor__abertura-delete">
                    eliminar
                  </button>
                </div>
              </div>
            )}
            {selected && !isMap && (
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
            )}
          </div>
        )}
      </main>
    </div>
  );
}
