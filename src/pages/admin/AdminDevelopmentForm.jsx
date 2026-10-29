import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import ImageUploader from "../../components/ImageUploader";
import { db } from "../../lib/dataStore";
import {
  DEVELOPMENT_STAGES,
  UNIT_STATUSES,
  parseUnitsCsv,
  unitsToCsv,
  validateDevelopment,
  modelKeyFromName,
} from "../../lib/developments";
import { formatMXN } from "../../lib/format";
import "./admin.css";
import "./AdminDevelopmentForm.css";

const EMPTY_MODEL = { name: "", area_m2: "", bedrooms: "", bathrooms: "", parking: "", description: "", existingImages: [], imageFiles: [], existingPlan: "", planFile: null };

const EMPTY = {
  name: "",
  tagline: "",
  description: "",
  zone: "",
  address: "",
  lat: "",
  lng: "",
  stage: "preventa",
  delivery_date: "",
  developer_name: "",
  disclaimer: "",
  published: false,
  amenitiesText: "",
};

// Una llave técnica por modelo, única dentro del desarrollo ("modelo-b",
// "modelo-b-2"…). Una vez creada no cambia aunque se renombre el modelo, para
// que los departamentos ya cargados no queden apuntando a nada.
function uniqueModelKey(name, models) {
  const base = modelKeyFromName(name);
  const taken = new Set(models.map((m) => m.key));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

export default function AdminDevelopmentForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY);
  const [existing, setExisting] = useState(null);
  const [existingHero, setExistingHero] = useState("");
  const [heroFile, setHeroFile] = useState(null);
  const [existingLogo, setExistingLogo] = useState("");
  const [logoFile, setLogoFile] = useState(null);
  const [existingImages, setExistingImages] = useState([]);
  const [imageFiles, setImageFiles] = useState([]);
  const [models, setModels] = useState([]);
  const [units, setUnits] = useState([]);
  const [csvText, setCsvText] = useState("");
  const [csvErrors, setCsvErrors] = useState([]);
  const [csvNotice, setCsvNotice] = useState("");
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [heroPreview, setHeroPreview] = useState("");
  const [logoPreview, setLogoPreview] = useState("");

  useEffect(() => {
    if (!isEdit) return;
    db.getDevelopmentById(id).then((development) => {
      if (!development) {
        navigate("/admin/desarrollos");
        return;
      }
      setExisting(development);
      setForm({
        name: development.name,
        tagline: development.tagline || "",
        description: development.description || "",
        zone: development.zone,
        address: development.address || "",
        lat: development.lat ?? "",
        lng: development.lng ?? "",
        stage: development.stage,
        delivery_date: development.delivery_date || "",
        developer_name: development.developer_name,
        disclaimer: development.disclaimer || "",
        published: development.published,
        amenitiesText: (development.amenities || []).join("\n"),
      });
      setExistingHero(development.hero_image || "");
      setExistingLogo(development.developer_logo || "");
      setExistingImages(development.images || []);
      setModels(
        (development.models || []).map((m) => ({
          ...EMPTY_MODEL,
          ...m,
          area_m2: m.area_m2 ?? "",
          bedrooms: m.bedrooms ?? "",
          bathrooms: m.bathrooms ?? "",
          parking: m.parking ?? "",
          description: m.description || "",
          existingImages: m.images || [],
          existingPlan: m.plan_image || "",
        }))
      );
      setUnits(development.units || []);
      setLoading(false);
    });
  }, [id, isEdit, navigate]);

  useEffect(() => {
    if (heroFile) {
      const url = URL.createObjectURL(heroFile);
      setHeroPreview(url);
      return () => URL.revokeObjectURL(url);
    }
    setHeroPreview(existingHero);
    return undefined;
  }, [heroFile, existingHero]);

  useEffect(() => {
    if (logoFile) {
      const url = URL.createObjectURL(logoFile);
      setLogoPreview(url);
      return () => URL.revokeObjectURL(url);
    }
    setLogoPreview(existingLogo);
    return undefined;
  }, [logoFile, existingLogo]);

  const handleChange = (field) => (e) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateModel = (index, patch) => setModels((prev) => prev.map((m, i) => (i === index ? { ...m, ...patch } : m)));

  const addModel = () => {
    setModels((prev) => {
      const name = `Modelo ${String.fromCharCode(65 + prev.length)}`;
      return [...prev, { ...EMPTY_MODEL, name, key: uniqueModelKey(name, prev) }];
    });
  };

  const removeModel = (index) => {
    const model = models[index];
    if (units.some((u) => u.model === model.key) && !window.confirm(t("developments.admin.model.unitsUsing", { count: units.filter((u) => u.model === model.key).length }))) return;
    setModels((prev) => prev.filter((_, i) => i !== index));
    setUnits((prev) => prev.filter((u) => u.model !== model.key));
  };

  const applyCsv = () => {
    const { units: parsed, errors: parseErrors } = parseUnitsCsv(csvText, models);
    setCsvErrors(parseErrors);
    if (parseErrors.length > 0 || parsed.length === 0) {
      setCsvNotice("");
      return;
    }
    if (units.length > 0 && !window.confirm(t("developments.admin.units.replaceWarning", { count: units.length }))) return;
    setUnits(parsed);
    setCsvNotice(t("developments.admin.units.loaded", { count: parsed.length }));
  };

  const setUnitStatus = (number, status) => setUnits((prev) => prev.map((u) => (u.number === number ? { ...u, status } : u)));

  const downloadCsv = () => {
    const blob = new Blob([unitsToCsv(units, models)], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${existing?.slug || "desarrollo"}-departamentos.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const unitsPerModel = useMemo(() => {
    const counts = new Map();
    for (const unit of units) counts.set(unit.model, (counts.get(unit.model) || 0) + 1);
    return counts;
  }, [units]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      amenities: form.amenitiesText.split("\n"),
      models,
      units,
      heroFile,
      existingHero,
      logoFile,
      existingLogo,
      existingImages,
      imageFiles,
    };
    const found = validateDevelopment(payload);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    try {
      await db.saveDevelopment(payload, existing);
      navigate("/admin/desarrollos");
    } catch (err) {
      window.alert(err.message || t("developments.admin.saveError"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="empty-state">{t("common.loading")}</div>;

  const fieldError = (name) => errors[name] && <span className="form-error">{t(`developments.admin.errors.${errors[name]}`)}</span>;

  return (
    <div>
      <div className="admin-header">
        <h1>{isEdit ? t("developments.admin.edit") : t("developments.admin.new")}</h1>
      </div>

      <form className="card admin-form dev-admin-form" onSubmit={handleSubmit} noValidate>
        <h2>{t("developments.admin.sections.basics")}</h2>
        <div className="dev-admin-grid">
          <div className="form-field dev-admin-grid__wide">
            <label htmlFor="dev-name">{t("developments.admin.fields.name")}</label>
            <input id="dev-name" value={form.name} onChange={handleChange("name")} />
            {fieldError("name")}
          </div>
          <div className="form-field dev-admin-grid__wide">
            <label htmlFor="dev-tagline">{t("developments.admin.fields.tagline")}</label>
            <input id="dev-tagline" value={form.tagline} onChange={handleChange("tagline")} />
          </div>
          <div className="form-field dev-admin-grid__wide">
            <label htmlFor="dev-developer">{t("developments.admin.fields.developer")}</label>
            <input id="dev-developer" value={form.developer_name} onChange={handleChange("developer_name")} />
            <p className="form-hint">{t("developments.admin.fields.developerHint")}</p>
            {fieldError("developer_name")}
          </div>
          <div className="form-field">
            <label htmlFor="dev-zone">{t("developments.admin.fields.zone")}</label>
            <input id="dev-zone" value={form.zone} onChange={handleChange("zone")} />
            {fieldError("zone")}
          </div>
          <div className="form-field">
            <label htmlFor="dev-stage">{t("developments.admin.fields.stage")}</label>
            <select id="dev-stage" value={form.stage} onChange={handleChange("stage")}>
              {DEVELOPMENT_STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {t(`developments.stage.${stage}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="dev-delivery">{t("developments.admin.fields.deliveryDate")}</label>
            <input id="dev-delivery" value={form.delivery_date} onChange={handleChange("delivery_date")} placeholder="Diciembre 2027" />
          </div>
          <div className="form-field dev-admin-grid__wide">
            <label htmlFor="dev-address">{t("developments.admin.fields.address")}</label>
            <input id="dev-address" value={form.address} onChange={handleChange("address")} />
          </div>
          <div className="form-field">
            <label htmlFor="dev-lat">{t("developments.admin.fields.lat")}</label>
            <input id="dev-lat" type="number" step="any" value={form.lat} onChange={handleChange("lat")} />
          </div>
          <div className="form-field">
            <label htmlFor="dev-lng">{t("developments.admin.fields.lng")}</label>
            <input id="dev-lng" type="number" step="any" value={form.lng} onChange={handleChange("lng")} />
          </div>
          <div className="form-field dev-admin-grid__full">
            <label htmlFor="dev-description">{t("developments.admin.fields.description")}</label>
            <textarea id="dev-description" rows={5} value={form.description} onChange={handleChange("description")} />
          </div>
          <div className="form-field dev-admin-grid__full">
            <label htmlFor="dev-amenities">{t("developments.admin.fields.amenities")}</label>
            <textarea id="dev-amenities" rows={5} value={form.amenitiesText} onChange={handleChange("amenitiesText")} />
          </div>
        </div>

        <h2>{t("developments.admin.sections.photos")}</h2>
        <div className="form-field">
          <label>{t("developments.admin.fields.hero")}</label>
          {heroPreview && <img src={heroPreview} alt="" className="dev-admin-preview" />}
          <input type="file" accept="image/*" onChange={(e) => setHeroFile(e.target.files?.[0] || null)} />
          <p className="form-hint">{t("developments.admin.fields.heroHint")}</p>
        </div>
        <div className="form-field">
          <label>{t("developments.admin.fields.logo")}</label>
          {logoPreview && <img src={logoPreview} alt="" className="dev-admin-preview dev-admin-preview--logo" />}
          <input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} />
          {existingLogo && !logoFile && (
            <button type="button" className="btn btn-outline btn-sm" style={{ marginTop: "0.5rem" }} onClick={() => setExistingLogo("")}>
              {t("common.delete")}
            </button>
          )}
        </div>
        <div className="form-field">
          <label>{t("developments.admin.fields.gallery")}</label>
          <ImageUploader
            existingImages={existingImages}
            files={imageFiles}
            mainIndex={-1}
            showMain={false}
            onRemoveExisting={(index) => setExistingImages((prev) => prev.filter((_, i) => i !== index))}
            onAddFiles={(added) => setImageFiles((prev) => [...prev, ...added])}
            onRemoveNew={(index) => setImageFiles((prev) => prev.filter((_, i) => i !== index))}
            onSetMain={() => {}}
          />
        </div>

        <h2>{t("developments.admin.sections.models")}</h2>
        {errors.models && <span className="form-error">{t(`developments.admin.errors.${errors.models}`)}</span>}
        <div className="dev-admin-models">
          {models.map((model, index) => (
            <fieldset key={model.key} className="dev-admin-model">
              <legend>{model.name || model.key}</legend>
              <div className="dev-admin-grid">
                <div className="form-field dev-admin-grid__wide">
                  <label>{t("developments.admin.model.name")}</label>
                  <input value={model.name} onChange={(e) => updateModel(index, { name: e.target.value })} />
                </div>
                <div className="form-field">
                  <label>{t("developments.admin.model.area")}</label>
                  <input type="number" min="0" step="any" value={model.area_m2} onChange={(e) => updateModel(index, { area_m2: e.target.value })} />
                </div>
                <div className="form-field">
                  <label>{t("developments.admin.model.bedrooms")}</label>
                  <input type="number" min="0" value={model.bedrooms} onChange={(e) => updateModel(index, { bedrooms: e.target.value })} />
                </div>
                <div className="form-field">
                  <label>{t("developments.admin.model.bathrooms")}</label>
                  <input type="number" min="0" step="0.5" value={model.bathrooms} onChange={(e) => updateModel(index, { bathrooms: e.target.value })} />
                </div>
                <div className="form-field">
                  <label>{t("developments.admin.model.parking")}</label>
                  <input type="number" min="0" value={model.parking} onChange={(e) => updateModel(index, { parking: e.target.value })} />
                </div>
                <div className="form-field dev-admin-grid__full">
                  <label>{t("developments.admin.model.description")}</label>
                  <input value={model.description} onChange={(e) => updateModel(index, { description: e.target.value })} />
                </div>
              </div>
              <div className="form-field">
                <label>{t("developments.admin.model.photos")}</label>
                <ImageUploader
                  existingImages={model.existingImages}
                  files={model.imageFiles}
                  mainIndex={-1}
                  showMain={false}
                  onRemoveExisting={(i) => updateModel(index, { existingImages: model.existingImages.filter((_, j) => j !== i) })}
                  onAddFiles={(added) => updateModel(index, { imageFiles: [...model.imageFiles, ...added] })}
                  onRemoveNew={(i) => updateModel(index, { imageFiles: model.imageFiles.filter((_, j) => j !== i) })}
                  onSetMain={() => {}}
                />
              </div>
              <div className="form-field">
                <label>{t("developments.admin.model.plan")}</label>
                {model.existingPlan && !model.planFile && <img src={model.existingPlan} alt="" className="dev-admin-preview" />}
                <input type="file" accept="image/*" onChange={(e) => updateModel(index, { planFile: e.target.files?.[0] || null })} />
              </div>
              <div className="dev-admin-model__foot">
                <span className="form-hint">{t("developments.admin.model.unitsUsing", { count: unitsPerModel.get(model.key) || 0 })}</span>
                <button type="button" className="btn btn-danger btn-sm" onClick={() => removeModel(index)}>
                  {t("developments.admin.model.remove")}
                </button>
              </div>
            </fieldset>
          ))}
        </div>
        <button type="button" className="btn btn-outline" onClick={addModel}>
          + {t("developments.admin.model.add")}
        </button>

        <h2>{t("developments.admin.sections.units")}</h2>
        {errors.units && <span className="form-error">{t(`developments.admin.errors.${errors.units}`)}</span>}
        <p className="form-hint">{t("developments.admin.units.hint")}</p>
        <div className="form-field">
          <label htmlFor="dev-csv">{t("developments.admin.units.paste")}</label>
          <textarea
            id="dev-csv"
            rows={7}
            className="dev-admin-csv"
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder={"numero,piso,modelo,precio,estatus,vista\n101,1,Modelo A,1750000,disponible,Norte"}
          />
        </div>
        <div className="dev-admin-csv-actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={applyCsv} disabled={!csvText.trim() || models.length === 0}>
            {t("developments.admin.units.apply")}
          </button>
          {units.length > 0 && (
            <button type="button" className="btn btn-outline btn-sm" onClick={downloadCsv}>
              {t("developments.admin.units.download")}
            </button>
          )}
          {csvNotice && <span className="dev-admin-ok">{csvNotice}</span>}
        </div>
        {csvErrors.length > 0 && (
          <div className="dev-admin-csv-errors" role="alert">
            <strong>{t("developments.admin.units.errorsTitle")}</strong>
            <ul>
              {csvErrors.slice(0, 12).map((error) => (
                <li key={`${error.line}-${error.message}`}>
                  {t("developments.admin.units.line", { line: error.line })}: {error.message}
                </li>
              ))}
              {csvErrors.length > 12 && <li>… +{csvErrors.length - 12}</li>}
            </ul>
          </div>
        )}

        {units.length > 0 && (
          <details className="dev-admin-units" open={units.length <= 12}>
            <summary>{t("developments.admin.units.table", { count: units.length })}</summary>
            <div className="dev-admin-units__scroll">
              <table className="dev-admin-table">
                <thead>
                  <tr>
                    <th>{t("developments.admin.units.number")}</th>
                    <th>{t("developments.admin.units.floor")}</th>
                    <th>{t("developments.admin.units.model")}</th>
                    <th>{t("developments.admin.units.price")}</th>
                    <th>{t("developments.admin.units.status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {units.map((unit) => (
                    <tr key={unit.number}>
                      <td>{unit.number}</td>
                      <td>{unit.floor}</td>
                      <td>{models.find((m) => m.key === unit.model)?.name || unit.model}</td>
                      <td>{formatMXN(unit.price)}</td>
                      <td>
                        <select value={unit.status} onChange={(e) => setUnitStatus(unit.number, e.target.value)} aria-label={`${unit.number}`}>
                          {UNIT_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {t(`developments.legend.${status}`)}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}

        <h2>{t("developments.admin.sections.publish")}</h2>
        <div className="form-field">
          <label htmlFor="dev-disclaimer">{t("developments.admin.fields.disclaimer")}</label>
          <textarea id="dev-disclaimer" rows={3} value={form.disclaimer} onChange={handleChange("disclaimer")} />
          <p className="form-hint">{t("developments.admin.fields.disclaimerHint")}</p>
        </div>
        <div className="form-field">
          <label>
            <input type="checkbox" checked={form.published} onChange={handleChange("published")} style={{ marginRight: "0.5rem" }} />
            {t("developments.admin.fields.published")}
          </label>
          <p className="form-hint">{t("developments.admin.fields.publishedHint")}</p>
        </div>

        <div className="admin-form__actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <span className="spinner" /> : null}
            {t("common.save")}
          </button>
          <button type="button" className="btn btn-outline" onClick={() => navigate("/admin/desarrollos")}>
            {t("common.cancel")}
          </button>
        </div>
      </form>
    </div>
  );
}
