import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { CLIENT_TYPES } from "../../lib/format";
import "./admin.css";

const EMPTY = {
  name: "",
  type: "comprador",
  email: "",
  phone: "",
  notes: "",
  active: true,
};

export default function AdminClientForm() {
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
    db.getClientById(id).then((client) => {
      if (!client) return;
      setForm({
        name: client.name,
        type: client.type,
        email: client.email || "",
        phone: client.phone || "",
        notes: client.notes || "",
        active: client.active !== false,
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
        await db.updateClient(id, form);
      } else {
        await db.addClient(form);
      }
      navigate("/admin/clientes");
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
        <h1>{isEdit ? t("admin.editClient") : t("admin.newClient")}</h1>
        {isEdit && (
          <div className="admin-header__actions">
            <Link to={`/admin/clientes/${id}/perfilamiento`} className="btn btn-outline">
              {t("profiling.title")}
            </Link>
            <Link to={`/admin/clientes/${id}/documentos`} className="btn btn-outline">
              {t("clients.viewDocuments")}
            </Link>
          </div>
        )}
      </div>

      <form className="card admin-form" onSubmit={handleSubmit} noValidate>
        <div className="form-row">
          <div className="form-field">
            <label htmlFor="c-name">{t("clients.name")}</label>
            <input id="c-name" value={form.name} onChange={handleChange("name")} />
            {errors.name && <span className="form-error">{errors.name}</span>}
          </div>
          <div className="form-field">
            <label htmlFor="c-type">{t("clients.type")}</label>
            <select id="c-type" value={form.type} onChange={handleChange("type")}>
              {CLIENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(`clients.${type === "comprador" ? "buyer" : type === "vendedor" ? "seller" : "both"}`)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label htmlFor="c-phone">{t("clients.phone")}</label>
            <input id="c-phone" value={form.phone} onChange={handleChange("phone")} />
          </div>
          <div className="form-field">
            <label htmlFor="c-email">{t("clients.email")}</label>
            <input id="c-email" type="email" value={form.email} onChange={handleChange("email")} />
          </div>
        </div>

        <div className="form-field">
          <label htmlFor="c-notes">{t("clients.notes")}</label>
          <textarea id="c-notes" rows={3} value={form.notes} onChange={handleChange("notes")} />
        </div>

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
          <button type="button" className="btn btn-outline" onClick={() => navigate("/admin/clientes")}>
            {t("common.cancel")}
          </button>
        </div>
      </form>
    </div>
  );
}
