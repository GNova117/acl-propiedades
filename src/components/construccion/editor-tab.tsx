import { lazy, Suspense, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import PlanCanvas2D from "./plan-canvas-2d";
import PlanMap2D from "./plan-map-2d";
import ObjetosPalette from "./objetos-palette";
import WallLengthsPanel from "./wall-lengths-panel";
import ZonasPanel from "./zonas-panel";
import { aplicarDivisor, cambiarMedidaZona } from "../../lib/construccion/divisores";
import { usePlanDrag } from "./plan-drag";
import { gridStep, usePlanViewport } from "./use-plan-viewport";
import {
  appendByMeasure,
  clampOpeningsToWalls,
  closingGap,
  moveVertex,
  pointInPolygon,
  polygonArea,
  polygonBounds,
  polygonPerimeter,
  setWallLength,
  snapBoundsToNeighbors,
  snapToAxes,
  unionBounds,
  wallSegmentsFromPolygon,
  type Bounds,
  type Point,
} from "../../lib/construccion/geometry";
import { cortarPorMedida, dividirHabitacion, puntoEnBorde } from "../../lib/construccion/dividir";
import { ZONAS, zonaDe, colocarKit, nuevoObjeto, objetoDef, type Kit } from "../../lib/construccion/objetos";
import { exportPlanAsPdf, exportPlanAsPng } from "../../lib/construccion/export-plan";
import { downloadDxf } from "../../lib/construccion/exportDxf";
import { db } from "../../lib/dataStore";
import { compressImageFile } from "../../lib/imageCompression";
import {
  ABERTURA_DEFAULTS,
  type Abertura,
  type FondoNivel,
  type Habitacion,
  type Objeto,
  type Proyecto,
  type TipoAbertura,
  type TipoHabitacion,
} from "../../lib/construccion/types";
import { crearNivel, duplicarNivel, elevacionesPorNivel, nombreNivelSugerido, quitarNivel } from "../../lib/construccion/niveles";
import { estadisticasHabitacion } from "../../lib/construccion/stats";

const CLOSE_TOLERANCE_PX = 14;
const ALIGN_TOLERANCE_PX = 10;
const DEFAULT_ALTURA_M = 2.5;
const SNAP_ROOMS_M = 0.3;

/** Giros disponibles al dibujar por medidas (+ = a la derecha en la pantalla). */
const GIROS = [
  { value: "90", label: "90° a la derecha" },
  { value: "-90", label: "90° a la izquierda" },
  { value: "45", label: "45° a la derecha" },
  { value: "-45", label: "45° a la izquierda" },
  { value: "135", label: "135° a la derecha" },
  { value: "-135", label: "135° a la izquierda" },
  { value: "0", label: "Seguir recto" },
];

/** Caja que encierra habitaciones y objetos (para ajustar la vista y para exportar). */
function contentBoxOf(habs: Habitacion[], objs: Objeto[], fondo?: FondoNivel | null): Bounds | null {
  const boxes = habs.filter((h) => h.puntos.length > 0).map((h) => polygonBounds(h.puntos));
  for (const o of objs) {
    const r = Math.max(o.anchoM, o.largoM) / 2;
    boxes.push({ minX: o.x - r, maxX: o.x + r, minZ: o.z - r, maxZ: o.z + r });
  }
  // El fondo entra al ajuste de vista (para que se vea completo al cambiar de nivel/modo), pero no
  // a la exportación — exportPlanAsPng/Pdf siguen recortando solo a cuartos y muebles.
  if (fondo) boxes.push({ minX: fondo.xM, maxX: fondo.xM + fondo.widthM, minZ: fondo.zM, maxZ: fondo.zM + fondo.heightM });
  return unionBounds(boxes);
}

// Las sumas repetidas dejan ruido de punto flotante (6.4999999999999964): se redondea a 0.1 mm.
const r4 = (v: number) => Math.round(v * 10_000) / 10_000;

function trasladarHabitacion(p: Proyecto, id: string, dx: number, dz: number): Proyecto {
  return {
    ...p,
    habitaciones: p.habitaciones.map((h) => (h.id === id ? { ...h, puntos: h.puntos.map((pt) => ({ x: r4(pt.x + dx), z: r4(pt.z + dz) })) } : h)),
    objetos: p.objetos.map((o) => (o.habitacionId === id ? { ...o, x: r4(o.x + dx), z: r4(o.z + dz) } : o)),
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
  /** El proyecto siempre llega con al menos un nivel (se normaliza al cargarlo). */
  selectedNivelId: string;
  setSelectedNivelId: Dispatch<SetStateAction<string>>;
};

export default function EditorTab({ proyecto, setProyecto, selectedId, setSelectedId, selectedNivelId, setSelectedNivelId }: Props) {
  const currentNivel = proyecto.niveles.find((n) => n.id === selectedNivelId) ?? proyecto.niveles[0];
  const [edificioCompleto, setEdificioCompleto] = useState(false);
  const [draftPoints, setDraftPoints] = useState<Point[]>([]);
  const [view, setView] = useState<"2d" | "3d">("2d");
  const [mode, setMode] = useState<"cuarto" | "mapa">("mapa");
  const [placing, setPlacing] = useState<string | null>(null);
  const [selectedObjetoId, setSelectedObjetoId] = useState<string | null>(null);
  const [categoria, setCategoria] = useState<TipoHabitacion>("sala");
  const [medida, setMedida] = useState("");
  const [giro, setGiro] = useState("90");
  const [highlightWall, setHighlightWall] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const medidaRef = useRef<HTMLInputElement>(null);

  // Fondo (plano/croquis para calcar) — no vive en `proyecto` (igual que las fotos): tiene su
  // propia tabla sin cascada hacia nivel_id, para no perderse con cada guardado del plano.
  const [fondos, setFondos] = useState<Record<string, FondoNivel>>({});
  const [fondoMoving, setFondoMoving] = useState(false);
  const [fondoLoading, setFondoLoading] = useState(false);
  const [pendingFondoFile, setPendingFondoFile] = useState<File | null>(null);
  const [pendingWidthM, setPendingWidthM] = useState("10");
  const fondoPosRef = useRef<{ xM: number; zM: number } | null>(null);
  const fondoOpacityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Croquis a borrador con IA — ver server/sketchToPlan.js. No se guarda ningún estado aparte
  // (a diferencia de fotos/fondo): el resultado se vuelve habitaciones normales de una vez.
  const [sketchLoading, setSketchLoading] = useState(false);
  const [sketchError, setSketchError] = useState<string | null>(null);
  const [sketchCostUsd, setSketchCostUsd] = useState<number | null>(null);

  // Contorno y división en "Plano completo": se dibuja el área de la casa y luego se parte en cuartos.
  const [mapDrawing, setMapDrawing] = useState(false);
  const [corteMuro, setCorteMuro] = useState("0");
  const [corteDist, setCorteDist] = useState("");
  const [splitting, setSplitting] = useState(false);
  const [splitFromState, setSplitFromState] = useState<{ roomId: string; point: Point } | null>(null);
  const [splitMsg, setSplitMsg] = useState<string | null>(null);

  const nivelIdsKey = proyecto.niveles.map((n) => n.id).join(",");
  useEffect(() => {
    const ids = nivelIdsKey ? nivelIdsKey.split(",") : [];
    if (ids.length === 0) {
      setFondos({});
      return;
    }
    db.getConstruccionFondos(ids)
      .then(setFondos)
      .catch(() => setFondos({}));
  }, [nivelIdsKey]);

  const selected = proyecto.habitaciones.find((h) => h.id === selectedId) ?? null;
  const isMap = mode === "mapa";
  const drawing = (!selected && !isMap) || mapDrawing;
  const splitRoom = isMap && splitting && selected && selected.nivelId === selectedNivelId ? selected : null;
  // El primer clic del corte solo vale mientras siga seleccionado el mismo cuarto.
  const splitFrom = splitFromState && splitFromState.roomId === selectedId ? splitFromState.point : null;
  const mapTool = isMap ? (mapDrawing ? "draw" : splitRoom ? "split" : null) : null;
  const selectedObjeto = proyecto.objetos.find((o) => o.id === selectedObjetoId) ?? null;
  const objetosDeSelected = selected ? proyecto.objetos.filter((o) => o.habitacionId === selected.id) : [];
  // "Plano completo" muestra un nivel a la vez (cada piso es su propio plano) — el edificio entero
  // solo se ve apilado en la Vista 3D, con el interruptor de más abajo.
  const nivelHabitaciones = proyecto.habitaciones.filter((h) => h.nivelId === selectedNivelId);
  const nivelObjetos = proyecto.objetos.filter((o) => o.nivelId === selectedNivelId);

  const habitacionesVista = isMap ? nivelHabitaciones : selected ? [selected] : [];
  const objetosVista = isMap ? nivelObjetos : objetosDeSelected;
  // El fondo solo se ve (y se ajusta la vista a él) en "Plano completo" — en un cuarto solo
  // estorbaría al calcar justo esa habitación.
  const fondo = isMap ? fondos[selectedNivelId] ?? null : null;
  const contentBox = contentBoxOf(habitacionesVista, objetosVista, fondo);
  // La vista se ajusta sola solo al cambiar de cuarto, de nivel o de modo; mientras se edita no se mueve.
  const vp = usePlanViewport({ box: contentBox, resetKey: `${selectedNivelId}|${isMap ? "mapa" : (selected?.id ?? "nueva")}` });
  const roomStats = selected ? estadisticasHabitacion(selected, proyecto.objetos) : null;
  // Solo se calcula cuando de verdad hace falta (edificio con 2+ niveles, viendo el 3D completo).
  const elevacionPorNivel = useMemo(
    () => (edificioCompleto ? elevacionesPorNivel(proyecto) : undefined),
    [edificioCompleto, proyecto],
  );

  function updateSelected(fn: (h: Habitacion) => Habitacion) {
    setProyecto((p) => ({
      ...p,
      habitaciones: p.habitaciones.map((h) => (h.id === selectedId ? fn(h) : h)),
    }));
  }

  // Solo busca entre los cuartos del nivel actual: un objeto nunca "cae" en un cuarto de otro piso
  // aunque sus coordenadas x,z coincidan con las de abajo.
  function habitacionEn(p: Point): Habitacion | undefined {
    return nivelHabitaciones.find((h) => h.puntos.length >= 3 && pointInPolygon(p, h.puntos));
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
    const nuevo = nuevoObjeto(placing, p.x, p.z, habitacionEn(p)?.id ?? null, selectedNivelId);
    if (!nuevo) return;
    setProyecto((pr) => ({ ...pr, objetos: [...pr.objetos, nuevo] }));
    setSelectedObjetoId(nuevo.id);
  }

  function addKit(kit: Kit) {
    const room = selected;
    const area = room
      ? polygonBounds(room.puntos)
      : { minX: 0.5, maxX: 6.5, minZ: 0.5, maxZ: 0.5 };
    const items = colocarKit(kit, area, room?.id ?? null, selectedNivelId);
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
        // Un mueble solo puede caer en un cuarto de SU MISMO nivel — nunca "atraviesa" el piso.
        const hab = pr.habitaciones.find((h) => h.nivelId === o.nivelId && h.puntos.length >= 3 && pointInPolygon({ x: o.x, z: o.z }, h.puntos));
        return { ...pr, objetos: pr.objetos.map((x) => (x.id === id ? { ...x, habitacionId: hab?.id ?? null } : x)) };
      }),
    // El lienzo ya no tiene límite: las habitaciones pueden quedar en cualquier coordenada.
    onHabitacionMove: (id, dx, dz) => setProyecto((pr) => (pr.habitaciones.some((x) => x.id === id) ? trasladarHabitacion(pr, id, dx, dz) : pr)),
    onHabitacionDrop: (id) =>
      setProyecto((pr) => {
        const h = pr.habitaciones.find((x) => x.id === id);
        if (!h) return pr;
        // El imán solo pega con cuartos del MISMO nivel — dos pisos con huellas parecidas no deben
        // engancharse entre sí solo por coincidir en x,z.
        const otros = pr.habitaciones.filter((x) => x.id !== id && x.nivelId === h.nivelId && x.puntos.length >= 3).map((x) => polygonBounds(x.puntos));
        const { dx, dz } = snapBoundsToNeighbors(polygonBounds(h.puntos), otros, SNAP_ROOMS_M);
        if (dx === 0 && dz === 0) return pr;
        return trasladarHabitacion(pr, id, dx, dz);
      }),
    // Arrastrar un vértice: imán de 5 cm (en el hook) + alineación con los demás vértices del cuarto.
    onVerticeMove: (id, index, raw) =>
      setProyecto((pr) => ({
        ...pr,
        habitaciones: pr.habitaciones.map((h) => {
          if (h.id !== id) return h;
          const p = snapToAxes(raw, h.puntos.filter((_, i) => i !== index), ALIGN_TOLERANCE_PX * vp.mpp);
          const puntos = moveVertex(h.puntos, index, p);
          return { ...h, puntos, aberturas: clampOpeningsToWalls(puntos, h.aberturas) };
        }),
      })),
    // Arrastrar una divisoria compartida: los cuartos de ambos lados se reacomodan juntos.
    onDivisorMove: (div, d) =>
      setProyecto((pr) => {
        const habitaciones = aplicarDivisor(pr.habitaciones, div, d);
        return habitaciones ? { ...pr, habitaciones } : pr;
      }),
    // El fondo se mueve libre (sin imán ni límite): debe poder calzar exacto con el plano real.
    onFondoMove: (dx, dz) =>
      setFondos((prev) => {
        const f = prev[selectedNivelId];
        if (!f) return prev;
        const next = { ...f, xM: f.xM + dx, zM: f.zM + dz };
        fondoPosRef.current = { xM: next.xM, zM: next.zM };
        return { ...prev, [selectedNivelId]: next };
      }),
    onFondoDrop: () => {
      const pos = fondoPosRef.current;
      fondoPosRef.current = null;
      if (pos) db.updateConstruccionFondo(selectedNivelId, pos).catch(() => {});
    },
  });

  // Si el nivel seleccionado se borró (o el proyecto cambió de otra fuente), cae al primero que exista.
  useEffect(() => {
    if (!proyecto.niveles.some((nv) => nv.id === selectedNivelId)) setSelectedNivelId(proyecto.niveles[0]?.id ?? "");
  }, [proyecto.niveles, selectedNivelId, setSelectedNivelId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA")) return;
      if (e.key === "Escape") {
        setPlacing(null);
        setSplitting(false);
        setSplitFromState(null);
      }
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
      if (Math.hypot(p.x - first.x, p.z - first.z) <= Math.min(1, Math.max(0.15, CLOSE_TOLERANCE_PX * vp.mpp))) {
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
      nivelId: selectedNivelId,
      nombre: mapDrawing ? `Área ${proyecto.habitaciones.length + 1}` : `Habitación ${proyecto.habitaciones.length + 1}`,
      puntos: draftPoints,
      alturaM: DEFAULT_ALTURA_M,
      aberturas: [],
    };
    setProyecto((p) => ({ ...p, habitaciones: [...p.habitaciones, nueva] }));
    setSelectedId(nueva.id);
    setDraftPoints([]);
    setMapDrawing(false);
  }

  /** "Dibujar contorno" en Plano completo: se traza el área y después se divide en cuartos. */
  function startMapDrawing() {
    setSelectedId(null);
    setSelectedObjetoId(null);
    setPlacing(null);
    setSplitting(false);
    setSplitFromState(null);
    setSplitMsg(null);
    setDraftPoints([]);
    setView("2d");
    setMapDrawing(true);
  }

  function cancelMapDrawing() {
    setMapDrawing(false);
    setDraftPoints([]);
  }

  function toggleSplit() {
    setSplitMsg(null);
    setSplitFromState(null);
    setPlacing(null);
    setView("2d");
    setSplitting((s) => !s);
  }

  /** Primer clic: un punto del muro del cuarto seleccionado. Segundo clic: hacia dónde cortar (el corte llega al muro de enfrente). */
  function handleSplitClick(p: Point) {
    if (!selected) return;
    if (!splitFrom) {
      const inicio = puntoEnBorde(selected.puntos, p, Math.max(0.3, 24 * vp.mpp));
      if (!inicio) {
        setSplitMsg("Haz el primer clic sobre un muro del cuarto seleccionado.");
        return;
      }
      setSplitMsg(null);
      setSplitFromState({ roomId: selected.id, point: inicio });
      return;
    }
    const resultado = dividirHabitacion(proyecto, selected.id, splitFrom, p);
    if (!resultado) {
      setSplitMsg("Ese corte no cabe dentro del cuarto. Haz el segundo clic hacia el interior del cuarto.");
      return;
    }
    setProyecto(() => resultado.proyecto);
    setSelectedId(resultado.nuevaId); // la parte nueva queda seleccionada para ponerle nombre y zona enseguida
    setSplitting(false);
    setSplitFromState(null);
    setSplitMsg(null);
  }

  /** "Cortar a N m de un muro": parte el cuarto seleccionado con una línea paralela a ese muro. */
  function handleCortePorMedida() {
    if (!selected) return;
    const dist = Number(corteDist.replace(",", "."));
    const resultado = cortarPorMedida(proyecto, selected.id, Number(corteMuro), dist);
    if (!resultado) {
      setSplitMsg(`No se puede cortar a ${corteDist || "0"} m de ese muro: queda fuera del cuarto.`);
      return;
    }
    setProyecto(() => resultado.proyecto);
    setSelectedId(resultado.nuevaId);
    setCorteDist("");
    setSplitMsg(null);
  }

  function undoLastPoint() {
    setDraftPoints((pts) => pts.slice(0, -1));
  }

  /** Dibujar por medidas: agrega un muro de `medida` m girando `giro`° respecto al anterior. */
  function addMeasuredWall() {
    const largo = Number(medida.replace(",", "."));
    if (!(largo > 0)) return;
    const pts = appendByMeasure(draftPoints, largo, Number(giro));
    setDraftPoints(pts);
    vp.ensureVisible(pts);
    setMedida("");
    medidaRef.current?.focus();
  }

  function commitWallLength(index: number, lengthM: number) {
    if (!selected) return;
    const puntos = setWallLength(selected.puntos, index, lengthM);
    updateSelected((h) => ({ ...h, puntos, aberturas: clampOpeningsToWalls(puntos, h.aberturas) }));
    vp.ensureVisible(puntos); // si el cuarto creció más allá de la vista, la vista se ensancha para que siga a la vista
  }

  function selectNivel(id: string) {
    setMapDrawing(false);
    setSplitting(false);
    setSplitFromState(null);
    setSelectedNivelId(id);
    setSelectedId(null);
    setSelectedObjetoId(null);
    setDraftPoints([]);
    setPlacing(null);
  }

  function renameNivel(nombre: string) {
    setProyecto((p) => ({ ...p, niveles: p.niveles.map((nv) => (nv.id === selectedNivelId ? { ...nv, nombre } : nv)) }));
  }

  /** Nivel nuevo y vacío, justo arriba del actual. */
  function addNivel() {
    const nuevo = crearNivel(nombreNivelSugerido(proyecto.niveles));
    const idx = proyecto.niveles.findIndex((nv) => nv.id === selectedNivelId);
    setProyecto((p) => ({ ...p, niveles: [...p.niveles.slice(0, idx + 1), nuevo, ...p.niveles.slice(idx + 1)] }));
    selectNivel(nuevo.id);
  }

  /** Copia los cuartos (y sus muebles) del nivel actual en uno nuevo arriba — para pisos que repiten la planta de abajo. */
  function duplicateNivel() {
    const { proyecto: next, nivelNuevoId } = duplicarNivel(proyecto, selectedNivelId, { incluirObjetos: true });
    setProyecto(next);
    selectNivel(nivelNuevoId);
  }

  function deleteNivel() {
    if (proyecto.niveles.length <= 1) return;
    if (!window.confirm(`¿Eliminar "${currentNivel?.nombre}" y todo lo que contiene? No se puede deshacer.`)) return;
    const nivelIdABorrar = selectedNivelId;
    setProyecto((p) => quitarNivel(p, nivelIdABorrar));
    // La selección se corrige sola en el efecto de abajo si el nivel actual desapareció.
    // construccion_fondos tampoco cascada por nivel_id (ver nota en sync.ts) — se limpia aquí.
    if (fondos[nivelIdABorrar]) {
      db.deleteConstruccionFondo(nivelIdABorrar).catch(() => {});
      setFondos((prev) => {
        const next = { ...prev };
        delete next[nivelIdABorrar];
        return next;
      });
    }
  }

  function handleFondoFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) setPendingFondoFile(file);
  }

  async function confirmFondoUpload() {
    if (!pendingFondoFile) return;
    const widthM = Number(pendingWidthM);
    if (!(widthM > 0)) return;
    setFondoLoading(true);
    try {
      const result = await db.upsertConstruccionFondo({ proyectoId: proyecto.id, nivelId: selectedNivelId, file: pendingFondoFile, widthM });
      setFondos((prev) => ({ ...prev, [selectedNivelId]: result }));
      setPendingFondoFile(null);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : String(err));
    } finally {
      setFondoLoading(false);
    }
  }

  async function commitFondoWidth(newWidthM: number) {
    if (!fondo || !(newWidthM > 0) || newWidthM === fondo.widthM) return;
    const heightM = fondo.heightM * (newWidthM / fondo.widthM);
    setFondos((prev) => ({ ...prev, [selectedNivelId]: { ...fondo, widthM: newWidthM, heightM } }));
    try {
      await db.updateConstruccionFondo(selectedNivelId, { widthM: newWidthM, heightM });
    } catch (err) {
      window.alert(err instanceof Error ? err.message : String(err));
    }
  }

  function handleOpacidadChange(opacidad: number) {
    if (!fondo) return;
    setFondos((prev) => ({ ...prev, [selectedNivelId]: { ...fondo, opacidad } }));
    if (fondoOpacityTimer.current) clearTimeout(fondoOpacityTimer.current);
    fondoOpacityTimer.current = setTimeout(() => {
      db.updateConstruccionFondo(selectedNivelId, { opacidad }).catch(() => {});
    }, 400);
  }

  async function handleFondoRemove() {
    if (!window.confirm("¿Quitar el plano de fondo de este nivel?")) return;
    try {
      await db.deleteConstruccionFondo(selectedNivelId);
      setFondos((prev) => {
        const next = { ...prev };
        delete next[selectedNivelId];
        return next;
      });
      setFondoMoving(false);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : String(err));
    }
  }

  function startNewRoom() {
    setMapDrawing(false);
    setSplitting(false);
    setSplitFromState(null);
    setSelectedId(null);
    setDraftPoints([]);
    setSelectedObjetoId(null);
    setPlacing(null);
    setMode("cuarto");
    setView("2d");
  }

  function fileToBase64(file: File): Promise<{ base64: string; mediaType: string }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => {
        const dataUrl = String(reader.result);
        const comma = dataUrl.indexOf(",");
        resolve({ base64: dataUrl.slice(comma + 1), mediaType: dataUrl.slice(5, dataUrl.indexOf(";")) });
      };
      reader.readAsDataURL(file);
    });
  }

  /** Arma el polígono de un cuarto desde su secuencia de muros (igual que "Dibujar por medidas" a mano). */
  function habitacionDesdeMuros(
    sketch: { nombre: string; tipo: TipoHabitacion; muros: { largoM: number; giroDeg: number; confirmado: boolean }[] },
    nivelId: string,
    start: Point,
  ): Habitacion {
    let puntos: Point[] = [];
    for (const m of sketch.muros) puntos = appendByMeasure(puntos, m.largoM, m.giroDeg, start);
    const sinConfirmar = sketch.muros.some((m) => !m.confirmado);
    return {
      id: crypto.randomUUID(),
      nivelId,
      nombre: sinConfirmar ? `${sketch.nombre} (revisar medidas)` : sketch.nombre,
      tipo: ZONAS.some((z) => z.id === sketch.tipo) ? sketch.tipo : undefined,
      puntos,
      alturaM: DEFAULT_ALTURA_M,
      aberturas: [],
    };
  }

  async function handleSketchFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setSketchError(null);
    setSketchLoading(true);
    try {
      const comprimido = await compressImageFile(file);
      const { base64, mediaType } = await fileToBase64(comprimido);
      const res = await db.requestSketchToPlan({ imageBase64: base64, mediaType });
      if (res.configured === false) {
        setSketchError("La lectura de croquis con IA aún no está activada: falta la variable ANTHROPIC_API_KEY en Vercel.");
        return;
      }
      const detectadas = (res.habitaciones ?? []) as { nombre: string; tipo: TipoHabitacion; muros: { largoM: number; giroDeg: number; confirmado: boolean }[] }[];
      if (detectadas.length === 0) {
        setSketchError("No se distinguió ningún cuarto en la imagen. Prueba con una foto más clara o de más cerca.");
        return;
      }
      // Se acomodan en fila, a la derecha de lo que ya haya en el nivel, para no encimarse con nada —
      // el asesor las arrastra después a su posición real (el imán ya ayuda a pegarlas entre sí).
      const existentes = proyecto.habitaciones.filter((h) => h.nivelId === selectedNivelId && h.puntos.length >= 3).map((h) => polygonBounds(h.puntos));
      let cursorX = existentes.length > 0 ? Math.max(...existentes.map((b) => b.maxX)) + 1 : 1;
      const nuevas: Habitacion[] = [];
      for (const sketch of detectadas) {
        const hab = habitacionDesdeMuros(sketch, selectedNivelId, { x: cursorX, z: 1 });
        nuevas.push(hab);
        cursorX = polygonBounds(hab.puntos).maxX + 1;
      }
      setProyecto((p) => ({ ...p, habitaciones: [...p.habitaciones, ...nuevas] }));
      setMode("mapa");
      setSelectedId(nuevas[0].id);
      if (res.usage?.costUsd > 0) setSketchCostUsd(res.usage.costUsd);
    } catch (err) {
      const code = (err as { code?: string; limit?: number })?.code;
      if (code === "limit") setSketchError(`Ya se alcanzó el tope de consultas de hoy (${(err as { limit?: number }).limit ?? "?"} por día).`);
      else if (code === "no_table") setSketchError("Falta crear la tabla construccion_sketch_usage en Supabase (corre el bloque «Construcción · croquis a borrador con IA» de supabase/schema.sql).");
      else if (code === "no_function") setSketchError("La lectura de croquis no está disponible en este entorno (solo existe en el sitio publicado en Vercel).");
      else setSketchError(err instanceof Error ? err.message : String(err));
    } finally {
      setSketchLoading(false);
    }
  }

  function deleteRoom(id: string) {
    if (!window.confirm("¿Eliminar esta habitación (y los objetos que tiene dentro)? No se puede deshacer.")) return;
    setProyecto((p) => ({
      ...p,
      habitaciones: p.habitaciones.filter((h) => h.id !== id),
      objetos: p.objetos.filter((o) => o.habitacionId !== id),
    }));
    if (selectedId === id) setSelectedId(null);
    // construccion_fotos no cascada por habitacion_id (ver nota en sync.ts) — se limpia aquí.
    db.deleteConstruccionFotosDeHabitacion(id).catch(() => {});
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
    ? nivelHabitaciones.reduce((sum, h) => sum + polygonArea(h.puntos), 0)
    : selected
      ? polygonArea(selected.puntos)
      : 0;
  const perimetroM = isMap
    ? nivelHabitaciones.reduce((sum, h) => sum + polygonPerimeter(h.puntos), 0)
    : selected
      ? polygonPerimeter(selected.puntos)
      : 0;
  const puedeExportar = isMap ? nivelHabitaciones.length > 0 : !!selected;

  async function handleExport(kind: "png" | "pdf" | "dxf") {
    if (!puedeExportar) return;
    const nombre = isMap ? `${proyecto.nombre} - ${currentNivel?.nombre ?? "plano"}` : (selected as Habitacion).nombre;
    if (kind === "dxf") {
      downloadDxf(habitacionesVista, nombre);
      return;
    }
    if (!svgRef.current) return;
    const meta = { nombre, areaM2, perimetroM };
    if (kind === "png") await exportPlanAsPng(svgRef.current, meta, contentBox);
    else await exportPlanAsPdf(svgRef.current, meta, contentBox);
  }

  const placingDef = placing ? objetoDef(placing) : undefined;

  return (
    <div className="construccion-editor">
      <aside className="construccion-editor__sidebar">
        <div className="construccion-niveles">
          <label className="construccion-niveles__field">
            Nivel
            <select value={selectedNivelId} onChange={(e) => selectNivel(e.target.value)}>
              {proyecto.niveles.map((nv) => (
                <option key={nv.id} value={nv.id}>
                  {nv.nombre}
                </option>
              ))}
            </select>
          </label>
          <input
            value={currentNivel?.nombre ?? ""}
            onChange={(e) => renameNivel(e.target.value)}
            className="construccion-niveles__name-input"
            aria-label="Nombre del nivel"
          />
          <div className="construccion-niveles__actions">
            <button type="button" onClick={addNivel} className="btn btn-outline btn-sm" title="Nivel vacío arriba de este">
              + Nivel
            </button>
            <button type="button" onClick={duplicateNivel} className="btn btn-outline btn-sm" title="Copia los cuartos de este nivel en uno nuevo">
              Duplicar
            </button>
            {proyecto.niveles.length > 1 && (
              <button type="button" onClick={deleteNivel} className="construccion-editor__abertura-delete">
                eliminar nivel
              </button>
            )}
          </div>
        </div>
        <div className="construccion-editor__view-toggle construccion-editor__mode-toggle">
          <button
            onClick={() => {
              setMode("cuarto");
              setMapDrawing(false);
              setSplitting(false);
              setSplitFromState(null);
              setDraftPoints([]);
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
              setMapDrawing(false);
              setDraftPoints([]);
              setPlacing(null);
            }}
            className={`construccion-editor__view-btn${isMap ? " construccion-editor__view-btn--active" : ""}`}
          >
            Plano completo
          </button>
        </div>

        {isMap && (
          <div className="construccion-areas">
            <div className="construccion-areas__row">
              <button
                type="button"
                className={`btn btn-sm ${mapDrawing ? "btn-primary" : "btn-outline"}`}
                onClick={mapDrawing ? cancelMapDrawing : startMapDrawing}
                title="Traza el área completa (por ejemplo la huella de la casa) para después dividirla en cuartos"
              >
                {mapDrawing ? "Cancelar contorno" : "Dibujar contorno"}
              </button>
              <button
                type="button"
                className={`btn btn-sm ${splitRoom ? "btn-primary" : "btn-outline"}`}
                onClick={toggleSplit}
                disabled={!selected || mapDrawing}
                title="Parte el cuarto seleccionado en dos con una línea recta"
              >
                {splitRoom ? "Cancelar corte" : "Dividir cuarto"}
              </button>
            </div>
            {selected && !mapDrawing && selected.nivelId === selectedNivelId && (
              <form
                className="construccion-areas__row construccion-areas__medida"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleCortePorMedida();
                }}
              >
                <span>Cortar a</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step={0.05}
                  min={0.1}
                  value={corteDist}
                  onChange={(e) => setCorteDist(e.target.value)}
                  placeholder="3.50"
                  className="construccion-editor__abertura-input"
                  aria-label="Distancia del corte en metros"
                />
                <span>m del</span>
                <select value={corteMuro} onChange={(e) => setCorteMuro(e.target.value)} className="construccion-editor__abertura-select" aria-label="Muro de referencia">
                  {wallSegmentsFromPolygon(selected.puntos).map((w, i) => (
                    <option key={i} value={i}>
                      muro {i + 1} ({w.length.toFixed(2)} m)
                    </option>
                  ))}
                </select>
                <button type="submit" className="btn btn-outline btn-sm" disabled={!(Number(corteDist.replace(",", ".")) > 0)}>
                  Cortar
                </button>
              </form>
            )}
            {splitMsg && !splitRoom && <p className="construccion__error">{splitMsg}</p>}
            {mapDrawing && (
              <p className="construccion-panel__hint">Clic en cada esquina del área (o teclea el largo de cada muro arriba). Se cierra tocando el primer punto, en verde.</p>
            )}
            {splitRoom && (
              <p className={splitMsg ? "construccion__error" : "construccion-panel__hint"}>
                {splitMsg ??
                  (splitFrom
                    ? "Ahora haz clic hacia dónde cortar: la línea llega sola hasta el muro de enfrente (Esc cancela)."
                    : `Haz clic sobre un muro de «${splitRoom.nombre}» donde empieza el corte.`)}
              </p>
            )}
            {!mapDrawing && !splitRoom && (
              <p className="construccion-panel__hint">
                {nivelHabitaciones.length === 0
                  ? "Dibuja el contorno de la casa y luego divídelo en cuartos."
                  : selected
                    ? "«Dividir cuarto» parte el cuarto seleccionado en dos."
                    : "Selecciona un cuarto de la lista para dividirlo."}
              </p>
            )}
          </div>
        )}

        {isMap && (
          <div className="construccion-fondo">
            {!fondo ? (
              <label className="btn btn-outline btn-sm construccion-fondo__upload" style={{ cursor: "pointer" }}>
                <input type="file" accept="image/*" hidden onChange={handleFondoFileSelect} />
                Subir plano de fondo
              </label>
            ) : (
              <>
                <div className="construccion-fondo__row">
                  <label className="construccion-fondo__field">
                    Ancho real (m)
                    <input
                      key={`${fondo.nivelId}-${fondo.widthM}`}
                      type="number"
                      min="0.1"
                      step="0.1"
                      defaultValue={fondo.widthM}
                      onBlur={(e) => commitFondoWidth(Number(e.target.value) || fondo.widthM)}
                    />
                  </label>
                  <label className="construccion-fondo__field">
                    Opacidad
                    <input
                      type="range"
                      min="0.1"
                      max="1"
                      step="0.05"
                      value={fondo.opacidad}
                      onChange={(e) => handleOpacidadChange(Number(e.target.value))}
                    />
                  </label>
                </div>
                <div className="construccion-fondo__row">
                  <button
                    type="button"
                    className={`btn btn-sm ${fondoMoving ? "btn-primary" : "btn-outline"}`}
                    onClick={() => setFondoMoving((m) => !m)}
                  >
                    {fondoMoving ? "Dejar de mover" : "Mover"}
                  </button>
                  <button type="button" className="construccion-editor__abertura-delete" onClick={handleFondoRemove}>
                    quitar fondo
                  </button>
                </div>
              </>
            )}

            {pendingFondoFile && (
              <div className="construccion-fondo__pending">
                <label className="construccion-fondo__field">
                  ¿Cuántos metros mide de ancho esta imagen completa?
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={pendingWidthM}
                    onChange={(e) => setPendingWidthM(e.target.value)}
                    autoFocus
                  />
                </label>
                <div className="construccion-fondo__row">
                  <button type="button" className="btn btn-primary btn-sm" onClick={confirmFondoUpload} disabled={fondoLoading || !(Number(pendingWidthM) > 0)}>
                    {fondoLoading ? <span className="spinner" /> : null}
                    Calcar aquí
                  </button>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setPendingFondoFile(null)} disabled={fondoLoading}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <button onClick={startNewRoom} className="btn btn-primary construccion-editor__new-btn">
          + Nueva habitación
        </button>
        <label className="btn btn-outline construccion-editor__new-btn" style={{ cursor: sketchLoading ? "wait" : "pointer" }}>
          <input type="file" accept="image/*" hidden disabled={sketchLoading} onChange={handleSketchFileSelect} />
          {sketchLoading ? <span className="spinner" /> : null}
          Calcar un croquis (IA)
        </label>
        {sketchError && <p className="construccion__error">{sketchError}</p>}
        {sketchCostUsd !== null && !sketchError && (
          <p className="construccion-panel__hint">Costo aprox. de la última lectura: ${sketchCostUsd.toFixed(2)} USD</p>
        )}
        <ul className="construccion-editor__rooms">
          {nivelHabitaciones.map((h) => (
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
                Clic para poner puntos (se alinean solos) o teclea el largo de cada muro
                {draftPoints.length > 0 ? ` · ${draftPoints.length} punto(s)` : ""}
                {draftPoints.length >= 3 ? ` · ${polygonArea(draftPoints).toFixed(2)} m²` : ""}
              </span>
              <form
                className="construccion-editor__measure"
                onSubmit={(e) => {
                  e.preventDefault();
                  addMeasuredWall();
                }}
              >
                <label className="construccion-editor__abertura-label">
                  Medir muro
                  <input
                    ref={medidaRef}
                    type="number"
                    inputMode="decimal"
                    step={0.01}
                    min={0.1}
                    value={medida}
                    onChange={(e) => setMedida(e.target.value)}
                    placeholder="4.20"
                    className="construccion-editor__abertura-input"
                  />
                  m
                </label>
                {draftPoints.length >= 2 && (
                  <label className="construccion-editor__abertura-label">
                    Giro
                    <select value={giro} onChange={(e) => setGiro(e.target.value)} className="construccion-editor__abertura-select">
                      {GIROS.map((g) => (
                        <option key={g.value} value={g.value}>
                          {g.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <button type="submit" className="btn btn-outline btn-sm" disabled={!(Number(medida.replace(",", ".")) > 0)}>
                  Agregar muro
                </button>
              </form>
              {draftPoints.length > 0 && (
                <button onClick={undoLastPoint} className="btn btn-outline btn-sm">
                  Deshacer punto
                </button>
              )}
              {mapDrawing && (
                <button onClick={cancelMapDrawing} className="btn btn-outline btn-sm">
                  Cancelar
                </button>
              )}
              {draftPoints.length >= 3 && (
                <button onClick={closeDraftRoom} className="construccion-editor__confirm-btn">
                  Cerrar habitación
                  {closingGap(draftPoints) > 0.005 ? ` (último muro: ${closingGap(draftPoints).toFixed(2)} m)` : ""}
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
              {view === "3d" && proyecto.niveles.length > 1 && (
                <label className="construccion-editor__checkbox">
                  <input type="checkbox" checked={edificioCompleto} onChange={(e) => setEdificioCompleto(e.target.checked)} />
                  Ver todo el edificio
                </label>
              )}
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
              <button onClick={() => handleExport("dxf")} className="btn btn-outline btn-sm">
                Exportar DXF
              </button>
            </div>
          )}
        </div>

        <div className="construccion-editor__canvas construccion-plan-wrap" ref={vp.wrapRef}>
          {view === "3d" && !drawing ? (
            <Suspense fallback={<div className="construccion-3d-empty">Cargando visor 3D…</div>}>
              <RoomPreview
                habitaciones={edificioCompleto ? proyecto.habitaciones : habitacionesVista}
                objetos={edificioCompleto ? proyecto.objetos : objetosVista}
                elevacionPorNivel={edificioCompleto ? elevacionPorNivel : undefined}
              />
            </Suspense>
          ) : isMap ? (
            <PlanMap2D
              ref={svgRef}
              vp={vp}
              habitaciones={nivelHabitaciones}
              objetos={nivelObjetos}
              selectedId={selectedId}
              selectedObjetoId={selectedObjetoId}
              drag={drag}
              placing={!!placing}
              onPlace={handlePlace}
              onSelectRoom={setSelectedId}
              onSelectObjeto={setSelectedObjetoId}
              fondo={fondo}
              fondoDraggable={fondoMoving}
              tool={mapTool}
              draftPoints={draftPoints}
              onDrawClick={handleCanvasClick}
              splitRoom={splitRoom}
              splitFrom={splitFrom}
              onSplitClick={handleSplitClick}
            />
          ) : (
            <PlanCanvas2D
              ref={svgRef}
              vp={vp}
              highlightWall={highlightWall}
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
          {!(view === "3d" && !drawing) && (
            <div className="construccion-zoom" role="group" aria-label="Zoom del plano" title="Rueda del mouse o pellizco para acercar · arrastra el fondo para mover">
              <button type="button" onClick={vp.zoomOut} aria-label="Alejar">
                −
              </button>
              <button type="button" onClick={vp.zoomIn} aria-label="Acercar">
                +
              </button>
              <button type="button" onClick={vp.fit}>
                Ajustar
              </button>
              <span className="construccion-zoom__scale">Cuadrícula {gridStep(vp.visible.maxX - vp.visible.minX)} m</span>
            </div>
          )}
        </div>

        {!drawing && isMap && (
          <ZonasPanel
            habitaciones={nivelHabitaciones}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onRename={(id, nombre) => setProyecto((pr) => ({ ...pr, habitaciones: pr.habitaciones.map((h) => (h.id === id ? { ...h, nombre } : h)) }))}
            onTipo={(id, tipo) => {
              setProyecto((pr) => ({ ...pr, habitaciones: pr.habitaciones.map((h) => (h.id === id ? { ...h, tipo } : h)) }));
              if (tipo !== "otro") setCategoria(tipo);
            }}
            onMedida={(id, eje, valor) => {
              const habitaciones = cambiarMedidaZona(proyecto.habitaciones, id, eje, valor);
              if (!habitaciones) return false;
              setProyecto((pr) => ({ ...pr, habitaciones }));
              return true;
            }}
          />
        )}

        {!drawing && (
          <div className="construccion-editor__footer">
            <div className="construccion-editor__metrics">
              {isMap ? "Total" : "Área"}: <strong>{areaM2.toFixed(2)} m²</strong> · Perímetro:{" "}
              <strong>{perimetroM.toFixed(2)} m</strong>
              {isMap && (
                <>
                  {" "}
                  · {nivelHabitaciones.length} habitación(es) · {nivelObjetos.length} objeto(s)
                </>
              )}
              {!isMap && roomStats && (
                <>
                  {" "}
                  · Volumen: <strong>{roomStats.volumenM3.toFixed(2)} m³</strong> · Zócalo:{" "}
                  <strong>{roomStats.zocaloM.toFixed(2)} m</strong> · Puertas: <strong>{roomStats.puertas}</strong> · Ventanas:{" "}
                  <strong>{roomStats.ventanas}</strong>
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
            {selected && !isMap && <WallLengthsPanel habitacion={selected} onChange={commitWallLength} onHighlight={setHighlightWall} />}
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
