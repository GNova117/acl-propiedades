import { useState } from "react";
import { NIVELES_ACABADO, calcularPresupuesto, totalPresupuesto } from "../../lib/construccion/budget";
import { polygonArea, polygonPerimeter } from "../../lib/construccion/geometry";
import { exportFichaPdf } from "../../lib/construccion/export-plan";
import type { MaterialCatalogItem, Proyecto } from "../../lib/construccion/types";

const peso = (n: number) => `$${n.toLocaleString("es-MX", { maximumFractionDigits: 0 })}`;

type Props = {
  proyecto: Proyecto;
  catalogo: MaterialCatalogItem[];
};

export default function SummaryTab({ proyecto, catalogo }: Props) {
  const [nivelId, setNivelId] = useState(NIVELES_ACABADO[1].id);
  const [precioM2Override, setPrecioM2Override] = useState<number | null>(null);

  const nivel = NIVELES_ACABADO.find((n) => n.id === nivelId) ?? NIVELES_ACABADO[1];
  const precioM2 = precioM2Override ?? nivel.precioM2;

  const filas = proyecto.habitaciones.map((h) => ({
    nombre: h.nombre,
    areaM2: polygonArea(h.puntos),
    perimetroM: polygonPerimeter(h.puntos),
  }));
  const areaTotalM2 = filas.reduce((sum, f) => sum + f.areaM2, 0);
  const valorEstimado = areaTotalM2 * precioM2;
  const presupuestoTotal = proyecto.habitaciones.reduce(
    (sum, h) => sum + totalPresupuesto(calcularPresupuesto(h, catalogo)),
    0,
  );

  async function handleExport() {
    await exportFichaPdf({
      proyectoNombre: proyecto.nombre,
      habitaciones: filas,
      areaTotalM2,
      nivelAcabado: nivel.nombre,
      precioM2,
      valorEstimado,
      presupuestoTotal,
    });
  }

  return (
    <div className="construccion-panel">
      <div className="construccion-panel__narrow">
        <section className="construccion-panel__section">
          <h2 className="construccion-panel__heading">Habitaciones</h2>
          {proyecto.habitaciones.length === 0 ? (
            <p className="empty-state">Todavía no hay habitaciones — créalas en la pestaña Editor.</p>
          ) : (
            <table className="construccion-panel__plain-table">
              <tbody>
                {filas.map((f) => (
                  <tr key={f.nombre}>
                    <td>{f.nombre}</td>
                    <td className="construccion-panel__col-right">{f.areaM2.toFixed(2)} m²</td>
                    <td className="construccion-panel__col-right construccion-panel__muted">{f.perimetroM.toFixed(2)} m perímetro</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>
                    <strong>Área total construida</strong>
                  </td>
                  <td className="construccion-panel__col-right" colSpan={2}>
                    <strong>{areaTotalM2.toFixed(2)} m²</strong>
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
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
          <p className="construccion-panel__hint">
            {areaTotalM2.toFixed(2)} m² × {peso(precioM2)}/m²
          </p>
          <p className="construccion-panel__stat">{peso(valorEstimado)}</p>
          <p className="construccion-panel__disclaimer">
            Estimación paramétrica de referencia, no una tasación — calíbrala con comparables reales de tu zona.
          </p>
        </section>

        <section className="construccion-panel__section">
          <h2 className="construccion-panel__heading">Presupuesto de materiales</h2>
          <p className="construccion-panel__stat">{peso(presupuestoTotal)}</p>
          <p className="construccion-panel__disclaimer">Suma de todas las habitaciones — desglose en la pestaña Presupuesto.</p>
        </section>

        <button onClick={handleExport} disabled={proyecto.habitaciones.length === 0} className="btn btn-primary">
          Exportar ficha PDF
        </button>
      </div>
    </div>
  );
}
