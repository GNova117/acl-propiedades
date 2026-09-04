import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { propertyTypeLabel } from "../../lib/format";
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
  operation_type: "compra",
  active: true,
  advisor_ids: [],
  colindancias: "",
  servicios: "",
  acabados: "",
  sistema_constructivo: "",
  techumbre: "",
  condicion_propiedad: "",
  estatus_construccion: "",
  altura_libre: "",
  anio_construccion: "",
  area_minima_divisible: "",
  area_oficina: "",
  luz_natural_pct: "",
  sistema_contra_incendios: "",
  tipo_seguridad: "",
  andenes_carga: "",
  rampas_vehiculares: "",
  mantenimiento_pct: "",
};

// `fixedType`: apartado de un solo tipo (Naves Industriales) — el tipo
// llega fijo, el selector de Tipo no se muestra, y al guardar/cancelar
// regresa a `listPath` en vez del listado general de Propiedades.
export default function AdminPropertyForm({
  fixedType,
  listPath = "/admin/propiedades",
  newTitleKey = "admin.newProperty",
  editTitleKey = "admin.editProperty",
}) {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [form, setForm] = useState(() => (fixedType ? { ...EMPTY, type: fixedType } : EMPTY));
  const [zones, setZones] = useState([]);
  const [advisors, setAdvisors] = useState([]);
  const [propertyTypes, setPropertyTypes] = useState([]);
  const [existingImages, setExistingImages] = useState([]);
  const [newFiles, setNewFiles] = useState([]);
  const [mainIndex, setMainIndex] = useState(0);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);

  useEffect(() => {
    db.getZones().then(setZones);
    db.getAdvisors().then(setAdvisors);
    db.getPropertyTypes().then(setPropertyTypes);
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
        operation_type: property.operation_type || "compra",
        active: property.active,
        advisor_ids: property.advisor_ids || [],
        colindancias: property.colindancias || "",
        servicios: property.servicios || "",
        acabados: property.acabados || "",
        sistema_constructivo: property.sistema_constructivo || "",
        techumbre: property.techumbre || "",
        condicion_propiedad: property.condicion_propiedad || "",
        estatus_construccion: property.estatus_construccion || "",
        altura_libre: property.altura_libre ?? "",
        anio_construccion: property.anio_construccion ?? "",
        area_minima_divisible: property.area_minima_divisible ?? "",
        area_oficina: property.area_oficina ?? "",
        luz_natural_pct: property.luz_natural_pct ?? "",
        sistema_contra_incendios: property.sistema_contra_incendios || "",
        tipo_seguridad: property.tipo_seguridad || "",
        andenes_carga: property.andenes_carga ?? "",
        rampas_vehiculares: property.rampas_vehiculares ?? "",
        mantenimiento_pct: property.mantenimiento_pct ?? "",
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
      navigate(listPath);
    } catch (err) {
      window.alert(err.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="empty-state">{t("common.loading")}</div>;

  const typeOptions = fixedType
    ? propertyTypes.filter((pt) => pt.key === fixedType)
    : propertyTypes.filter((pt) => pt.key !== "nave_industrial");

  return (
    <div>
      <div className="admin-header">
        <h1>{isEdit ? t(editTitleKey) : t(newTitleKey)}</h1>
      </div>

      <form className="card admin-form" onSubmit={handleSubmit} noValidate>
        <div className="form-row">
          <div className="form-field">
            <label htmlFor="p-title">Título</label>
            <input id="p-title" value={form.title} onChange={handleChange("title")} />
            {errors.title && <span className="form-error">{errors.title}</span>}
          </div>
          {!fixedType && (
            <div className="form-field">
              <label htmlFor="p-type">{t("properties.type")}</label>
              <select id="p-type" value={form.type} onChange={handleChange("type")}>
                {typeOptions.map((pt) => (
                  <option key={pt.id} value={pt.key}>{propertyTypeLabel(t, pt.key)}</option>
                ))}
              </select>
            </div>
          )}
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
          <label htmlFor="p-operation">{t("properties.operationType")}</label>
          <select id="p-operation" value={form.operation_type} onChange={handleChange("operation_type")}>
            <option value="compra">{t("propertyOperation.compra")}</option>
            <option value="renta">{t("propertyOperation.renta")}</option>
          </select>
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

        <p className="form-hint" style={{ marginTop: "-0.5rem" }}>{t("admin.propertySpecsHint")}</p>

        <div className="form-row">
          <div className="form-field">
            <label htmlFor="p-colindancias">{t("detail.colindancias")}</label>
            <textarea id="p-colindancias" rows={2} value={form.colindancias} onChange={handleChange("colindancias")} />
          </div>
          <div className="form-field">
            <label htmlFor="p-servicios">{t("detail.servicios")}</label>
            <textarea id="p-servicios" rows={2} value={form.servicios} onChange={handleChange("servicios")} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label htmlFor="p-acabados">{t("detail.acabados")}</label>
            <textarea id="p-acabados" rows={2} value={form.acabados} onChange={handleChange("acabados")} />
          </div>
          <div className="form-field">
            <label htmlFor="p-sistema-constructivo">{t("detail.sistemaConstructivo")}</label>
            <textarea id="p-sistema-constructivo" rows={2} value={form.sistema_constructivo} onChange={handleChange("sistema_constructivo")} />
          </div>
        </div>

        {fixedType === "nave_industrial" && (
          <>
            <p className="form-hint" style={{ marginTop: "-0.5rem" }}>{t("admin.industrialSpecsHint")}</p>

            <div className="form-row">
              <div className="form-field">
                <label htmlFor="p-techumbre">{t("detail.techumbre")}</label>
                <input id="p-techumbre" value={form.techumbre} onChange={handleChange("techumbre")} />
              </div>
              <div className="form-field">
                <label htmlFor="p-condicion">{t("detail.condicionPropiedad")}</label>
                <input id="p-condicion" value={form.condicion_propiedad} onChange={handleChange("condicion_propiedad")} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-field">
                <label htmlFor="p-estatus-construccion">{t("detail.estatusConstruccion")}</label>
                <input id="p-estatus-construccion" value={form.estatus_construccion} onChange={handleChange("estatus_construccion")} />
              </div>
              <div className="form-field">
                <label htmlFor="p-anio-construccion">{t("detail.anioConstruccion")}</label>
                <input id="p-anio-construccion" type="number" min="1900" value={form.anio_construccion} onChange={handleChange("anio_construccion")} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-field">
                <label htmlFor="p-altura-libre">{t("detail.alturaLibre")} (m)</label>
                <input id="p-altura-libre" type="number" min="0" step="0.1" value={form.altura_libre} onChange={handleChange("altura_libre")} />
              </div>
              <div className="form-field">
                <label htmlFor="p-area-minima">{t("detail.areaMinimaDivisible")} (m²)</label>
                <input id="p-area-minima" type="number" min="0" value={form.area_minima_divisible} onChange={handleChange("area_minima_divisible")} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-field">
                <label htmlFor="p-area-oficina">{t("detail.areaOficina")} (m²)</label>
                <input id="p-area-oficina" type="number" min="0" value={form.area_oficina} onChange={handleChange("area_oficina")} />
              </div>
              <div className="form-field">
                <label htmlFor="p-luz-natural">{t("detail.luzNatural")} (%)</label>
                <input id="p-luz-natural" type="number" min="0" max="100" step="0.1" value={form.luz_natural_pct} onChange={handleChange("luz_natural_pct")} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-field">
                <label htmlFor="p-andenes">{t("detail.andenesCarga")}</label>
                <input id="p-andenes" type="number" min="0" value={form.andenes_carga} onChange={handleChange("andenes_carga")} />
              </div>
              <div className="form-field">
                <label htmlFor="p-rampas">{t("detail.rampasVehiculares")}</label>
                <input id="p-rampas" type="number" min="0" value={form.rampas_vehiculares} onChange={handleChange("rampas_vehiculares")} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-field">
                <label htmlFor="p-contra-incendios">{t("detail.sistemaContraIncendios")}</label>
                <input id="p-contra-incendios" value={form.sistema_contra_incendios} onChange={handleChange("sistema_contra_incendios")} />
              </div>
              <div className="form-field">
                <label htmlFor="p-seguridad">{t("detail.tipoSeguridad")}</label>
                <input id="p-seguridad" value={form.tipo_seguridad} onChange={handleChange("tipo_seguridad")} />
              </div>
            </div>

            <div className="form-field">
              <label htmlFor="p-mantenimiento">{t("detail.mantenimiento")} (%)</label>
              <input id="p-mantenimiento" type="number" min="0" max="100" step="0.1" value={form.mantenimiento_pct} onChange={handleChange("mantenimiento_pct")} />
            </div>
          </>
        )}

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
          <button type="button" className="btn btn-outline" onClick={() => navigate(listPath)}>
            {t("common.cancel")}
          </button>
        </div>
      </form>
    </div>
  );
}
