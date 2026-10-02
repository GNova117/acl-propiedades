import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import EditorTab from "./editor-tab";
import BudgetTab from "./budget-tab";
import FotosTab from "./fotos-tab";
import SummaryTab from "./summary-tab";
import { db } from "../../lib/dataStore";
import { useAuth } from "../../context/AuthContext";
import { DEFAULT_CATALOGO } from "../../lib/construccion/budget";
import { describeSyncError } from "../../lib/construccion/sync";
import { normalizarNiveles } from "../../lib/construccion/niveles";
import type { MaterialCatalogItem, Proyecto } from "../../lib/construccion/types";

const TABS = [
  { id: "editor", label: "Editor" },
  { id: "fotos", label: "Fotos" },
  { id: "presupuesto", label: "Presupuesto" },
  { id: "resumen", label: "Resumen y ficha" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const PUSH_DEBOUNCE_MS = 800;
// Deshacer/rehacer: los cambios seguidos (un arrastre, teclear un número) se juntan en un solo paso.
const HISTORY_GROUP_MS = 500;
const HISTORY_MAX = 100;

type Props = {
  proyectoId: string;
};

export default function RoomEditor({ proyectoId }: Props) {
  const { isDemoMode } = useAuth();
  const [proyecto, setProyectoState] = useState<Proyecto | null>(null);
  const [catalogo, setCatalogo] = useState<MaterialCatalogItem[]>(DEFAULT_CATALOGO);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedNivelId, setSelectedNivelId] = useState<string>("");
  const [tab, setTab] = useState<TabId>("editor");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const proyectoPushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const catalogoPushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Historial para deshacer/rehacer. El proyecto vigente se espeja en un ref para poder calcular
  // el cambio y guardar el estado anterior SIN efectos secundarios dentro del updater de React.
  const proyectoRef = useRef<Proyecto | null>(null);
  const history = useRef<{ past: Proyecto[]; future: Proyecto[]; lastAt: number }>({ past: [], future: [], lastAt: 0 });
  const [historyCounts, setHistoryCounts] = useState({ undo: 0, redo: 0 });

  const syncHistoryCounts = () => setHistoryCounts({ undo: history.current.past.length, redo: history.current.future.length });

  // Wrapper con el tipo no-nulable que esperan las pestañas — proyecto solo es null
  // mientras carga, y las pestañas no se montan hasta que ya hay uno.
  const setProyecto: Dispatch<SetStateAction<Proyecto>> = (updater) => {
    const prev = proyectoRef.current;
    if (!prev) return;
    const next = typeof updater === "function" ? (updater as (p: Proyecto) => Proyecto)(prev) : updater;
    if (next === prev) return;
    const h = history.current;
    const now = Date.now();
    if (now - h.lastAt > HISTORY_GROUP_MS) {
      h.past.push(prev);
      if (h.past.length > HISTORY_MAX) h.past.shift();
    }
    h.lastAt = now;
    h.future = [];
    proyectoRef.current = next;
    setProyectoState(next);
    syncHistoryCounts();
  };

  const undo = useCallback(() => {
    const h = history.current;
    const prev = h.past.pop();
    const cur = proyectoRef.current;
    if (!prev || !cur) return;
    h.future.push(cur);
    h.lastAt = 0;
    proyectoRef.current = prev;
    setProyectoState(prev);
    setHistoryCounts({ undo: h.past.length, redo: h.future.length });
  }, []);

  const redo = useCallback(() => {
    const h = history.current;
    const next = h.future.pop();
    const cur = proyectoRef.current;
    if (!next || !cur) return;
    h.past.push(cur);
    h.lastAt = 0;
    proyectoRef.current = next;
    setProyectoState(next);
    setHistoryCounts({ undo: h.past.length, redo: h.future.length });
  }, []);

  // Ctrl/Cmd+Z deshace, Ctrl+Y o Ctrl+Mayús+Z rehace (salvo dentro de un campo de texto, que tiene el suyo).
  useEffect(() => {
    if (tab !== "editor") return undefined;
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (k === "y" || (k === "z" && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tab, undo, redo]);

  useEffect(() => {
    if (isDemoMode) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [remoto, remotoCatalogo] = await Promise.all([
          db.getConstruccionProyecto(proyectoId),
          db.getConstruccionCatalogo(),
        ]);
        if (cancelled) return;
        if (remoto) {
          // Por si alguna vez llega un proyecto sin niveles (fuente distinta a sync.ts, que ya
          // normaliza): nunca se quiere repintar con un `proyecto.niveles` vacío.
          const normalizado = normalizarNiveles(remoto);
          proyectoRef.current = normalizado;
          history.current = { past: [], future: [], lastAt: 0 };
          setProyectoState(normalizado);
          setSelectedNivelId(normalizado.niveles[0]?.id ?? "");
          if (normalizado.habitaciones.length > 0) setSelectedId(normalizado.habitaciones[0].id);
        }
        if (remotoCatalogo) setCatalogo(remotoCatalogo);
        else await db.pushConstruccionCatalogo(DEFAULT_CATALOGO);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(describeSyncError(err));
      } finally {
        if (!cancelled) {
          setLoading(false);
          setReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // Solo debe correr una vez por proyectoId.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyectoId, isDemoMode]);

  useEffect(() => {
    if (!ready || !proyecto) return;
    if (proyectoPushTimer.current) clearTimeout(proyectoPushTimer.current);
    proyectoPushTimer.current = setTimeout(() => {
      db.pushConstruccionProyecto(proyecto)
        .then(() => setError(null))
        .catch((err: unknown) => setError(describeSyncError(err)));
    }, PUSH_DEBOUNCE_MS);
    return () => {
      if (proyectoPushTimer.current) clearTimeout(proyectoPushTimer.current);
    };
  }, [proyecto, ready]);

  useEffect(() => {
    if (!ready) return;
    if (catalogoPushTimer.current) clearTimeout(catalogoPushTimer.current);
    catalogoPushTimer.current = setTimeout(() => {
      db.pushConstruccionCatalogo(catalogo)
        .then(() => setError(null))
        .catch((err: unknown) => setError(describeSyncError(err)));
    }, PUSH_DEBOUNCE_MS);
    return () => {
      if (catalogoPushTimer.current) clearTimeout(catalogoPushTimer.current);
    };
  }, [catalogo, ready]);

  if (isDemoMode) {
    return <p className="empty-state">Este módulo requiere Supabase conectado (sin credenciales configuradas, estás en modo demo).</p>;
  }
  if (loading) {
    return <p className="empty-state">Cargando…</p>;
  }
  if (!proyecto) {
    return <p className="empty-state">No se encontró el proyecto.</p>;
  }

  return (
    <div className="construccion">
      <header className="construccion__header">
        <input
          value={proyecto.nombre}
          onChange={(e) => setProyecto((p) => ({ ...p, nombre: e.target.value }))}
          className="construccion__title-input"
        />
        <div className="construccion__header-right">
          {error && <span className="construccion__error">{error}</span>}
          {tab === "editor" && (
            <div className="construccion__history" role="group" aria-label="Historial de cambios">
              <button type="button" className="btn btn-outline btn-sm" onClick={undo} disabled={historyCounts.undo === 0} title="Deshacer (Ctrl+Z)">
                ↶ Deshacer
              </button>
              <button type="button" className="btn btn-outline btn-sm" onClick={redo} disabled={historyCounts.redo === 0} title="Rehacer (Ctrl+Y)">
                ↷ Rehacer
              </button>
            </div>
          )}
          <nav className="construccion__tabs">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`construccion__tab${tab === t.id ? " construccion__tab--active" : ""}`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {tab === "editor" && (
        <EditorTab
          proyecto={proyecto}
          setProyecto={setProyecto}
          selectedId={selectedId}
          setSelectedId={setSelectedId}
          selectedNivelId={selectedNivelId}
          setSelectedNivelId={setSelectedNivelId}
        />
      )}
      {tab === "fotos" && <FotosTab proyecto={proyecto} />}
      {tab === "presupuesto" && <BudgetTab proyecto={proyecto} catalogo={catalogo} setCatalogo={setCatalogo} />}
      {tab === "resumen" && <SummaryTab proyecto={proyecto} catalogo={catalogo} />}
    </div>
  );
}
