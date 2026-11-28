import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { db } from "../lib/dataStore";
import { advisorOptions, defaultAdvisorId, validateSaleData } from "../lib/saleData";
import { errorId, fieldErrorProps } from "../lib/formErrors";
import "./PropertyProspectsModal.css";
import "./SaleDataModal.css";

const today = () => new Date().toISOString().slice(0, 10);

// 459: se abre al marcar una propiedad como vendida: pide la fecha de la venta y el asesor en el mismo paso y registra la venta
// (que ya deja el estatus en «vendida»). «Omitir por ahora» deja la propiedad vendida sin venta registrada: queda como pendiente
// en Reportes, como antes. `onDone` se llama al guardar o al omitir.
export default function SaleDataModal({ property, advisors, onDone }) {
  const { t } = useTranslation();
  const options = advisorOptions(advisors, property.advisor_ids || []);
  const [form, setForm] = useState({ fecha_venta: today(), advisor_id: defaultAdvisorId(advisors, property.advisor_ids || []) });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState("");
  const dateRef = useRef(null);

  useEffect(() => {
    dateRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && onDone(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onDone]);

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const found = validateSaleData(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    setFailure("");
    try {
      await db.saveVenta(property.id, { advisor_id: form.advisor_id || null, fecha_venta: form.fecha_venta });
      onDone(true);
    } catch (err) {
      setFailure(err?.message || t("saleData.error"));
      setSaving(false);
    }
  };

  return (
    <div className="match-modal" role="dialog" aria-modal="true" aria-labelledby="sale-data-title">
      <div className="match-modal__backdrop" onClick={() => onDone(false)} aria-hidden="true" />
      <div className="match-modal__box card">
        <div className="match-modal__head">
          <h2 id="sale-data-title">{t("saleData.title")}</h2>
        </div>
        <p className="form-hint">{t("saleData.intro", { title: property.title })}</p>
        <form onSubmit={handleSubmit} noValidate>
          <div className="form-field">
            <label htmlFor="sale-date">{t("saleData.date")}</label>
            <input id="sale-date" name="fecha_venta" type="date" ref={dateRef} max={today()} value={form.fecha_venta} onChange={handleChange} {...fieldErrorProps("sale-date", errors.fecha_venta)} />
            {errors.fecha_venta && (
              <span id={errorId("sale-date")} className="form-error">
                {t(`saleData.errors.${errors.fecha_venta}`)}
              </span>
            )}
          </div>
          <div className="form-field">
            <label htmlFor="sale-advisor">{t("saleData.advisor")}</label>
            <select id="sale-advisor" name="advisor_id" value={form.advisor_id} onChange={handleChange}>
              <option value="">{t("saleData.noAdvisor")}</option>
              {options.map((advisor) => (
                <option key={advisor.id} value={advisor.id}>
                  {advisor.name}
                </option>
              ))}
            </select>
          </div>
          {failure && <p className="form-error" role="alert">{failure}</p>}
          <div className="sale-data__actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <span className="spinner" /> : null}
              {t("saleData.save")}
            </button>
            <button type="button" className="btn btn-outline" onClick={() => onDone(false)} disabled={saving}>
              {t("saleData.skip")}
            </button>
          </div>
          <p className="form-hint">{t("saleData.skipHint")}</p>
        </form>
      </div>
    </div>
  );
}
