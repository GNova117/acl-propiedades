import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import "./admin.css";

const EMPTY = { title: "", body: "" };

export default function AdminNovedadesForm() {
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
    db.getSiteUpdates().then((updates) => {
      const update = updates.find((u) => u.id === id);
      if (!update) return;
      setForm({ title: update.title, body: update.body });
      setLoading(false);
    });
  }, [id, isEdit]);

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const validate = () => {
    const next = {};
    if (!form.title.trim()) next.title = t("contact.required");
    if (!form.body.trim()) next.body = t("contact.required");
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      if (isEdit) {
        await db.updateSiteUpdate(id, form);
      } else {
        await db.addSiteUpdate(form);
      }
      navigate("/admin/novedades");
    } catch (err) {
      window.alert(err.message || "Error al guardar la entrada");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="empty-state">{t("common.loading")}</div>;

  return (
    <div>
      <div className="admin-header">
        <h1>{isEdit ? t("novedades.admin.edit") : t("novedades.admin.new")}</h1>
      </div>

      <form className="card admin-form" onSubmit={handleSubmit} noValidate style={{ maxWidth: 720 }}>
        <div className="form-field">
          <label htmlFor="novedad-title">{t("novedades.admin.fields.title")}</label>
          <input id="novedad-title" value={form.title} onChange={handleChange("title")} />
          {errors.title && <span className="form-error">{errors.title}</span>}
        </div>

        <div className="form-field">
          <label htmlFor="novedad-body">{t("novedades.admin.fields.body")}</label>
          <textarea id="novedad-body" rows={10} value={form.body} onChange={handleChange("body")} />
          {errors.body && <span className="form-error">{errors.body}</span>}
        </div>

        <div className="admin-form__actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <span className="spinner" /> : null}
            {t("common.save")}
          </button>
          <button type="button" className="btn btn-outline" onClick={() => navigate("/admin/novedades")}>
            {t("common.cancel")}
          </button>
        </div>
      </form>
    </div>
  );
}
