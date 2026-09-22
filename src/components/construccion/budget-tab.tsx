import type { Dispatch, SetStateAction } from "react";
import { calcularPresupuesto, totalPresupuesto } from "../../lib/construccion/budget";
import type { FuenteCantidad, MaterialCatalogItem, Proyecto } from "../../lib/construccion/types";

const FUENTE_LABEL: Record<FuenteCantidad, string> = {
  area_muro: "m² de muro",
  area_piso: "m² de piso",
  perimetro: "m de perímetro",
};

const peso = (n: number) => `$${n.toLocaleString("es-MX", { maximumFractionDigits: 0 })}`;

type Props = {
  proyecto: Proyecto;
  catalogo: MaterialCatalogItem[];
  setCatalogo: Dispatch<SetStateAction<MaterialCatalogItem[]>>;
};

export default function BudgetTab({ proyecto, catalogo, setCatalogo }: Props) {
  function updateItem(id: string, patch: Partial<MaterialCatalogItem>) {
    setCatalogo((c) => c.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }
  function deleteItem(id: string) {
    setCatalogo((c) => c.filter((m) => m.id !== id));
  }
  function addItem() {
    setCatalogo((c) => [
      ...c,
      { id: crypto.randomUUID(), nombre: "Nuevo material", unidad: "pieza", fuente: "area_muro", factor: 1, precioUnitario: 0 },
    ]);
  }

  const porHabitacion = proyecto.habitaciones.map((h) => ({
    habitacion: h,
    lineas: calcularPresupuesto(h, catalogo),
  }));
  const granTotal = porHabitacion.reduce((sum, x) => sum + totalPresupuesto(x.lineas), 0);

  return (
    <div className="construccion-panel">
      <section className="construccion-panel__section">
        <h2 className="construccion-panel__heading">Catálogo de materiales</h2>
        <p className="construccion-panel__hint">Precios y rendimientos de referencia — ajústalos a tu región y proveedor.</p>
        <div className="card admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Material</th>
                <th>Unidad</th>
                <th>Se calcula por</th>
                <th>Rendimiento</th>
                <th>Precio unitario</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {catalogo.map((m) => (
                <tr key={m.id}>
                  <td>
                    <input
                      value={m.nombre}
                      onChange={(e) => updateItem(m.id, { nombre: e.target.value })}
                      className="construccion-panel__cell-input"
                      style={{ width: "9rem" }}
                    />
                  </td>
                  <td>
                    <input
                      value={m.unidad}
                      onChange={(e) => updateItem(m.id, { unidad: e.target.value })}
                      className="construccion-panel__cell-input"
                      style={{ width: "4rem" }}
                    />
                  </td>
                  <td>
                    <select
                      value={m.fuente}
                      onChange={(e) => updateItem(m.id, { fuente: e.target.value as FuenteCantidad })}
                      className="construccion-panel__cell-input"
                    >
                      {Object.entries(FUENTE_LABEL).map(([v, label]) => (
                        <option key={v} value={v}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="number"
                      step={0.01}
                      value={m.factor}
                      onChange={(e) => updateItem(m.id, { factor: Number(e.target.value) || 0 })}
                      className="construccion-panel__cell-input"
                      style={{ width: "5rem" }}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step={0.01}
                      value={m.precioUnitario}
                      onChange={(e) => updateItem(m.id, { precioUnitario: Number(e.target.value) || 0 })}
                      className="construccion-panel__cell-input"
                      style={{ width: "6rem" }}
                    />
                  </td>
                  <td>
                    <button onClick={() => deleteItem(m.id)} className="construccion-panel__link-danger">
                      eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button onClick={addItem} className="btn btn-outline btn-sm construccion-panel__add-btn">
          + Agregar material
        </button>
      </section>

      <section>
        <div className="construccion-panel__section-header">
          <h2 className="construccion-panel__heading">Presupuesto por habitación</h2>
          <p className="construccion-panel__total">
            Total del proyecto: <strong>{peso(granTotal)}</strong>
          </p>
        </div>
        {proyecto.habitaciones.length === 0 && (
          <p className="empty-state">Todavía no hay habitaciones — créalas en la pestaña Editor.</p>
        )}
        <div className="construccion-panel__room-budgets">
          {porHabitacion.map(({ habitacion, lineas }) => (
            <div key={habitacion.id}>
              <h3 className="construccion-panel__subheading">{habitacion.nombre}</h3>
              <div className="card admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Material</th>
                      <th>Cantidad</th>
                      <th>Costo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineas.map((l) => (
                      <tr key={l.material.id}>
                        <td>{l.material.nombre}</td>
                        <td>
                          {l.cantidad.toFixed(2)} {l.material.unidad}
                        </td>
                        <td>{peso(l.costo)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={2}>
                        <strong>Subtotal</strong>
                      </td>
                      <td>
                        <strong>{peso(totalPresupuesto(lineas))}</strong>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
