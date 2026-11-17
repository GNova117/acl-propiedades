import { useEffect, useRef, useState } from "react";
import { db } from "../../lib/dataStore";
import { describeSyncError } from "../../lib/construccion/sync";

type PropiedadLite = { id: string; title: string; code?: string | null; floor_plan_url?: string | null };

/**
 * «Publicar en la ficha»: manda el plano que se ve a la ficha pública de una propiedad (sección «Plano»).
 * Es una acción deliberada: el plano se ve en internet, con sus medidas, y reemplaza al que ya tuviera.
 */
export default function PublicarPlano({ obtenerPng, disabled }: { obtenerPng: () => Promise<Blob>; disabled?: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const [propiedades, setPropiedades] = useState<PropiedadLite[]>([]);
  const [cargaError, setCargaError] = useState<string | null>(null);
  const [propiedadId, setPropiedadId] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto || propiedades.length > 0) return;
    let cancelado = false;
    db.getProperties({})
      .then((lista: PropiedadLite[]) => {
        if (!cancelado) setPropiedades(lista);
      })
      .catch((e: unknown) => {
        if (!cancelado) setCargaError(describeSyncError(e));
      });
    return () => {
      cancelado = true;
    };
  }, [abierto, propiedades.length]);

  // Escape y un clic fuera cierran el panel.
  useEffect(() => {
    if (!abierto) return undefined;
    const alTeclear = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    const alTocar = (e: MouseEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("keydown", alTeclear);
    document.addEventListener("mousedown", alTocar);
    return () => {
      document.removeEventListener("keydown", alTeclear);
      document.removeEventListener("mousedown", alTocar);
    };
  }, [abierto]);

  const propiedad = propiedades.find((p) => p.id === propiedadId) ?? null;

  async function publicar() {
    if (!propiedad) return;
    setEnviando(true);
    setMensaje(null);
    try {
      const png = await obtenerPng();
      const archivo = new File([png], `plano-${propiedad.id}.png`, { type: "image/png" });
      await db.setPropertyFloorPlan(propiedad.id, archivo);
      setPropiedades((lista) => lista.map((p) => (p.id === propiedad.id ? { ...p, floor_plan_url: "publicado" } : p)));
      setMensaje({ ok: true, texto: `Listo: el plano ya se ve en la ficha de «${propiedad.title}».` });
    } catch (e) {
      setMensaje({ ok: false, texto: describeSyncError(e) });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="construccion-publish" ref={raiz}>
      <button type="button" className="btn btn-outline btn-sm" aria-expanded={abierto} disabled={disabled} onClick={() => setAbierto((v) => !v)}>
        Publicar en la ficha
      </button>
      {abierto && (
        <div className="construccion-publish__panel" role="dialog" aria-label="Publicar el plano en la ficha de una propiedad">
          <label className="construccion-panel__field">
            Propiedad
            <select value={propiedadId} onChange={(e) => { setPropiedadId(e.target.value); setMensaje(null); }}>
              <option value="">— elige una —</option>
              {propiedades.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code ? `${p.title} (${p.code})` : p.title}
                </option>
              ))}
            </select>
          </label>
          {cargaError && <p className="construccion__error">No se pudieron cargar las propiedades: {cargaError}</p>}
          <p className="construccion-panel__hint">
            El plano se verá públicamente en la ficha, con sus medidas.
            {propiedad?.floor_plan_url ? " Esta propiedad ya tiene un plano: se reemplaza." : ""}
          </p>
          <div className="construccion-publish__actions">
            <button type="button" className="btn btn-primary btn-sm" disabled={!propiedad || enviando} onClick={publicar}>
              {enviando ? <span className="spinner" /> : null}
              Publicar
            </button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setAbierto(false)}>
              Cerrar
            </button>
          </div>
          {mensaje && <p className={mensaje.ok ? "construccion-panel__hint" : "construccion__error"}>{mensaje.texto}</p>}
        </div>
      )}
    </div>
  );
}
