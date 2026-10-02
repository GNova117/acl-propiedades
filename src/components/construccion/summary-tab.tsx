import { useState } from "react";
import { presupuestoPorZona, valorPorZona } from "../../lib/construccion/budget";
import { db } from "../../lib/dataStore";
import { NIVELES_ACABADO, calcularPresupuesto, totalPresupuesto } from "../../lib/construccion/budget";
import { downloadFichaConstruccionPdf } from "../../lib/construccion/fichaPdf";
import { downloadPresupuestoCsv } from "../../lib/construccion/exportCsv";
import { describeSyncError } from "../../lib/construccion/sync";
import { areasPorZona, estadisticasHabitacion, estadisticasProyecto } from "../../lib/construccion/stats";
import type { FotoHabitacion, MaterialCatalogItem, Proyecto, TipoHabitacion } from "../../lib/construccion/types";

const peso = (n: number) => `$${n.toLocaleString("es-MX", { maximumFractionDigits: 0 })}`;

type Props = {
  proyecto: Proyecto;
  catalogo: MaterialCatalogItem[];
};

export default function SummaryTab({ proyecto, catalogo }: Props) {
  const [nivelId, setNivelId] = useState(NIVELES_ACABADO[1].id);
  const [precioM2Override, setPrecioM2Override] = useState<number | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  // Qué fracción del precio base vale cada uso de zona (solo se guarda en este navegador, por proyecto).
  const clave = `construccion:factores-zona:${proyecto.id}`;
  const [factores, setFactores] = useState<Partial<Record<TipoHabitacion, number>>>(() => {
    try {
      return JSON.parse(window.localStorage.getItem(clave) ?? "{}") as Partial<Record<TipoHabitacion, number>>;
    } catch {
      return {};
    }
  });
  function guardarFactor(tipo: TipoHabitacion, factor: number | null) {
    setFactores((f) => {
      const next = { ...f };
      if (factor === null) delete next[tipo];
      else next[tipo] = factor;
      try {
        window.localStorage.setItem(clave, JSON.stringify(next));
      } catch {
        /* sin almacenamiento: el cambio vale solo mientras la pestaña esté abierta */
      }
      return next;
    });
  }

  const nivelAcabado = NIVELES_ACABADO.find((n) => n.id === nivelId) ?? NIVELES_ACABADO[1];
  const precioM2 = precioM2Override ?? nivelAcabado.precioM2;

  const stats = estadisticasProyecto(proyecto);
  // El valor de mercado se calcula sobre la superficie CONSTRUIDA — un jardín o una alberca (zona
  // "Exterior") no vale lo mismo por m² que una recámara, así que no entra en este cálculo. Hasta
  // ahora esta pantalla sumaba todas las habitaciones por igual; con niveles ya es fácil separarlas.
  const areaTotalM2 = stats.construidaM2;
  const valorZonas = valorPorZona(proyecto.habitaciones, precioM2, factores);
  const valorEstimado = valorZonas.reduce((sum, z) => sum + z.valor, 0);
  const costoZonas = presupuestoPorZona(proyecto.habitaciones, catalogo);
  const presupuestoTotal = proyecto.habitaciones.reduce(
    (sum, h) => sum + totalPresupuesto(calcularPresupuesto(h, catalogo)),
    0,
  );

  async function handleExportPdf() {
    setExportingPdf(true);
    try {
      const habitacionIds = proyecto.habitaciones.map((h) => h.id);
      const fotosPorHabitacion: Record<string, FotoHabitacion[]> = await db.getConstruccionFotos(habitacionIds);
      await downloadFichaConstruccionPdf({
        proyecto,
        catalogo,
        nivelAcabado: nivelAcabado.nombre,
        precioM2,
        valorEstimado,
        valorZonas,
        fotosPorHabitacion,
      });
    } catch (err) {
      window.alert(describeSyncError(err));
    } finally {
      setExportingPdf(false);
    }
  }

  function handleExportCsv() {
    downloadPresupuestoCsv(proyecto, catalogo);
  }

  return (
    <div className="construccion-panel">
      <div className="construccion-panel__narrow">
        <section className="construccion-panel__section">
          <h2 className="construccion-panel__heading">Niveles</h2>
          {proyecto.niveles.length === 0 ? (
            <p className="empty-state">Todavía no hay niveles.</p>
          ) : (
            <table className="construccion-panel__plain-table">
              <thead>
                <tr>
                  <th>Nivel</th>
                  <th className="construccion-panel__col-right">Construida</th>
                  <th className="construccion-panel__col-right">Exterior</th>
                  <th className="construccion-panel__col-right">Volumen</th>
                  <th className="construccion-panel__col-right">Puertas</th>
                  <th className="construccion-panel__col-right">Ventanas</th>
                </tr>
              </thead>
              <tbody>
                {stats.niveles.map((n) => (
                  <tr key={n.nivel.id}>
                    <td>{n.nivel.nombre}</td>
                    <td className="construccion-panel__col-right">{n.construidaM2.toFixed(2)} m²</td>
                    <td className="construccion-panel__col-right construccion-panel__muted">{n.exteriorM2 > 0 ? `${n.exteriorM2.toFixed(2)} m²` : "—"}</td>
                    <td className="construccion-panel__col-right">{n.volumenM3.toFixed(2)} m³</td>
                    <td className="construccion-panel__col-right">{n.puertas}</td>
                    <td className="construccion-panel__col-right">{n.ventanas}</td>
                  </tr>
                ))}
              </tbody>
              {proyecto.niveles.length > 1 && (
                <tfoot>
                  <tr>
                    <td>
                      <strong>Total</strong>
                    </td>
                    <td className="construccion-panel__col-right">
                      <strong>{stats.construidaM2.toFixed(2)} m²</strong>
                    </td>
                    <td className="construccion-panel__col-right construccion-panel__muted">
                      {stats.exteriorM2 > 0 ? `${stats.exteriorM2.toFixed(2)} m²` : "—"}
                    </td>
                    <td className="construccion-panel__col-right">
                      <strong>{stats.volumenM3.toFixed(2)} m³</strong>
                    </td>
                    <td className="construccion-panel__col-right" colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </section>

        {areasPorZona(proyecto.habitaciones).length > 1 && (
          <section className="construccion-panel__section">
            <h2 className="construccion-panel__heading">Áreas por tipo de zona</h2>
            <table className="construccion-panel__plain-table">
              <tbody>
                {areasPorZona(proyecto.habitaciones).map((z) => (
                  <tr key={z.tipo}>
                    <td>
                      {z.nombre}
                      {z.zonas > 1 ? ` (${z.zonas})` : ""}
                    </td>
                    <td className="construccion-panel__col-right">{z.areaM2.toFixed(2)} m²</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <section className="construccion-panel__section">
          <h2 className="construccion-panel__heading">Habitaciones</h2>
          {proyecto.habitaciones.length === 0 ? (
            <p className="empty-state">Todavía no hay habitaciones — créalas en la pestaña Editor.</p>
          ) : (
            stats.niveles.map((n) => {
              const habsDelNivel = proyecto.habitaciones.filter((h) => h.nivelId === n.nivel.id);
              if (habsDelNivel.length === 0) return null;
              return (
                <div key={n.nivel.id} className="construccion-panel__subgroup">
                  {proyecto.niveles.length > 1 && <h3 className="construccion-panel__subheading">{n.nivel.nombre}</h3>}
                  <table className="construccion-panel__plain-table">
                    <tbody>
                      {habsDelNivel.map((h) => {
                        const e = estadisticasHabitacion(h, proyecto.objetos);
                        return (
                          <tr key={h.id}>
                            <td>
                              {h.nombre}
                              {h.tipo === "exterior" && <span className="construccion-panel__muted"> (exterior)</span>}
                            </td>
                            <td className="construccion-panel__col-right">{e.areaM2.toFixed(2)} m²</td>
                            <td className="construccion-panel__col-right construccion-panel__muted">{e.perimetroM.toFixed(2)} m perímetro</td>
                            <td className="construccion-panel__col-right construccion-panel__muted">{e.volumenM3.toFixed(2)} m³</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })
          )}
          <p className="construccion-panel__hint" style={{ marginTop: "0.5rem" }}>
            Área total construida: <strong>{areaTotalM2.toFixed(2)} m²</strong>
            {stats.exteriorM2 > 0 && <> · Exterior (no cuenta como construida): {stats.exteriorM2.toFixed(2)} m²</>}
          </p>
        </section>

        <section className="construccion-panel__section">
          <h2 className="construccion-panel__heading">Estimación de valor de mercado</h2>
          <div className="construccion-panel__inline-fields">
            <label className="construccion-panel__field">
              Nivel de acabados
              <select
                value={nivelId}
                onChange={(e) => {
                  setNivelId(e.target.value);
                  setPrecioM2Override(null);
                }}
              >
                {NIVELES_ACABADO.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label className="construccion-panel__field">
              Precio por m² (MXN)
              <input
                type="number"
                value={precioM2}
                onChange={(e) => setPrecioM2Override(Number(e.target.value) || 0)}
              />
            </label>
          </div>
          <table className="construccion-panel__plain-table">
            <thead>
              <tr>
                <th>Zona</th>
                <th className="construccion-panel__col-right">m²</th>
                <th className="construccion-panel__col-right">% del precio</th>
                <th className="construccion-panel__col-right">$/m²</th>
                <th className="construccion-panel__col-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {valorZonas.map((z) => (
                <tr key={z.tipo}>
                  <td>
                    {z.nombre}
                    {z.zonas > 1 ? ` (${z.zonas})` : ""}
                  </td>
                  <td className="construccion-panel__col-right">{z.areaM2.toFixed(2)}</td>
                  <td className="construccion-panel__col-right">
                    <input
                      key={`${z.tipo}-${z.factor}`}
                      type="number"
                      min={0}
                      max={300}
                      step={5}
                      defaultValue={Math.round(z.factor * 100)}
                      aria-label={`Porcentaje del precio para ${z.nombre}`}
                      className="construccion-zonas__num"
                      onBlur={(e) => {
                        const v = Number(e.currentTarget.value);
                        if (Number.isFinite(v) && v >= 0) guardarFactor(z.tipo, v / 100);
                        else e.currentTarget.value = String(Math.round(z.factor * 100));
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                      }}
                    />
                    %
                  </td>
                  <td className="construccion-panel__col-right">{peso(z.precioM2)}</td>
                  <td className="construccion-panel__col-right">{peso(z.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="construccion-panel__hint">
            Cada uso de zona vale una fracción del precio por m² (las áreas exteriores, 0% por defecto; cochera, bodega y pasillo, menos que una oficina). Ajusta los porcentajes a tu criterio.
          </p>
          <p className="construccion-panel__stat">{peso(valorEstimado)}</p>
          <p className="construccion-panel__disclaimer">
            Estimación paramétrica de referencia, no una tasación — calíbrala con comparables reales de tu zona.
          </p>
        </section>

        <section className="construccion-panel__section">
          <h2 className="construccion-panel__heading">Presupuesto de materiales</h2>
          <p className="construccion-panel__stat">{peso(presupuestoTotal)}</p>
          {costoZonas.length > 1 && (
            <table className="construccion-panel__plain-table">
              <tbody>
                {costoZonas.map((z) => (
                  <tr key={z.tipo}>
                    <td>
                      {z.nombre}
                      {z.zonas > 1 ? ` (${z.zonas})` : ""}
                    </td>
                    <td className="construccion-panel__col-right">{z.areaM2.toFixed(2)} m²</td>
                    <td className="construccion-panel__col-right">{peso(z.costo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="construccion-panel__disclaimer">Suma de todas las habitaciones — desglose en la pestaña Presupuesto.</p>
        </section>

        <div className="construccion-panel__inline-fields">
          <button onClick={handleExportPdf} disabled={proyecto.habitaciones.length === 0 || exportingPdf} className="btn btn-primary">
            {exportingPdf ? <span className="spinner" /> : null}
            Exportar ficha PDF
          </button>
          <button onClick={handleExportCsv} disabled={proyecto.habitaciones.length === 0} className="btn btn-outline">
            Exportar presupuesto CSV
          </button>
        </div>
      </div>
    </div>
  );
}
