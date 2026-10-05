import { useEffect, useState } from "react";
import { db } from "../../lib/dataStore";
import { describeSyncError } from "../../lib/construccion/sync";
import { datosDePropiedad, resumenEnTexto } from "../../lib/construccion/propiedad";
import type { Proyecto } from "../../lib/construccion/types";

type PropiedadLite = {
  id: string;
  title: string;
  area_m2?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  parking?: number | null;
  altura_libre?: number | null;
  acabados?: string | null;
  techumbre?: string | null;
};

type Campo = { clave: "area_m2" | "bedrooms" | "bathrooms" | "parking" | "altura_libre" | "acabados" | "techumbre"; etiqueta: string; nuevo: number | string | null };

/** "Llenar la propiedad desde el plano": cuenta zonas del plano y las pasa a la ficha de una propiedad. */
export default function DatosPropiedad({ proyecto }: { proyecto: Proyecto }) {
  const datos = datosDePropiedad(proyecto);
  const [propiedades, setPropiedades] = useState<PropiedadLite[]>([]);
  const [cargaError, setCargaError] = useState<string | null>(null);
  const [propiedadId, setPropiedadId] = useState("");
  const [marcados, setMarcados] = useState<Record<string, boolean>>({});
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
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
  }, []);

  const propiedad = propiedades.find((p) => p.id === propiedadId) ?? null;
  const campos: Campo[] = [
    { clave: "area_m2", etiqueta: "Superficie construida (m²)", nuevo: datos.areaM2 },
    { clave: "bedrooms", etiqueta: "Recámaras", nuevo: datos.recamaras },
    { clave: "bathrooms", etiqueta: "Baños", nuevo: datos.banos },
    { clave: "parking", etiqueta: "Cajones de estacionamiento", nuevo: datos.cajones },
    { clave: "altura_libre", etiqueta: "Altura libre (m)", nuevo: datos.alturaLibreM },
    { clave: "acabados", etiqueta: "Acabados", nuevo: datos.acabados || null },
    { clave: "techumbre", etiqueta: "Techumbre", nuevo: datos.techumbre || null },
  ];
  const aplicables = campos.filter((c) => c.nuevo !== null && c.nuevo !== "");
  const estaMarcado = (c: Campo) => marcados[c.clave] ?? true;

  async function aplicar() {
    if (!propiedad) return;
    const patch: Record<string, number | string> = {};
    for (const c of aplicables) if (estaMarcado(c)) patch[c.clave] = c.nuevo as number | string;
    if (Object.keys(patch).length === 0) return;
    setGuardando(true);
    setMensaje(null);
    try {
      await db.applyConstruccionToProperty(propiedad.id, patch);
      setPropiedades((lista) => lista.map((p) => (p.id === propiedad.id ? { ...p, ...patch } : p)));
      setMensaje({ ok: true, texto: `Listo: se actualizó «${propiedad.title}» (${Object.keys(patch).length} campo${Object.keys(patch).length === 1 ? "" : "s"}).` });
    } catch (e) {
      setMensaje({ ok: false, texto: describeSyncError(e) });
    } finally {
      setGuardando(false);
    }
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(resumenEnTexto(proyecto, datos));
      setMensaje({ ok: true, texto: "Resumen copiado al portapapeles." });
    } catch {
      setMensaje({ ok: false, texto: "No se pudo copiar; selecciona el texto de abajo a mano." });
    }
  }

  return (
    <section className="construccion-panel__section">
      <h2 className="construccion-panel__heading">Datos para la propiedad</h2>
      <p className="construccion-panel__hint">
        Salen de las zonas del plano: recámaras y baños se cuentan por su uso (un baño de menos de 3 m² cuenta medio), los cajones salen de los autos dibujados o de la cochera.
      </p>
      <div className="construccion-panel__inline-fields">
        <label className="construccion-panel__field">
          Aplicar a la propiedad
          <select value={propiedadId} onChange={(e) => { setPropiedadId(e.target.value); setMensaje(null); }}>
            <option value="">— elige una —</option>
            {propiedades.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn btn-outline btn-sm" onClick={copiar}>
          Copiar resumen
        </button>
      </div>
      {cargaError && <p className="construccion__error">No se pudieron cargar las propiedades: {cargaError}</p>}

      {propiedad && (
        <>
          <table className="construccion-panel__plain-table">
            <thead>
              <tr>
                <th />
                <th>Campo</th>
                <th className="construccion-panel__col-right">En la propiedad</th>
                <th className="construccion-panel__col-right">Del plano</th>
              </tr>
            </thead>
            <tbody>
              {aplicables.map((c) => {
                const actual = propiedad[c.clave];
                return (
                  <tr key={c.clave}>
                    <td>
                      <input type="checkbox" checked={estaMarcado(c)} onChange={(e) => setMarcados((m) => ({ ...m, [c.clave]: e.target.checked }))} aria-label={`Aplicar ${c.etiqueta}`} />
                    </td>
                    <td>{c.etiqueta}</td>
                    <td className="construccion-panel__col-right construccion-panel__muted">{actual === null || actual === undefined || actual === "" ? "—" : String(actual)}</td>
                    <td className="construccion-panel__col-right">
                      <strong>{String(c.nuevo)}</strong>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <button type="button" className="btn btn-primary" onClick={aplicar} disabled={guardando}>
            {guardando ? <span className="spinner" /> : null}
            Aplicar los campos marcados
          </button>
        </>
      )}
      {mensaje && <p className={mensaje.ok ? "construccion-panel__hint" : "construccion__error"}>{mensaje.texto}</p>}
      <pre className="construccion-panel__resumen-texto">{resumenEnTexto(proyecto, datos)}</pre>
    </section>
  );
}
