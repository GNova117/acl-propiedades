import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { formatMXN } from "../../lib/format";
import { computeMaterialsTotals } from "../../lib/materialsTotals";
import { EMPTY_LIQUIDACION, computeLiquidacion, toLiquidacionPayload, toLiquidacionFormValues } from "../../lib/liquidacion";
import "./AdminPropertyLiquidacion.css";
import "./admin.css";

export default function AdminPropertyLiquidacion() {
  const { id } = useParams();
  const { t } = useTranslation();

  const [property, setProperty] = useState(null);
  const [advisors, setAdvisors] = useState([]);
  const [remodelProject, setRemodelProject] = useState(null);
  const [existing, setExisting] = useState(null); // registro guardado, null si aún no existe
  const [form, setForm] = useState(EMPTY_LIQUIDACION);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      db.getPropertyById(id),
      db.getAdvisors(),
      db.getLiquidacionByProperty(id),
      db.getRemodelProjectByProperty(id),
    ]).then(([propertyData, advisorsData, liquidacionData, remodelData]) => {
      setProperty(propertyData);
      setAdvisors(advisorsData);
      setExisting(liquidacionData);
      setForm(toLiquidacionFormValues(liquidacionData));
      setRemodelProject(remodelData);
      setLoading(false);
    });
  };

  useEffect(load, [id]);

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  // Costo de liquidación e inversión en remodelación no se capturan aquí:
  // vienen en vivo del precio de la propiedad y del total de materiales del
  // proyecto de remodelación vinculado. Si el precio o los materiales
  // cambian en su módulo de origen, se reflejan aquí en automático la
  // siguiente vez que se abre o se guarda esta pantalla — no hay una cifra
  // fija que confirmar ni migrar.
  const costoTotal = Number(property?.price) || 0;
  const inversionRemodelacion = useMemo(
    () => computeMaterialsTotals(remodelProject?.materials).grandTotalInternal,
    [remodelProject]
  );

  const breakdown = useMemo(
    () => computeLiquidacion({ ...form, costo_total: costoTotal, inversion_remodelacion: inversionRemodelacion }),
    [form, costoTotal, inversionRemodelacion]
  );

  const captador = advisors.find((a) => a.id === form.captador_id);
  const vendedor = advisors.find((a) => a.id === form.vendedor_id);

  const validate = () => {
    const next = {};
    if (!form.captador_id) next.captador_id = t("contact.required");
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    setSaved(false);
    try {
      const payload = toLiquidacionPayload(form);
      const result = existing ? await db.updateLiquidacion(existing.id, payload) : await db.addLiquidacion(id, payload);
      setExisting(result);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      window.alert(err.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="empty-state">{t("common.loading")}</div>;

  return (
    <div>
      <div className="admin-header">
        <div>
          <h1>{t("liquidacion.title")}</h1>
          <p className="form-hint">{property?.title}</p>
        </div>
        <Link to="/admin/propiedades" className="btn btn-outline">
          {t("common.close")}
        </Link>
      </div>

      <div className="liquidacion-layout">
        <form className="card admin-form" onSubmit={handleSubmit} noValidate>
          <div className="form-row">
            <div className="form-field">
              <label htmlFor="liq-costo-total">Costo total de liquidación</label>
              <div id="liq-costo-total" className="liquidacion-readonly">{formatMXN(costoTotal)}</div>
              <span className="form-hint">
                {t("liquidacion.autoFromProperty")}{" "}
                <Link to={`/admin/propiedades/${id}`}>{t("liquidacion.editInProperty")}</Link>
              </span>
            </div>
            <div className="form-field">
              <label htmlFor="liq-devolucion">Devolución al vendedor original</label>
              <input id="liq-devolucion" type="number" min="0" value={form.devolucion_vendedor} onChange={handleChange("devolucion_vendedor")} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label htmlFor="liq-remodelacion">Inversión — costo de remodelación</label>
              <div id="liq-remodelacion" className="liquidacion-readonly">{formatMXN(inversionRemodelacion)}</div>
              <span className="form-hint">
                {remodelProject ? (
                  <>
                    {t("liquidacion.autoFromRemodel")}{" "}
                    <Link to={`/admin/remodelaciones/${remodelProject.id}`}>{t("liquidacion.editInRemodel")}</Link>
                  </>
                ) : (
                  t("liquidacion.noRemodelProject")
                )}
              </span>
            </div>
            <div className="form-field">
              <label htmlFor="liq-servicios">Inversión — pago de servicios</label>
              <input id="liq-servicios" type="number" min="0" value={form.inversion_servicios} onChange={handleChange("inversion_servicios")} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label htmlFor="liq-captador">Quién captó la propiedad</label>
              <select id="liq-captador" value={form.captador_id} onChange={handleChange("captador_id")}>
                <option value="">—</option>
                {advisors.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              {errors.captador_id && <span className="form-error">{errors.captador_id}</span>}
            </div>
            <div className="form-field">
              <label htmlFor="liq-vendedor">Quién vendió la propiedad</label>
              <select id="liq-vendedor" value={form.vendedor_id} onChange={handleChange("vendedor_id")}>
                <option value="">{t("liquidacion.sameAsCaptador")}</option>
                {advisors.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label htmlFor="liq-tasa-captacion">% Comisión de captación</label>
              <input id="liq-tasa-captacion" type="number" min="0" max="100" value={form.tasa_comision_captacion} onChange={handleChange("tasa_comision_captacion")} />
            </div>
            <div className="form-field">
              <label htmlFor="liq-tasa-venta">% Comisión de venta (si aplica)</label>
              <input id="liq-tasa-venta" type="number" min="0" max="100" value={form.tasa_comision_venta} onChange={handleChange("tasa_comision_venta")} />
            </div>
            <div className="form-field">
              <label htmlFor="liq-tasa-gastos">% Gastos administrativos</label>
              <input id="liq-tasa-gastos" type="number" min="0" max="100" value={form.tasa_gastos_admin} onChange={handleChange("tasa_gastos_admin")} />
            </div>
          </div>

          <div className="admin-form__actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <span className="spinner" /> : null}
              {saved ? "✓" : t("common.save")}
            </button>
          </div>
        </form>

        <div className="card liquidacion-breakdown">
          <h2 className="profiling-section-title">{t("liquidacion.breakdownTitle")}</h2>
          <table className="liquidacion-breakdown__table">
            <tbody>
              <tr>
                <td>Costo total de liquidación</td>
                <td>{formatMXN(costoTotal)}</td>
              </tr>
              <tr>
                <td>(−) Devolución al vendedor</td>
                <td>−{formatMXN(form.devolucion_vendedor || 0)}</td>
              </tr>
              <tr>
                <td>(−) Inversión (remodelación + servicios)</td>
                <td>−{formatMXN(breakdown.inversion)}</td>
              </tr>
              <tr className="liquidacion-breakdown__strong">
                <td>= Subtotal</td>
                <td>{formatMXN(breakdown.subtotal)}</td>
              </tr>
              <tr>
                <td>(−) Comisión de captación ({form.tasa_comision_captacion || 0}%)</td>
                <td>−{formatMXN(breakdown.comisionCaptacion)}</td>
              </tr>
              {!breakdown.mismaPersona && (
                <tr className="liquidacion-breakdown__sub">
                  <td>
                    → Comisión de venta ({form.tasa_comision_venta || 0}%){vendedor ? ` para ${vendedor.name}` : ""}
                  </td>
                  <td>−{formatMXN(breakdown.comisionVenta)}</td>
                </tr>
              )}
              <tr className="liquidacion-breakdown__sub">
                <td>
                  → Para {captador ? captador.name : "quien captó"}
                  {breakdown.mismaPersona ? " (captó y vendió, 100%)" : ""}
                </td>
                <td>{formatMXN(breakdown.montoCaptador)}</td>
              </tr>
              <tr className="liquidacion-breakdown__strong">
                <td>= Utilidad de oficina</td>
                <td>{formatMXN(breakdown.utilidadOficina)}</td>
              </tr>
              <tr>
                <td>(−) Gastos administrativos ({form.tasa_gastos_admin || 0}%)</td>
                <td>−{formatMXN(breakdown.gastosAdmin)}</td>
              </tr>
              <tr className="liquidacion-breakdown__total">
                <td>= Utilidad neta de la sociedad</td>
                <td>{formatMXN(breakdown.utilidadNeta)}</td>
              </tr>
            </tbody>
          </table>
          <p className="form-hint">{t("liquidacion.disclaimer")}</p>
        </div>
      </div>
    </div>
  );
}
