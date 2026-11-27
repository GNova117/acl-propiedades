import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { normalizeMxWhatsapp } from "../../lib/format";
import { useAuth } from "../../context/AuthContext";
import VisitScheduleEditor from "../../components/VisitScheduleEditor";
import "./admin.css";
import LoadingState from "../../components/LoadingState";
import { confirmDialog, notify } from "../../lib/toast";
import { notifyLoadError } from "../../lib/loadError";
import { useUnsavedChanges } from "../../lib/useUnsavedChanges";
import { advisorImpact } from "../../lib/advisorImpact";

const EMPTY = { name: "", phone: "", email: "", whatsapp: "", bio: "", active: true, show_in_team: true };

export default function AdminAdvisorForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { hasSection } = useAuth();

  const [form, setForm] = useState(EMPTY);
  const [existingPhoto, setExistingPhoto] = useState("");
  const [wasActive, setWasActive] = useState(true);
  const [photoFile, setPhotoFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  // Cerrar la pestaña con cambios sin guardar pide confirmar.
  useUnsavedChanges(form, { ready: !loading, enabled: !saving });

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
        show_in_team: advisor.show_in_team !== false,
      });
      setExistingPhoto(advisor.photo_url || "");
      setWasActive(advisor.active !== false);
      setLoading(false);
    }).catch((err) => { notifyLoadError(err); setLoading(false); });
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
    // El puesto/descripción se muestra debajo del nombre en /nosotros — sin
    // este campo la tarjeta del asesor queda visualmente incompleta junto a
    // las que sí lo tienen. Se exige desde aquí en adelante; los asesores ya
    // guardados sin descripción no se tocan solos, hay que completarlos a mano.
    if (!form.bio.trim()) next.bio = t("contact.required");
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    // Al desactivar a un asesor se avisa qué se queda sin responsable (citas por venir, prospectos abiertos, propiedades).
    if (isEdit && wasActive && !form.active) {
      try {
        const [citas, prospects, properties] = await Promise.all([db.getAgendaCitas(), db.getProspects(), db.getProperties({})]);
        const impact = advisorImpact(id, { citas, prospects, properties });
        if (impact.total > 0 && !(await confirmDialog(t("advisorForm.deactivateWarning", impact)))) return;
      } catch {
        /* sin poder calcular el impacto: se deja continuar (el aviso es una ayuda, no un candado) */
      }
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        email: form.email.trim().toLowerCase(),
        whatsapp: normalizeMxWhatsapp(form.whatsapp),
        existingPhoto,
        photoFile,
      };
      if (isEdit) {
        await db.updateAdvisor(id, payload);
      } else {
        await db.addAdvisor(payload);
      }
      navigate("/admin/asesores");
    } catch (err) {
      notify(err.message || t("common.saveError"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState />;

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
          <label htmlFor="a-whatsapp">{t("advisorForm.whatsappLabel")}</label>
          <input id="a-whatsapp" value={form.whatsapp} onChange={handleChange("whatsapp")} />
        </div>

        <div className="form-field">
          <label htmlFor="a-bio">Puesto / descripción breve</label>
          <textarea id="a-bio" rows={3} value={form.bio} onChange={handleChange("bio")} placeholder="Ej. Asesora Inmobiliaria" />
          <p className="form-hint">Aparece debajo del nombre en la página de Nosotros — que no quede en blanco mantiene parejas todas las tarjetas del equipo.</p>
          {errors.bio && <span className="form-error">{errors.bio}</span>}
        </div>

        <div className="form-field">
          <label>Foto</label>
          {preview && <img src={preview} alt="" style={{ width: 96, height: 96, borderRadius: "50%", objectFit: "cover", marginBottom: "0.75rem" }} />}
          <input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files?.[0] || null)} />
        </div>

        <div className="form-field">
          <label>
            <input type="checkbox" checked={form.active} onChange={handleChange("active")} className="mr-2" />
            {t("common.active")}
          </label>
        </div>

        <div className="form-field">
          <label>
            <input type="checkbox" checked={form.show_in_team} onChange={handleChange("show_in_team")} className="mr-2" />
            Mostrar en la página de Nosotros
          </label>
          {/* Nosotros solo lista asesores con foto: una tarjeta sin foto se ve incompleta. */}
          {form.show_in_team && !photoFile && !existingPhoto && <p className="form-error">{t("advisorForm.photoNeeded")}</p>}
          <p className="form-hint">Desmárcalo para el contacto general de la empresa (ej. "ACL Propiedades") — sigue disponible como asesor de propiedades sin agente asignado, solo deja de listarse como integrante del equipo.</p>
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

      {/* Solo al editar (el asesor nuevo todavía no tiene id) y con acceso a la Agenda. */}
      {isEdit && hasSection("agenda") && <VisitScheduleEditor advisorId={id} />}
    </div>
  );
}
