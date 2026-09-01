import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import "./admin.css";

const EMPTY = { name: "", phone: "", email: "", whatsapp: "", bio: "", active: true };

export default function AdminAdvisorForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY);
  const [existingPhoto, setExistingPhoto] = useState("");
  const [photoFile, setPhotoFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);

  useEffect(() => {
    if (!isEdit) return;
    db.getAdvisorById(id).then((advisor) => {
      if (!advisor) return;
      setForm({
        name: advisor.name,
        phone: advisor.phone,
        email: advisor.email,
        whatsapp: advisor.whatsapp,
        bio: advisor.bio || "",
        active: advisor.active !== false,
      });
      setExistingPhoto(advisor.photo_url || "");
      setLoading(false);
    });
  }, [id, isEdit]);

  useEffect(() => {
    if (!photoFile) {
      setPreview(existingPhoto);
      return;
    }
    const url = URL.createObjectURL(photoFile);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile, existingPhoto]);

  const handleChange = (field) => (e) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const validate = () => {
    const next = {};
    if (!form.name.trim()) next.name = t("contact.required");
    if (!form.email.trim()) next.email = t("contact.required");
    if (!form.phone.trim()) next.phone = t("contact.required");
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = { ...form, existingPhoto, photoFile };
      if (isEdit) {
        await db.updateAdvisor(id, payload);
      } else {
        await db.addAdvisor(payload);
      }
      navigate("/admin/asesores");
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
        <h1>{isEdit ? t("admin.editAdvisor") : t("admin.newAdvisor")}</h1>
      </div>

      <form className="card admin-form" onSubmit={handleSubmit} noValidate>
        <div className="form-field">
          <label htmlFor="a-name">Nombre</label>
          <input id="a-name" value={form.name} onChange={handleChange("name")} />
          {errors.name && <span className="form-error">{errors.name}</span>}
        </div>

        <div className="form-row">
          <div className="form-field">
            <label htmlFor="a-phone">Teléfono</label>
            <input id="a-phone" value={form.phone} onChange={handleChange("phone")} />
            {errors.phone && <span className="form-error">{errors.phone}</span>}
          </div>
          <div className="form-field">
            <label htmlFor="a-email">Correo</label>
            <input id="a-email" type="email" value={form.email} onChange={handleChange("email")} />
            {errors.email && <span className="form-error">{errors.email}</span>}
          </div>
        </div>

        <div className="form-field">
          <label htmlFor="a-whatsapp">WhatsApp (formato 521XXXXXXXXXX)</label>
          <input id="a-whatsapp" value={form.whatsapp} onChange={handleChange("whatsapp")} />
        </div>

        <div className="form-field">
          <label htmlFor="a-bio">Descripción breve</label>
          <textarea id="a-bio" rows={3} value={form.bio} onChange={handleChange("bio")} />
        </div>

        <div className="form-field">
          <label>Foto</label>
          {preview && <img src={preview} alt="" style={{ width: 96, height: 96, borderRadius: "50%", objectFit: "cover", marginBottom: "0.75rem" }} />}
          <input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files?.[0] || null)} />
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
          <button type="button" className="btn btn-outline" onClick={() => navigate("/admin/asesores")}>
            {t("common.cancel")}
          </button>
        </div>
      </form>
    </div>
  );
}
