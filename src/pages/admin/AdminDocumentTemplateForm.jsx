import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { AVAILABLE_PLACEHOLDERS } from "../../lib/documentTemplates";
import "./admin.css";

const EMPTY = { name: "", body: "", custom_fields: [], requires_signatures: true, active: true };
const FIELD_TYPES = ["text", "number", "date"];
const KEY_PATTERN = /^[a-z][a-z0-9_]*$/;

export default function AdminDocumentTemplateForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { t } = useTranslation();
  const navigate = useNavigate();
  const bodyRef = useRef(null);

  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);

  useEffect(() => {
    if (!isEdit) return;
    db.getDocumentTemplates().then((templates) => {
      const template = templates.find((tpl) => tpl.id === id);
      if (!template) return;
      setForm({
        name: template.name,
        body: template.body,
        custom_fields: template.custom_fields || [],
        requires_signatures: template.requires_signatures !== false,
        active: template.active !== false,
      });
      setLoading(false);
    });
  }, [id, isEdit]);

  const handleChange = (field) => (e) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const insertPlaceholder = (key) => {
    const token = `{{${key}}}`;
    const textarea = bodyRef.current;
    if (!textarea) {
      setForm((prev) => ({ ...prev, body: `${prev.body}${token}` }));
      return;
    }
    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? textarea.value.length;
    setForm((prev) => ({ ...prev, body: prev.body.slice(0, start) + token + prev.body.slice(end) }));
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + token.length;
    });
  };

  const addCustomField = () => {
    setForm((prev) => ({ ...prev, custom_fields: [...prev.custom_fields, { key: "", label: "", type: "text" }] }));
  };

  const updateCustomField = (index, field) => (e) => {
    const value = e.target.value;
    setForm((prev) => ({
      ...prev,
      custom_fields: prev.custom_fields.map((cf, i) => (i === index ? { ...cf, [field]: value } : cf)),
    }));
  };

  const removeCustomField = (index) => {
    setForm((prev) => ({ ...prev, custom_fields: prev.custom_fields.filter((_, i) => i !== index) }));
  };

  const validate = () => {
    const next = {};
    if (!form.name.trim()) next.name = t("contact.required");
    if (!form.body.trim()) next.body = t("contact.required");
    const keys = new Set();
    form.custom_fields.forEach((cf, i) => {
      if (!cf.label.trim() || !KEY_PATTERN.test(cf.key)) next[`field_${i}`] = t("documentTemplates.fields.fieldError");
      else if (keys.has(cf.key)) next[`field_${i}`] = t("documentTemplates.fields.fieldDuplicate");
      keys.add(cf.key);
    });
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      if (isEdit) {
        await db.updateDocumentTemplate(id, form);
      } else {
        await db.createDocumentTemplate(form);
      }
      navigate("/admin/plantillas-documentos");
    } catch (err) {
      window.alert(err.message || t("documentTemplates.saveError"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="empty-state">{t("common.loading")}</div>;

  return (
    <div>
      <div className="admin-header">
        <h1>{isEdit ? t("documentTemplates.edit") : t("documentTemplates.new")}</h1>
      </div>

      <form className="card admin-form" onSubmit={handleSubmit} noValidate style={{ maxWidth: 820 }}>
        <div className="form-field">
          <label htmlFor="dt-name">{t("documentTemplates.fields.name")}</label>
          <input id="dt-name" value={form.name} onChange={handleChange("name")} />
          {errors.name && <span className="form-error">{errors.name}</span>}
        </div>

        <div className="form-field">
          <label htmlFor="dt-body">{t("documentTemplates.fields.body")}</label>
          <textarea id="dt-body" ref={bodyRef} rows={14} value={form.body} onChange={handleChange("body")} />
          <p className="form-hint">{t("documentTemplates.fields.bodyHint")}</p>
          {errors.body && <span className="form-error">{errors.body}</span>}
          <div className="admin-zones-grid" style={{ marginTop: "0.75rem" }}>
            {AVAILABLE_PLACEHOLDERS.map((ph) => (
              <button
                key={ph.key}
                type="button"
                className="btn btn-outline btn-sm"
                title={ph.hint}
                onClick={() => insertPlaceholder(ph.key)}
              >
                {`{{${ph.key}}}`}
              </button>
            ))}
            {form.custom_fields
              .filter((cf) => KEY_PATTERN.test(cf.key))
              .map((cf) => (
                <button
                  key={cf.key}
                  type="button"
                  className="btn btn-outline btn-sm"
                  title={cf.label}
                  onClick={() => insertPlaceholder(`campo.${cf.key}`)}
                >
                  {`{{campo.${cf.key}}}`}
                </button>
              ))}
          </div>
        </div>

        <div className="form-field">
          <label>{t("documentTemplates.fields.customFields")}</label>
          <p className="form-hint">{t("documentTemplates.fields.customFieldsHint")}</p>
          {form.custom_fields.map((cf, index) => (
            <div key={index} className="form-row" style={{ alignItems: "flex-start", marginBottom: "0.5rem" }}>
              <div className="form-field">
                <input
                  placeholder={t("documentTemplates.fields.fieldKeyPlaceholder")}
                  value={cf.key}
                  onChange={updateCustomField(index, "key")}
                />
              </div>
              <div className="form-field">
                <input
                  placeholder={t("documentTemplates.fields.fieldLabelPlaceholder")}
                  value={cf.label}
                  onChange={updateCustomField(index, "label")}
                />
              </div>
              <div className="form-field">
                <select value={cf.type} onChange={updateCustomField(index, "type")}>
                  {FIELD_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {t(`documentTemplates.fields.fieldTypes.${type}`)}
                    </option>
                  ))}
                </select>
              </div>
              <button type="button" className="btn btn-danger btn-sm" onClick={() => removeCustomField(index)}>
                {t("common.delete")}
              </button>
              {errors[`field_${index}`] && <span className="form-error">{errors[`field_${index}`]}</span>}
            </div>
          ))}
          <button type="button" className="btn btn-outline btn-sm" onClick={addCustomField}>
            {t("documentTemplates.fields.addField")}
          </button>
        </div>

        <div className="form-field">
          <label>
            <input type="checkbox" checked={form.requires_signatures} onChange={handleChange("requires_signatures")} style={{ marginRight: "0.5rem" }} />
            {t("documentTemplates.fields.requiresSignatures")}
          </label>
          <p className="form-hint">{t("documentTemplates.fields.requiresSignaturesHint")}</p>
        </div>

        <div className="form-field">
          <label>
            <input type="checkbox" checked={form.active} onChange={handleChange("active")} style={{ marginRight: "0.5rem" }} />
            {t("common.active")}
          </label>
          <p className="form-hint">{t("documentTemplates.fields.activeHint")}</p>
        </div>

        <div className="admin-form__actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <span className="spinner" /> : null}
            {t("common.save")}
          </button>
          <button type="button" className="btn btn-outline" onClick={() => navigate("/admin/plantillas-documentos")}>
            {t("common.cancel")}
          </button>
        </div>
      </form>
    </div>
  );
}
