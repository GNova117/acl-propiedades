import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { useAuth } from "../../context/AuthContext";
import SignatureModal from "../../components/SignatureModal";
import InspectionChecklist from "../../components/InspectionChecklist";
import { buildInspectionLabels, downloadInspectionPdf } from "../../lib/inspectionPdf";
import {
  computeDiagnosis,
  emptyInspectionForm,
  failedItems,
  inspectionToForm,
  toInspectionFields,
  validateInspectionForm,
} from "../../lib/propertyInspection";
import "./admin.css";
import "./AdminInspections.css";

const STATUS_KEY = { verde: "green", amarillo: "yellow", rojo: "red" };

export default function AdminInspectionForm() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { advisorId, session } = useAuth();
  const isEdit = Boolean(id);
  const presetProperty = searchParams.get("propiedad") || "";
  const recordId = useRef(crypto.randomUUID());

  const [properties, setProperties] = useState([]);
  const [form, setForm] = useState(() => emptyInspectionForm({ property_id: presetProperty }));
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [showSignature, setShowSignature] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([db.getProperties({}), db.getAdvisors(), isEdit ? db.getInspectionById(id) : Promise.resolve(null)])
      .then(([propertyData, advisorData, inspection]) => {
        if (cancelled) return;
        setProperties(propertyData);
        if (isEdit) {
          if (inspection) setForm(inspectionToForm(inspection));
          else setNotFound(true);
        } else {
          const fixedAdvisor = advisorId ? advisorData.find((a) => a.id === advisorId) : null;
          const preset = propertyData.find((p) => p.id === presetProperty);
          setForm((prev) => ({
            ...prev,
            inspector: fixedAdvisor?.name || session?.user?.email || "",
            direccion: preset?.address || prev.direccion,
          }));
        }
      })
      .catch((err) => !cancelled && setSaveError(err.message || t("inspections.form.saveError")))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const sortedProperties = useMemo(
    () => properties.slice().sort((a, b) => `${a.code || ""} ${a.title}`.localeCompare(`${b.code || ""} ${b.title}`, "es")),
    [properties]
  );

  const diagnosis = useMemo(() => computeDiagnosis(form.checklist), [form.checklist]);
  const failed = useMemo(() => failedItems(form.checklist), [form.checklist]);
  const hasSignature = Boolean(form.signature || form.existingSignature);
  const backTo = location.state?.from || "/admin/inspecciones";

  const setField = (field) => (e) => {
    const value = e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handlePropertyChange = (e) => {
    const property_id = e.target.value;
    const property = properties.find((p) => p.id === property_id);
    setForm((prev) => ({ ...prev, property_id, direccion: prev.direccion || property?.address || prev.direccion }));
  };

  const handleChecklistChange = (checklist) => {
    setForm((prev) => ({ ...prev, checklist }));
    setErrors((prev) => ({ ...prev, checklist: undefined }));
  };

  const save = async () => {
    const found = validateInspectionForm(form);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return null;
    }
    setSaving(true);
    setSaveError("");
    try {
      const fields = toInspectionFields(form);
      const saved = isEdit ? await db.updateInspection(id, fields) : await db.addInspection({ id: recordId.current, ...fields });
      return saved;
    } catch (err) {
      setSaveError(err.message || t("inspections.form.saveError"));
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const saved = await save();
    if (saved) navigate(backTo, { replace: true });
  };

  const handleSaveAndPdf = async (e) => {
    e.preventDefault();
    const saved = await save();
    if (!saved) return;
    try {
      const fresh = await db.getInspectionById(saved.id);
      await downloadInspectionPdf(fresh, buildInspectionLabels(t, i18n, fresh));
    } catch (err) {
      window.alert(err.message || t("inspections.form.pdfError"));
    }
    navigate(backTo, { replace: true });
  };

  if (loading) return <div className="empty-state">{t("common.loading")}</div>;
  if (notFound) {
    return (
      <div className="empty-state">
        <p>{t("inspections.form.notFound")}</p>
        <Link to="/admin/inspecciones" className="btn btn-outline">
          {t("inspections.backToList")}
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="admin-header">
        <h1>{isEdit ? t("inspections.form.editTitle") : t("inspections.form.newTitle")}</h1>
      </div>

      <form className="card admin-form inspection-form" onSubmit={handleSave} noValidate>
        <div className="form-row">
          <div className="form-field">
            <label htmlFor="insp-folio">{t("inspections.form.folio")}</label>
            <input id="insp-folio" value={form.folio} onChange={setField("folio")} />
            {errors.folio && <span className="form-error">{t("contact.required")}</span>}
          </div>
          <div className="form-field">
            <label htmlFor="insp-when">{t("inspections.form.when")}</label>
            <input id="insp-when" type="datetime-local" value={form.visited_at} onChange={setField("visited_at")} />
            {errors.visited_at && <span className="form-error">{t("contact.required")}</span>}
          </div>
        </div>

        <div className="form-field">
          <label htmlFor="insp-property">
            {t("inspections.form.property")} ({t("visits.form.optional")})
          </label>
          <select id="insp-property" value={form.property_id} onChange={handlePropertyChange}>
            <option value="">{t("inspections.form.noProperty")}</option>
            {sortedProperties.map((p) => (
              <option key={p.id} value={p.id}>
                {[p.code, p.title].filter(Boolean).join(" · ")}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="insp-address">{t("inspections.form.address")}</label>
          <input id="insp-address" value={form.direccion} onChange={setField("direccion")} />
          {errors.direccion && <span className="form-error">{t("contact.required")}</span>}
        </div>

        <div className="form-field">
          <label htmlFor="insp-inspector">{t("inspections.form.inspector")}</label>
          <input id="insp-inspector" value={form.inspector} onChange={setField("inspector")} />
          {errors.inspector && <span className="form-error">{t("contact.required")}</span>}
        </div>

        <h2 className="inspection-form__section">{t("inspections.form.checklistTitle")}</h2>
        <InspectionChecklist checklist={form.checklist} onChange={handleChecklistChange} showIncomplete={Boolean(errors.checklist)} />
        {errors.checklist && <span className="form-error">{t("inspections.form.checklistIncomplete")}</span>}

        <div className={`inspection-status inspection-status--${STATUS_KEY[diagnosis]}`}>
          <strong>{t(`inspections.status.${STATUS_KEY[diagnosis]}`)}</strong>
          <span>{t(`inspections.status.${STATUS_KEY[diagnosis]}Note`)}</span>
        </div>

        {failed.length > 0 && (
          <div className="inspection-corrections">
            <h3>{t("inspections.form.correctionsTitle")}</h3>
            <ul>
              {failed.map((entry) => (
                <li key={`${entry.category}.${entry.key}`}>{t(`inspections.checklist.${entry.category}.${entry.key}`)}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="form-field">
          <label htmlFor="insp-obs">
            {t("inspections.form.observations")} ({t("visits.form.optional")})
          </label>
          <textarea id="insp-obs" rows={3} value={form.observaciones} onChange={setField("observaciones")} />
        </div>

        <div className="form-field">
          <span style={{ fontWeight: 600 }}>{t("inspections.form.signature")}</span>
          {hasSignature ? (
            <img
              className="inspection-form__signature"
              src={form.signature?.image || form.existingSignature}
              alt={t("inspections.form.signature")}
            />
          ) : (
            <span className="form-hint">{t("inspections.form.noSignatureYet")}</span>
          )}
          <button type="button" className="btn btn-outline btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => setShowSignature(true)}>
            {hasSignature ? t("inspections.form.signAgain") : t("inspections.form.signAction")}
          </button>
        </div>

        {saveError && <span className="form-error">{saveError}</span>}

        <div className="admin-form__actions">
          <Link to={backTo} className="btn btn-outline">
            {t("common.cancel")}
          </Link>
          <button type="submit" className="btn btn-outline" disabled={saving}>
            {saving ? <span className="spinner" /> : null}
            {t("common.save")}
          </button>
          <button type="button" className="btn btn-primary" disabled={saving} onClick={handleSaveAndPdf}>
            {saving ? <span className="spinner" /> : null}
            {t("inspections.form.saveAndPdf")}
          </button>
        </div>
      </form>

      {showSignature && (
        <SignatureModal
          title={t("inspections.form.signature")}
          onCancel={() => setShowSignature(false)}
          onAccept={(sig) => {
            setForm((prev) => ({ ...prev, signature: sig, signedBy: prev.inspector }));
            setShowSignature(false);
          }}
        />
      )}
    </div>
  );
}
