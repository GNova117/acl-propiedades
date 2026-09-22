import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import EditorTab from "./editor-tab";
import BudgetTab from "./budget-tab";
import SummaryTab from "./summary-tab";
import { db } from "../../lib/dataStore";
import { useAuth } from "../../context/AuthContext";
import { DEFAULT_CATALOGO } from "../../lib/construccion/budget";
import { describeSyncError } from "../../lib/construccion/sync";
import type { MaterialCatalogItem, Proyecto } from "../../lib/construccion/types";

const TABS = [
  { id: "editor", label: "Editor" },
  { id: "presupuesto", label: "Presupuesto" },
  { id: "resumen", label: "Resumen y ficha" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const PUSH_DEBOUNCE_MS = 800;

type Props = {
  proyectoId: string;
};

export default function RoomEditor({ proyectoId }: Props) {
  const { isDemoMode } = useAuth();
  const [proyecto, setProyectoState] = useState<Proyecto | null>(null);
  const [catalogo, setCatalogo] = useState<MaterialCatalogItem[]>(DEFAULT_CATALOGO);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("editor");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const proyectoPushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const catalogoPushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Wrapper con el tipo no-nulable que esperan las pestañas — proyecto solo es null
  // mientras carga, y las pestañas no se montan hasta que ya hay uno.
  const setProyecto: Dispatch<SetStateAction<Proyecto>> = (updater) => {
    setProyectoState((prev) => {
      if (!prev) return prev;
      return typeof updater === "function" ? (updater as (p: Proyecto) => Proyecto)(prev) : updater;
    });
  };

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
          setProyectoState(remoto);
          if (remoto.habitaciones.length > 0) setSelectedId(remoto.habitaciones[0].id);
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
        <EditorTab proyecto={proyecto} setProyecto={setProyecto} selectedId={selectedId} setSelectedId={setSelectedId} />
      )}
      {tab === "presupuesto" && <BudgetTab proyecto={proyecto} catalogo={catalogo} setCatalogo={setCatalogo} />}
      {tab === "resumen" && <SummaryTab proyecto={proyecto} catalogo={catalogo} />}
    </div>
  );
}
