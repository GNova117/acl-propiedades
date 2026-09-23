import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { useAuth } from "../../context/AuthContext";
import {
  REJECTION_REASONS,
  VISIT_INTERESTS,
  emptyVisitForm,
  reasonLabel,
  toLocalInputValue,
  toVisitFields,
  validateVisitForm,
  visitToForm,
} from "../../lib/visitReport";
import "./admin.css";
import "./AdminVisits.css";

// Registrar o corregir una visita. Se abre desde /admin/visitas (con "Registrar
// visita") o desde el informe de una propiedad (?propiedad=<id>, que deja la
// propiedad ya elegida). El asesor con un login vinculado a su perfil siempre
// registra a su nombre; el correo de oficina (sin asesor vinculado) elige quién
// hizo el recorrido.
export default function AdminVisitForm() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { advisorId } = useAuth();
  const isEdit = Boolean(id);
  const presetProperty = searchParams.get("propiedad") || "";

  const [properties, setProperties] = useState([]);
  const [advisors, setAdvisors] = useState([]);
  const [form, setForm] = useState(() => emptyVisitForm({ property_id: presetProperty, advisor_id: advisorId || "" }));
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([db.getProperties({}), db.getAdvisors(), isEdit ? db.getVisitById(id) : Promise.resolve(null)])
      .then(([propertyData, advisorData, visit]) => {
        if (cancelled) return;
        setProperties(propertyData);
        setAdvisors(advisorData);
        if (isEdit) {
          if (visit) setForm(visitToForm(visit));
          else setNotFound(true);
        }
      })
      .catch((err) => !cancelled && setSaveError(err.message || t("visits.form.saveError")))
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
  const selectableAdvisors = useMemo(() => advisors.filter((a) => a.active !== false || a.id === form.advisor_id), [advisors, form.advisor_id]);
  const fixedAdvisor = advisorId ? advisors.find((a) => a.id === advisorId) : null;

  // A dónde volver: de donde se llegó, o al informe de la propiedad si venía de ahí.
  const backTo = location.state?.from || (presetProperty ? `/admin/visitas/propiedad/${presetProperty}` : "/admin/visitas");

  const setField = (field) => (e) => {
    const value = e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const toggleReason = (key) => {
    setForm((prev) => ({ ...prev, reasons: prev.reasons.includes(key) ? prev.reasons.filter((k) => k !== key) : [...prev.reasons, key] }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const found = validateVisitForm(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    setSaveError("");
    try {
      const fields = toVisitFields(form);
      if (isEdit) await db.updateVisit(id, fields);
      else await db.addVisit(fields);
      // Si se llegó desde el informe de una propiedad se regresa al de la propiedad
      // que quedó guardada (pudo cambiarse en el formulario).
      navigate(location.state?.from || (presetProperty ? `/admin/visitas/propiedad/${form.property_id}` : "/admin/visitas"), { replace: true });
    } catch (err) {
      setSaveError(err.message || t("visits.form.saveError"));
      setSaving(false);
    }
  };

  const errorText = (field) => {
    if (!errors[field]) return null;
    return <span className="form-error">{errors[field] === "future" ? t("visits.form.futureDate") : t("contact.required")}</span>;
  };

  if (loading) return <div className="empty-state">{t("common.loading")}</div>;
  if (notFound) {
    return (
      <div className="empty-state">
        <p>{t("visits.form.notFound")}</p>
        <Link to="/admin/visitas" className="btn btn-outline">
          {t("visits.backToList")}
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="admin-header">
        <h1>{isEdit ? t("visits.form.editTitle") : t("visits.form.newTitle")}</h1>
      </div>

      <form className="card admin-form visit-form" onSubmit={handleSubmit} noValidate>
        <div className="form-field">
          <label htmlFor="visit-property">{t("visits.form.property")}</label>
          <select id="visit-property" value={form.property_id} onChange={setField("property_id")}>
            <option value="">{t("visits.form.chooseProperty")}</option>
            {sortedProperties.map((p) => (
              <option key={p.id} value={p.id}>
                {[p.code, p.title].filter(Boolean).join(" · ")}
              </option>
            ))}
          </select>
          {errorText("property_id")}
        </div>

        <div className="form-row">
          <div className="form-field">
            <label htmlFor="visit-when">{t("visits.form.when")}</label>
            <input id="visit-when" type="datetime-local" max={toLocalInputValue()} value={form.visited_at} onChange={setField("visited_at")} />
            {errorText("visited_at")}
          </div>

          <div className="form-field">
            {advisorId ? (
              <>
                <label>{t("visits.form.advisor")}</label>
                <p className="visit-form__advisor-fixed">{fixedAdvisor?.name || "—"}</p>
              </>
            ) : (
              <>
                <label htmlFor="visit-advisor">{t("visits.form.advisor")}</label>
                <select id="visit-advisor" value={form.advisor_id} onChange={setField("advisor_id")}>
                  <option value="">{t("visits.form.chooseAdvisor")}</option>
                  {selectableAdvisors.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
                {errorText("advisor_id")}
              </>
            )}
          </div>
        </div>

        <div className="form-field">
          <label htmlFor="visit-prospect">
            {t("visits.form.prospect")} ({t("visits.form.optional")})
          </label>
          <input id="visit-prospect" type="text" autoComplete="off" value={form.prospect_name} onChange={setField("prospect_name")} />
          <span className="form-hint">{t("visits.form.prospectHint")}</span>
        </div>

        <fieldset className="form-field">
          <legend>{t("visits.form.interest")}</legend>
          <div className="visit-pills" role="radiogroup" aria-label={t("visits.form.interest")}>
            {VISIT_INTERESTS.map((key) => (
              <label key={key} className="visit-pill">
                <input type="radio" name="interest" value={key} checked={form.interest === key} onChange={setField("interest")} />
                {t(`visits.interest.${key}`)}
              </label>
            ))}
          </div>
          {errorText("interest")}
        </fieldset>

        <fieldset className="form-field">
          <legend>
            {t("visits.form.reasons")} ({t("visits.form.optional")})
          </legend>
          <div className="visit-pills">
            {REJECTION_REASONS.map((key) => (
              <label key={key} className="visit-pill">
                <input type="checkbox" checked={form.reasons.includes(key)} onChange={() => toggleReason(key)} />
                {reasonLabel(t, key)}
              </label>
            ))}
          </div>
          <span className="form-hint">{t("visits.form.reasonsHint")}</span>
        </fieldset>

        <div className="form-field">
          <label htmlFor="visit-comments">
            {t("visits.form.comments")} ({t("visits.form.optional")})
          </label>
          <textarea id="visit-comments" rows={3} value={form.comments} onChange={setField("comments")} />
          <span className="form-hint">{t("visits.form.commentsHint")}</span>
        </div>

        <div className="form-field">
          <label htmlFor="visit-notes">
            {t("visits.form.internalNotes")} ({t("visits.form.optional")})
          </label>
          <textarea id="visit-notes" rows={2} value={form.internal_notes} onChange={setField("internal_notes")} />
          <span className="form-hint">{t("visits.form.internalNotesHint")}</span>
        </div>

        {saveError && <span className="form-error">{saveError}</span>}

        <div className="admin-form__actions">
          <Link to={backTo} className="btn btn-outline">
            {t("common.cancel")}
          </Link>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <span className="spinner" /> : null}
            {t("common.save")}
          </button>
        </div>
      </form>
    </div>
  );
}
