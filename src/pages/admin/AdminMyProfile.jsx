import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { whatsappDigits } from "../../lib/format";
import { useAuth } from "../../context/AuthContext";
import "./admin.css";

const EMPTY = { name: "", phone: "", email: "", whatsapp: "", bio: "" };

// Edición del propio perfil de asesor (foto, teléfono, correo, WhatsApp,
// descripción) para quien inició sesión con un login vinculado a un asesor
// (advisorId), sin necesitar la sección 'asesores' — esa la da la oficina y
// normalmente un asesor no la tiene. "Activo" y "Mostrar en Nosotros" no
// están aquí a propósito: son decisiones de la oficina (ver
// AdminAdvisorForm.jsx, que sí los tiene). RLS en Supabase ya lo garantiza
// del otro lado (política "Asesor edita su propio perfil" + el trigger
// advisors_guard_self_edit, ver schema.sql); aquí solo se oculta la UI para
// no ofrecer algo que de todos modos no tendría efecto.
export default function AdminMyProfile() {
  const { t } = useTranslation();
  const { advisorId } = useAuth();

  const [form, setForm] = useState(EMPTY);
  const [existingPhoto, setExistingPhoto] = useState("");
  const [photoFile, setPhotoFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (advisorId == null) {
      setLoading(false);
      return;
    }
    db.getAdvisorById(advisorId).then((advisor) => {
      if (!advisor) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setForm({
        name: advisor.name || "",
        phone: advisor.phone || "",
        email: advisor.email || "",
        whatsapp: advisor.whatsapp || "",
        bio: advisor.bio || "",
      });
      setExistingPhoto(advisor.photo_url || "");
      setLoading(false);
    });
  }, [advisorId]);

  useEffect(() => {
    if (!photoFile) {
      setPreview(existingPhoto);
      return;
    }
    const url = URL.createObjectURL(photoFile);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile, existingPhoto]);

  const handleChange = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

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
    setSaved(false);
    if (!validate()) return;
    setSaving(true);
    try {
      await db.updateAdvisor(advisorId, {
        name: form.name,
        phone: form.phone,
        email: form.email.trim().toLowerCase(),
        whatsapp: whatsappDigits(form.whatsapp),
        bio: form.bio,
        existingPhoto,
        photoFile,
      });
      setPhotoFile(null);
      setSaved(true);
    } catch (err) {
      window.alert(err.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  if (advisorId == null) return <div className="empty-state">{t("accessControl.restricted")}</div>;
  if (loading) return <div className="empty-state">{t("common.loading")}</div>;
  if (notFound) return <div className="empty-state">{t("accessControl.restricted")}</div>;

  return (
    <div>
      <div className="admin-header">
        <h1>Mi perfil</h1>
      </div>

      <form className="card admin-form" onSubmit={handleSubmit} noValidate>
        <div className="form-field">
          <label htmlFor="mp-name">Nombre</label>
          <input id="mp-name" value={form.name} onChange={handleChange("name")} />
          {errors.name && <span className="form-error">{errors.name}</span>}
        </div>

        <div className="form-row">
          <div className="form-field">
            <label htmlFor="mp-phone">Teléfono</label>
            <input id="mp-phone" value={form.phone} onChange={handleChange("phone")} />
            {errors.phone && <span className="form-error">{errors.phone}</span>}
          </div>
          <div className="form-field">
            <label htmlFor="mp-email">Correo</label>
            <input id="mp-email" type="email" value={form.email} onChange={handleChange("email")} />
            {errors.email && <span className="form-error">{errors.email}</span>}
          </div>
        </div>

        <div className="form-field">
          <label htmlFor="mp-whatsapp">WhatsApp (formato 521XXXXXXXXXX)</label>
          <input id="mp-whatsapp" value={form.whatsapp} onChange={handleChange("whatsapp")} />
        </div>

        <div className="form-field">
          <label htmlFor="mp-bio">Puesto / descripción breve</label>
          <textarea id="mp-bio" rows={3} value={form.bio} onChange={handleChange("bio")} placeholder="Ej. Asesora Inmobiliaria" />
          <p className="form-hint">Aparece debajo de tu nombre en la página de Nosotros.</p>
        </div>

        <div className="form-field">
          <label>Foto</label>
          {preview && <img src={preview} alt="" style={{ width: 96, height: 96, borderRadius: "50%", objectFit: "cover", marginBottom: "0.75rem" }} />}
          <input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files?.[0] || null)} />
        </div>

        <div className="admin-form__actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <span className="spinner" /> : null}
            {t("common.save")}
          </button>
          {saved && <span className="form-hint">Guardado.</span>}
        </div>
      </form>
    </div>
  );
}
