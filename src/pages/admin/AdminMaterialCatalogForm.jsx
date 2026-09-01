import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { CONSUMPTION_BASES } from "../../lib/materialConsumption";
import "./admin.css";

const EMPTY = {
  name: "",
  category: "",
  unit: "",
  unit_price_internal: "",
  unit_price_external: "",
  consumption_rate: "",
  consumption_basis: "",
  active: true,
};

export default function AdminMaterialCatalogForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);

  useEffect(() => {
    if (!isEdit) return;
    db.getMaterialCatalogItemById(id).then((item) => {
      if (!item) return;
      setForm({
        name: item.name,
        category: item.category || "",
        unit: item.unit || "",
        unit_price_internal: item.unit_price_internal ?? "",
        unit_price_external: item.unit_price_external ?? "",
        consumption_rate: item.consumption_rate ?? "",
        consumption_basis: item.consumption_basis || "",
        active: item.active !== false,
      });
      setLoading(false);
    });
  }, [id, isEdit]);

  const handleChange = (field) => (e) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const validate = () => {
    const next = {};
    if (!form.name.trim()) next.name = t("contact.required");
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      if (isEdit) {
        await db.updateMaterialCatalogItem(id, form);
      } else {
        await db.addMaterialCatalogItem(form);
      }
      navigate("/admin/materiales");
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
        <h1>{isEdit ? t("admin.editMaterialCatalogItem") : t("admin.newMaterialCatalogItem")}</h1>
      </div>

      <form className="card admin-form" onSubmit={handleSubmit} noValidate>
        <div className="form-row">
          <div className="form-field">
            <label htmlFor="m-name">{t("materialsCatalog.name")}</label>
            <input id="m-name" value={form.name} onChange={handleChange("name")} />
            {errors.name && <span className="form-error">{errors.name}</span>}
          </div>
          <div className="form-field">
            <label htmlFor="m-category">{t("remodelCalculator.category")}</label>
            <input id="m-category" value={form.category} onChange={handleChange("category")} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label htmlFor="m-unit">{t("remodelCalculator.unit")}</label>
            <input id="m-unit" value={form.unit} onChange={handleChange("unit")} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label htmlFor="m-price-internal">{t("remodelCalculator.unitPriceInternal")}</label>
            <input id="m-price-internal" type="number" min="0" value={form.unit_price_internal} onChange={handleChange("unit_price_internal")} />
          </div>
          <div className="form-field">
            <label htmlFor="m-price-external">{t("remodelCalculator.unitPriceExternal")}</label>
            <input id="m-price-external" type="number" min="0" value={form.unit_price_external} onChange={handleChange("unit_price_external")} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label htmlFor="m-consumption-rate">{t("materialsCatalog.consumptionRate")}</label>
            <input
              id="m-consumption-rate"
              type="number"
              min="0"
              step="0.01"
              value={form.consumption_rate}
              onChange={handleChange("consumption_rate")}
            />
          </div>
          <div className="form-field">
            <label htmlFor="m-consumption-basis">{t("materialsCatalog.consumptionBasis")}</label>
            <select id="m-consumption-basis" value={form.consumption_basis} onChange={handleChange("consumption_basis")}>
              <option value="">—</option>
              {CONSUMPTION_BASES.map((basis) => (
                <option key={basis} value={basis}>
                  {t(`materialsCatalog.consumptionBasisOptions.${basis}`)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="form-hint">{t("materialsCatalog.consumptionHint")}</p>

        <div className="form-field">
          <label>
            <input type="checkbox" checked={form.active} onChange={handleChange("active")} style={{ marginRight: "0.5rem" }} />
            {t("common.active")}
          </label>
        </div>

        <div className="admin-form__actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <span className="spinner" /> : null}
            {t("common.save")}
          </button>
          <button type="button" className="btn btn-outline" onClick={() => navigate("/admin/materiales")}>
            {t("common.cancel")}
          </button>
        </div>
      </form>
    </div>
  );
}
