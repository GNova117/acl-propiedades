import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { PROPERTY_TYPES } from "../../lib/format";
import ImageUploader from "../../components/ImageUploader";
import "./admin.css";

const EMPTY = {
  title: "",
  type: "casa",
  description: "",
  price: "",
  area_m2: "",
  bedrooms: "",
  bathrooms: "",
  parking: "",
  zone: "",
  address: "",
  lat: "",
  lng: "",
  status: "disponible",
  active: true,
  advisor_ids: [],
};

export default function AdminPropertyForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY);
  const [zones, setZones] = useState([]);
  const [advisors, setAdvisors] = useState([]);
  const [existingImages, setExistingImages] = useState([]);
  const [newFiles, setNewFiles] = useState([]);
  const [mainIndex, setMainIndex] = useState(0);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);

  useEffect(() => {
    db.getZones().then(setZones);
    db.getAdvisors().then(setAdvisors);
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    db.getPropertyById(id).then((property) => {
      if (!property) return;
      setForm({
        title: property.title,
        type: property.type,
        description: property.description || "",
        price: property.price,
        area_m2: property.area_m2,
        bedrooms: property.bedrooms ?? "",
        bathrooms: property.bathrooms ?? "",
        parking: property.parking ?? "",
        zone: property.zone,
        address: property.address,
        lat: property.lat,
        lng: property.lng,
        status: property.status,
        active: property.active,
        advisor_ids: property.advisor_ids || [],
      });
      setExistingImages(property.images || []);
      setLoading(false);
    });
  }, [id, isEdit]);

  const handleChange = (field) => (e) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const toggleAdvisor = (advisorId) => {
    setForm((prev) => ({
      ...prev,
      advisor_ids: prev.advisor_ids.includes(advisorId)
        ? prev.advisor_ids.filter((a) => a !== advisorId)
        : [...prev.advisor_ids, advisorId],
    }));
  };

  const validate = () => {
    const next = {};
    if (!form.title.trim()) next.title = t("contact.required");
    if (!form.zone) next.zone = t("contact.required");
    if (!form.address.trim()) next.address = t("contact.required");
    if (!form.price || Number(form.price) <= 0) next.price = t("contact.required");
    if (!form.area_m2 || Number(form.area_m2) <= 0) next.area_m2 = t("contact.required");
    if (form.lat === "" || form.lng === "") next.lat = t("contact.required");
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = { ...form, existingImages, imageFiles: newFiles, mainImageIndex: mainIndex };
      if (isEdit) {
        await db.updateProperty(id, payload);
      } else {
        await db.addProperty(payload);
      }
      navigate("/admin/propiedades");
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
        <h1>{isEdit ? t("admin.editProperty") : t("admin.newProperty")}</h1>
      </div>

      <form className="card admin-form" onSubmit={handleSubmit} noValidate>
        <div className="form-row">
          <div className="form-field">
            <label htmlFor="p-title">Título</label>
            <input id="p-title" value={form.title} onChange={handleChange("title")} />
            {errors.title && <span className="form-error">{errors.title}</span>}
          </div>
          <div className="form-field">
            <label htmlFor="p-type">{t("properties.type")}</label>
            <select id="p-type" value={form.type} onChange={handleChange("type")}>
              {PROPERTY_TYPES.map((type) => (
                <option key={type} value={type}>{t(`propertyType.${type}`)}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-field">
          <label htmlFor="p-description">{t("detail.description")}</label>
          <textarea id="p-description" rows={4} value={form.description} onChange={handleChange("description")} />
        </div>

        <div className="form-row">
          <div className="form-field">
            <label htmlFor="p-price">Precio (MXN)</label>
            <input id="p-price" type="number" min="0" value={form.price} onChange={handleChange("price")} />
            {errors.price && <span className="form-error">{errors.price}</span>}
          </div>
          <div className="form-field">
            <label htmlFor="p-area">{t("calculator.area")}</label>
            <input id="p-area" type="number" min="0" value={form.area_m2} onChange={handleChange("area_m2")} />
            {errors.area_m2 && <span className="form-error">{errors.area_m2}</span>}
          </div>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label htmlFor="p-bedrooms">{t("properties.bedrooms")}</label>
            <input id="p-bedrooms" type="number" min="0" value={form.bedrooms} onChange={handleChange("bedrooms")} />
          </div>
          <div className="form-field">
            <label htmlFor="p-bathrooms">{t("properties.bathrooms")}</label>
            <input id="p-bathrooms" type="number" min="0" step="0.5" value={form.bathrooms} onChange={handleChange("bathrooms")} />
          </div>
          <div className="form-field">
            <label htmlFor="p-parking">Estacionamientos</label>
            <input id="p-parking" type="number" min="0" value={form.parking} onChange={handleChange("parking")} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label htmlFor="p-zone">{t("properties.zone")}</label>
            <select id="p-zone" value={form.zone} onChange={handleChange("zone")}>
              <option value="">—</option>
              {zones.map((zone) => (
                <option key={zone.id} value={zone.name}>{zone.name}</option>
              ))}
            </select>
            {errors.zone && <span className="form-error">{errors.zone}</span>}
          </div>
          <div className="form-field">
            <label htmlFor="p-status">{t("common.status")}</label>
            <select id="p-status" value={form.status} onChange={handleChange("status")}>
              <option value="disponible">{t("propertyStatus.disponible")}</option>
              <option value="apartada">{t("propertyStatus.apartada")}</option>
              <option value="vendida">{t("propertyStatus.vendida")}</option>
            </select>
          </div>
        </div>

        <div className="form-field">
          <label htmlFor="p-address">Dirección</label>
          <input id="p-address" value={form.address} onChange={handleChange("address")} />
          {errors.address && <span className="form-error">{errors.address}</span>}
        </div>

        <div className="form-row">
          <div className="form-field">
            <label htmlFor="p-lat">Latitud</label>
            <input id="p-lat" type="number" step="any" value={form.lat} onChange={handleChange("lat")} />
          </div>
          <div className="form-field">
            <label htmlFor="p-lng">Longitud</label>
            <input id="p-lng" type="number" step="any" value={form.lng} onChange={handleChange("lng")} />
          </div>
        </div>
        {errors.lat && <span className="form-error">{errors.lat}</span>}

        <div className="form-field">
          <label>
            <input type="checkbox" checked={form.active} onChange={handleChange("active")} style={{ marginRight: "0.5rem" }} />
            {t("common.active")}
          </label>
        </div>

        <div className="form-field">
          <label>{t("admin.assignAdvisors")}</label>
          <div className="admin-advisor-picker">
            {advisors.map((advisor) => (
              <label key={advisor.id}>
                <input type="checkbox" checked={form.advisor_ids.includes(advisor.id)} onChange={() => toggleAdvisor(advisor.id)} />
                <img src={advisor.photo_url} alt="" />
                {advisor.name}
              </label>
            ))}
          </div>
        </div>

        <div className="form-field">
          <label>{t("admin.images")}</label>
          <ImageUploader
            existingImages={existingImages}
            files={newFiles}
            mainIndex={mainIndex}
            onAddFiles={(files) => setNewFiles((prev) => [...prev, ...files])}
            onRemoveExisting={(index) => {
              setExistingImages((prev) => prev.filter((_, i) => i !== index));
              setMainIndex(0);
            }}
            onRemoveNew={(index) => {
              setNewFiles((prev) => prev.filter((_, i) => i !== index));
              setMainIndex(0);
            }}
            onSetMain={setMainIndex}
          />
        </div>

        <div className="admin-form__actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <span className="spinner" /> : null}
            {t("common.save")}
          </button>
          <button type="button" className="btn btn-outline" onClick={() => navigate("/admin/propiedades")}>
            {t("common.cancel")}
          </button>
        </div>
      </form>
    </div>
  );
}
