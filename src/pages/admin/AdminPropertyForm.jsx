import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { formatMXN, propertyTypeLabel } from "../../lib/format";
import { suspiciousPrice } from "../../lib/priceCheck";
import { groupZonesByCity, zoneDisplayName } from "../../lib/zones";
import ImageUploader from "../../components/ImageUploader";
import VideoUploader from "../../components/VideoUploader";
import Tour360Uploader from "../../components/Tour360Uploader";
import FloorPlanField from "../../components/FloorPlanField";
import InternalNotes from "../../components/InternalNotes";
import "./admin.css";
import LoadingState from "../../components/LoadingState";
import { confirmDialog, notify } from "../../lib/toast";
import { STEPS, clampStep, firstStepWithErrors, progressPercent, stepsWithErrors } from "../../lib/propertyFormSteps";
import { clearDraft, draftKey, isMeaningful, loadDraft, saveDraft } from "../../lib/formDraft";
import { notifyLoadError } from "../../lib/loadError";

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
  location_approximate: false,
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
  tipo_nave: "",
  amenities: [],
};

// Los campos del formulario a partir de una propiedad (para editarla o para crear una copia).
function propertyToForm(property) {
  return {
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
    location_approximate: property.location_approximate === true,
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
    tipo_nave: property.tipo_nave || "",
    amenities: property.amenities || [],
  };
}

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
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const [form, setForm] = useState(() => (fixedType ? { ...EMPTY, type: fixedType } : EMPTY));
  const [zones, setZones] = useState([]);
  const [advisors, setAdvisors] = useState([]);
  const [propertyTypes, setPropertyTypes] = useState([]);
  const [amenitiesCatalog, setAmenitiesCatalog] = useState([]);
  const [propertyCode, setPropertyCode] = useState("");
  const [existingImages, setExistingImages] = useState([]);
  const [newFiles, setNewFiles] = useState([]);
  const [mainIndex, setMainIndex] = useState(0);
  const [existingVideos, setExistingVideos] = useState([]);
  const [newVideoFiles, setNewVideoFiles] = useState([]);
  const [existingTour360, setExistingTour360] = useState([]);
  const [newTour360Files, setNewTour360Files] = useState([]);
  // Plano de la ficha pública: el que ya tiene, el nuevo por subir y si se quitó.
  const [floorPlanUrl, setFloorPlanUrl] = useState("");
  const [floorPlanFile, setFloorPlanFile] = useState(null);
  const [floorPlanRemoved, setFloorPlanRemoved] = useState(false);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [step, setStep] = useState(0);
  // Borrador automático (ver lib/formDraft.js): lo capturado se guarda en este navegador y se ofrece recuperarlo.
  const [searchParams] = useSearchParams();
  const duplicateId = !isEdit ? searchParams.get("duplicar") : null;
  const draftStorageKey = draftKey(fixedType === "nave_industrial" ? "nave" : "propiedad", isEdit ? id : "nuevo");
  const draftsEnabled = !duplicateId;
  const baselineRef = useRef(fixedType ? { ...EMPTY, type: fixedType } : EMPTY);
  const [draft, setDraft] = useState(null);
  const [draftSavedAt, setDraftSavedAt] = useState(null);

  useEffect(() => {
    db.getZones().then(setZones).catch(notifyLoadError);
    db.getAdvisors().then(setAdvisors).catch(notifyLoadError);
    db.getPropertyTypes().then(setPropertyTypes).catch(notifyLoadError);
    db.getAmenities().then(setAmenitiesCatalog).catch(() => setAmenitiesCatalog([]));
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    db.getPropertyById(id).then((property) => {
      if (!property) return;
      baselineRef.current = propertyToForm(property);
      setForm(baselineRef.current);
      setExistingImages(property.images || []);
      setExistingVideos(property.videos || []);
      setExistingTour360(property.tour_360_images || []);
      setFloorPlanUrl(property.floor_plan_url || "");
      setPropertyCode(property.code || "");
      setLoading(false);
    }).catch((err) => { notifyLoadError(err); setLoading(false); });
  }, [id, isEdit]);

  // /nueva?duplicar=<id>: una propiedad nueva con los datos de otra parecida (los de siempre se copian; fotos, videos,
  // recorrido 360°, plano, código y notas NO). Queda inactiva hasta que se publique, para no salir al sitio a medias.
  const [duplicateOf, setDuplicateOf] = useState(null);
  useEffect(() => {
    if (!duplicateId) return;
    let cancelled = false;
    db.getPropertyById(duplicateId).then((source) => {
      if (cancelled || !source) return;
      setDuplicateOf(source);
      setForm({
        ...propertyToForm(source),
        title: `${source.title}${t("duplicate.titleSuffix")}`,
        status: "disponible",
        active: false,
      });
    }).catch(notifyLoadError);
    return () => {
      cancelled = true;
    };
  }, [duplicateId, t]);

  // Al abrir el formulario: si quedó un borrador distinto de lo guardado, se ofrece recuperarlo (nunca se aplica solo).
  useEffect(() => {
    if (loading || !draftsEnabled) return;
    const saved = loadDraft(draftStorageKey);
    if (saved && isMeaningful(saved.data?.form, baselineRef.current)) setDraft(saved);
  }, [loading, draftsEnabled, draftStorageKey]);

  // Autoguardado: poco después de cada cambio (y no mientras se decide qué hacer con un borrador anterior).
  useEffect(() => {
    if (loading || !draftsEnabled || draft || saving) return;
    if (!isMeaningful(form, baselineRef.current)) return;
    const timer = setTimeout(() => {
      if (saveDraft(draftStorageKey, { form, step })) setDraftSavedAt(Date.now());
    }, 600);
    return () => clearTimeout(timer);
  }, [form, step, loading, draftsEnabled, draft, saving, draftStorageKey]);

  const restoreDraft = () => {
    setForm({ ...baselineRef.current, ...draft.data.form });
    setStep(clampStep(draft.data.step));
    setDraft(null);
  };

  const discardDraft = () => {
    clearDraft(draftStorageKey);
    setDraft(null);
  };

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

  const toggleAmenity = (key) => {
    setForm((prev) => ({
      ...prev,
      amenities: prev.amenities.includes(key) ? prev.amenities.filter((a) => a !== key) : [...prev.amenities, key],
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
    const firstWithErrors = firstStepWithErrors(next);
    if (firstWithErrors != null) setStep(firstWithErrors);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    // Un precio que parece error de captura (p. ej. $2,450 en una venta): se pide confirmar antes de guardar.
    const priceWarning = suspiciousPrice(form.operation_type, form.price);
    if (priceWarning && !(await confirmDialog(t(`propertyForm.priceWarning.${priceWarning}`, { price: formatMXN(form.price) })))) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        existingImages,
        imageFiles: newFiles,
        mainImageIndex: mainIndex,
        existingVideos,
        videoFiles: newVideoFiles,
        existingTour360Images: existingTour360,
        tour360Files: newTour360Files,
      };
      const saved = isEdit ? await db.updateProperty(id, payload) : await db.addProperty(payload);
      // El plano va aparte (setPropertyFloorPlan): si falla, la propiedad ya quedó guardada.
      const planChanged = floorPlanFile || (floorPlanRemoved && floorPlanUrl);
      if (planChanged) {
        try {
          await db.setPropertyFloorPlan(isEdit ? id : saved?.id, floorPlanFile || null);
        } catch (planErr) {
          notify(t("floorPlan.saveFailed", { message: planErr.message || "" }));
        }
      }
      clearDraft(draftStorageKey);
      navigate(listPath);
    } catch (err) {
      notify(err.message || t("common.saveError"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState />;

  const typeOptions = fixedType
    ? propertyTypes.filter((pt) => pt.key === fixedType)
    : propertyTypes.filter((pt) => pt.key !== "nave_industrial");

  return (
    <div>
      <div className="admin-header">
        <div>
          <h1>{isEdit ? t(editTitleKey) : t(newTitleKey)}</h1>
          {/* Atajo a la ficha pública (la dirección con el id se corrige sola a la legible). */}
          {isEdit && (
            <a className="btn btn-outline btn-sm" href={`/propiedades/${id}`} target="_blank" rel="noopener noreferrer">
              {t("propertyForm.viewOnSite")}
            </a>
          )}
          {isEdit && propertyCode && <p className="form-hint">{t("detail.code")}: {propertyCode}</p>}
        </div>
      </div>

      {duplicateOf && (
        <p className="card admin-form__notice" role="status">
          {t("duplicate.banner", { title: duplicateOf.title })}
        </p>
      )}

      {draft && (
        <div className="card admin-form__notice admin-form__draft" role="status">
          <span>{t("propertyForm.draftFound", { when: new Date(draft.savedAt).toLocaleString(i18n.language) })}</span>
          <span className="admin-form__draft-actions">
            <button type="button" className="btn btn-primary btn-sm" onClick={restoreDraft}>{t("propertyForm.draftRestore")}</button>
            <button type="button" className="btn btn-outline btn-sm" onClick={discardDraft}>{t("propertyForm.draftDiscard")}</button>
          </span>
        </div>
      )}

      <form className="card admin-form" onSubmit={handleSubmit} noValidate>
        <div className="form-steps">
          <div className="form-steps__summary">
            <strong>{t("propertyForm.stepLabel", { current: step + 1, total: STEPS.length })}</strong>
            <span>{t(`propertyForm.steps.${STEPS[step]}`)}</span>
            {draftSavedAt && <span className="form-steps__saved" role="status">{t("propertyForm.draftSaved")}</span>}
          </div>
          <div className="form-steps__bar" role="progressbar" aria-label={t("propertyForm.progress")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPercent(step)}>
            <div className="form-steps__fill" style={{ width: `${progressPercent(step)}%` }} />
          </div>
          <ol className="form-steps__list">
            {STEPS.map((key, i) => (
              <li key={key}>
                <button
                  type="button"
                  className={`form-steps__tab${i === step ? " is-current" : ""}${stepsWithErrors(errors).includes(i) ? " has-error" : ""}`}
                  aria-current={i === step ? "step" : undefined}
                  onClick={() => setStep(i)}
                >
                  <span className="form-steps__number" aria-hidden="true">{i + 1}</span>
                  <span className="form-steps__name">{t(`propertyForm.steps.${key}`)}</span>
                  {stepsWithErrors(errors).includes(i) && <span className="visually-hidden">{t("propertyForm.stepHasErrors")}</span>}
                </button>
              </li>
            ))}
          </ol>
        </div>

        <div className="admin-form__step" id="p-step-0" role="group" aria-labelledby="p-step-title-0" hidden={step !== 0}>
          <h2 className="admin-form__step-title" id="p-step-title-0">{t("propertyForm.steps.basics")}</h2>
          <div className="form-row">
            <div className="form-field">
              <label htmlFor="p-title">{t("propertyForm.title")}</label>
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
            {/* Google corta la descripción a ~155 caracteres: se avisa cuántos lleva. */}
            <span className="form-hint">{t("propertyForm.descriptionCount", { count: form.description.length })}</span>
            <span className="form-hint">{t("propertyForm.descriptionHint")}</span>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label htmlFor="p-price">{t("propertyForm.priceMxn")}</label>
              <input id="p-price" type="number" min="0" value={form.price} onChange={handleChange("price")} />
              {errors.price && <span className="form-error">{errors.price}</span>}
            </div>
            <div className="form-field">
              <label htmlFor="p-area">{t("calculator.area")}</label>
              <input id="p-area" type="number" min="0" value={form.area_m2} onChange={handleChange("area_m2")} />
              {errors.area_m2 && <span className="form-error">{errors.area_m2}</span>}
            </div>
          </div>
        </div>

        <div className="admin-form__step" id="p-step-1" role="group" aria-labelledby="p-step-title-1" hidden={step !== 1}>
          <h2 className="admin-form__step-title" id="p-step-title-1">{t("propertyForm.steps.location")}</h2>
          <div className="form-row">
            <div className="form-field">
              <label htmlFor="p-zone">{t("properties.zone")}</label>
              <select id="p-zone" value={form.zone} onChange={handleChange("zone")}>
                <option value="">—</option>
                {groupZonesByCity(zones).map(({ city, zones: groupZones }) => (
                  <optgroup key={city ?? "other"} label={city ?? t("zones.otherZones")}>
                    {groupZones.map((zone) => (
                      <option key={zone.id} value={zone.name}>{zoneDisplayName(zone)}</option>
                    ))}
                  </optgroup>
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
                <option value="rentada">{t("propertyStatus.rentada")}</option>
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
            <label htmlFor="p-address">{t("propertyForm.address")}</label>
            <input id="p-address" value={form.address} onChange={handleChange("address")} />
            {errors.address && <span className="form-error">{errors.address}</span>}
          </div>

          <div className="form-row">
            <div className="form-field">
              <label htmlFor="p-lat">{t("propertyForm.lat")}</label>
              <input id="p-lat" type="number" step="any" value={form.lat} onChange={handleChange("lat")} />
            </div>
            <div className="form-field">
              <label htmlFor="p-lng">{t("propertyForm.lng")}</label>
              <input id="p-lng" type="number" step="any" value={form.lng} onChange={handleChange("lng")} />
            </div>
          </div>
          {errors.lat && <span className="form-error">{errors.lat}</span>}
          <label className="form-field form-field--check" htmlFor="p-approx">
            <span>
              <input id="p-approx" type="checkbox" checked={form.location_approximate} onChange={handleChange("location_approximate")} />{" "}
              {t("propertyForm.locationApproximate")}
            </span>
            <span className="form-hint">{t("propertyForm.locationApproximateHint")}</span>
          </label>
        </div>

        <div className="admin-form__step" id="p-step-2" role="group" aria-labelledby="p-step-title-2" hidden={step !== 2}>
          <h2 className="admin-form__step-title" id="p-step-title-2">{t("propertyForm.steps.specs")}</h2>
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
              <label htmlFor="p-parking">{t("propertyForm.parking")}</label>
              <input id="p-parking" type="number" min="0" value={form.parking} onChange={handleChange("parking")} />
            </div>
          </div>

          <p className="form-hint mt-n2">{t("admin.propertySpecsHint")}</p>

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
              <p className="form-hint mt-n2">{t("admin.industrialSpecsHint")}</p>

              <div className="form-field">
                <label htmlFor="p-tipo-nave">{t("properties.naveTipo")}</label>
                <select id="p-tipo-nave" value={form.tipo_nave} onChange={handleChange("tipo_nave")}>
                  <option value="">—</option>
                  <option value="A">{t("naveTipo.A")}</option>
                  <option value="B">{t("naveTipo.B")}</option>
                </select>
              </div>

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
        </div>

        <div className="admin-form__step" id="p-step-3" role="group" aria-labelledby="p-step-title-3" hidden={step !== 3}>
          <h2 className="admin-form__step-title" id="p-step-title-3">{t("propertyForm.steps.publish")}</h2>
          <div className="form-field">
            <label>
              <input type="checkbox" checked={form.active} onChange={handleChange("active")} className="mr-2" />
              {t("common.active")}
            </label>
          </div>

          <div className="form-field">
            <label>{t("admin.assignAdvisors")}</label>
            <div className="admin-advisor-picker">
              {advisors.map((advisor) => (
                <label key={advisor.id}>
                  <input type="checkbox" checked={form.advisor_ids.includes(advisor.id)} onChange={() => toggleAdvisor(advisor.id)} />
                  {advisor.photo_url && <img src={advisor.photo_url} alt="" />}
                  {advisor.name}
                </label>
              ))}
            </div>
          </div>

          {amenitiesCatalog.length > 0 && (
            <div className="form-field">
              <label>{t("properties.amenities")}</label>
              <div className="access-control__checkbox-grid">
                {amenitiesCatalog.map((amenity) => (
                  <label key={amenity.id} className="access-control__checkbox">
                    <input type="checkbox" checked={form.amenities.includes(amenity.key)} onChange={() => toggleAmenity(amenity.key)} />
                    {amenity.label}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="admin-form__step" id="p-step-4" role="group" aria-labelledby="p-step-title-4" hidden={step !== 4}>
          <h2 className="admin-form__step-title" id="p-step-title-4">{t("propertyForm.steps.media")}</h2>
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

          <div className="form-field">
            <label>{t("admin.videos")}</label>
            <VideoUploader
              existingVideos={existingVideos}
              files={newVideoFiles}
              onAddFiles={(files) => setNewVideoFiles((prev) => [...prev, ...files])}
              onRemoveExisting={(index) => setExistingVideos((prev) => prev.filter((_, i) => i !== index))}
              onRemoveNew={(index) => setNewVideoFiles((prev) => prev.filter((_, i) => i !== index))}
            />
          </div>

          <div className="form-field">
            <label>{t("panorama360.adminLabel")}</label>
            <p className="form-hint">{t("panorama360.adminHint")}</p>
            <Tour360Uploader
              existingImages={existingTour360}
              files={newTour360Files}
              onAddFiles={(files) => setNewTour360Files((prev) => [...prev, ...files])}
              onRemoveExisting={(index) => setExistingTour360((prev) => prev.filter((_, i) => i !== index))}
              onRemoveNew={(index) => setNewTour360Files((prev) => prev.filter((_, i) => i !== index))}
            />
          </div>

          <div className="form-field">
            <label>{t("floorPlan.adminLabel")}</label>
            <p className="form-hint">{t("floorPlan.adminHint")}</p>
            <FloorPlanField
              existingUrl={floorPlanUrl}
              file={floorPlanFile}
              removed={floorPlanRemoved}
              onPick={(file) => {
                setFloorPlanFile(file);
                setFloorPlanRemoved(false);
              }}
              onRemove={() => {
                setFloorPlanFile(null);
                setFloorPlanRemoved(true);
              }}
            />
          </div>
        </div>

        <div className="admin-form__actions">
          <button type="button" className="btn btn-outline" onClick={() => setStep((s) => clampStep(s - 1))} disabled={step === 0}>
            {t("propertyForm.prev")}
          </button>
          <button type="button" className="btn btn-outline" onClick={() => setStep((s) => clampStep(s + 1))} disabled={step === STEPS.length - 1}>
            {t("propertyForm.next")}
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <span className="spinner" /> : null}
            {t("common.save")}
          </button>
          <button type="button" className="btn btn-outline" onClick={() => navigate(listPath)}>
            {t("common.cancel")}
          </button>
        </div>
      </form>

      {isEdit && <InternalNotes entityType="property" entityId={id} />}
    </div>
  );
}
