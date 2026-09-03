import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import MaterialsTable from "../../components/MaterialsTable";
import SpacesEditor from "../../components/SpacesEditor";
import "./admin.css";

const EMPTY = { name: "", client_id: "", area_m2: "", notes: "", materials: [], spaces: [] };

export default function AdminRemodelProjectForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY);
  const [clients, setClients] = useState([]);
  const [linkedProperty, setLinkedProperty] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);

  useEffect(() => {
    db.getClients().then(setClients);
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    db.getRemodelProjectById(id).then((project) => {
      if (!project) return;
      setForm({
        name: project.name,
        client_id: project.client_id || "",
        area_m2: project.area_m2,
        notes: project.notes || "",
        materials: project.materials || [],
        spaces: project.spaces || [],
      });
      // property_id no se edita aquí: es un vínculo fijado al crear la
      // propiedad (ver addProperty en supabaseBackend/localBackend). Solo se
      // muestra como referencia.
      if (project.property_id) {
        db.getPropertyById(project.property_id).then(setLinkedProperty);
      }
      setLoading(false);
    });
  }, [id, isEdit]);

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleAddSuggestedMaterial = (row) => {
    setForm((prev) => ({ ...prev, materials: [...prev.materials, row] }));
  };

  const validate = () => {
    const next = {};
    if (!form.name.trim()) next.name = t("contact.required");
    if (!form.area_m2 || Number(form.area_m2) <= 0) next.area_m2 = t("contact.required");
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = { ...form, client_id: form.client_id || null };
      if (isEdit) {
        await db.updateRemodelProject(id, payload);
      } else {
        await db.addRemodelProject(payload);
      }
      navigate("/admin/remodelaciones");
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
        <h1>{isEdit ? t("admin.editRemodelProject") : t("admin.newRemodelProject")}</h1>
      </div>

      <form className="card admin-form" onSubmit={handleSubmit} noValidate>
        {linkedProperty && (
          <p className="form-hint">
            {t("remodelCalculator.linkedProperty")}: <Link to={`/admin/propiedades/${linkedProperty.id}`}>{linkedProperty.title}</Link>
          </p>
        )}

        <div className="form-row">
          <div className="form-field">
            <label htmlFor="r-name">{t("remodelCalculator.projectName")}</label>
            <input id="r-name" value={form.name} onChange={handleChange("name")} />
            {errors.name && <span className="form-error">{errors.name}</span>}
          </div>
          <div className="form-field">
            <label htmlFor="r-area">{t("remodelCalculator.area")}</label>
            <input id="r-area" type="number" min="0" value={form.area_m2} onChange={handleChange("area_m2")} />
            {errors.area_m2 && <span className="form-error">{errors.area_m2}</span>}
          </div>
        </div>

        <div className="form-field">
          <label htmlFor="r-client">{t("remodelCalculator.client")}</label>
          <select id="r-client" value={form.client_id} onChange={handleChange("client_id")}>
            <option value="">{t("remodelCalculator.noClient")}</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="r-notes">{t("remodelCalculator.notes")}</label>
          <textarea id="r-notes" rows={3} value={form.notes} onChange={handleChange("notes")} />
        </div>

        <div className="form-field">
          <label>{t("spaces.title")}</label>
          <SpacesEditor
            spaces={form.spaces}
            onChange={(updater) => setForm((prev) => ({ ...prev, spaces: updater(prev.spaces) }))}
            onAddMaterial={handleAddSuggestedMaterial}
          />
        </div>

        <div className="form-field">
          <label>{t("remodelCalculator.materials")}</label>
          <MaterialsTable
            materials={form.materials}
            onChange={(updater) => setForm((prev) => ({ ...prev, materials: updater(prev.materials) }))}
          />
        </div>

        <div className="admin-form__actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <span className="spinner" /> : null}
            {t("common.save")}
          </button>
          <button type="button" className="btn btn-outline" onClick={() => navigate("/admin/remodelaciones")}>
            {t("common.cancel")}
          </button>
        </div>
      </form>
    </div>
  );
}
