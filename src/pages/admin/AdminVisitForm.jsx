import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { useAuth } from "../../context/AuthContext";
import { closeLoopAfterVisit } from "../../lib/visitProspect";
import { enqueueVisit, isOfflineError, isOnline, newId, withTimeout } from "../../lib/offlineQueue";
import { queries } from "../../lib/queries";
import { useQuery } from "../../lib/useQuery";
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
const NONE = [];

export default function AdminVisitForm() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { advisorId, hasSection, session } = useAuth();
  const email = session?.user?.email || "";
  const isEdit = Boolean(id);
  const presetProperty = searchParams.get("propiedad") || "";
  // Desde una cita de la Agenda ("Realizada" → "Registrar visita", o "Registrar visita" en Mi día) llega
  // el formulario ya prellenado: propiedad, asesor, fecha y hora, y nombre y teléfono de quien visitó.
  const prefill = !isEdit ? location.state?.prefill || null : null;

  // Las listas salen del caché (ver dataCache.js): si ya se pidieron en otra pantalla, el formulario abre
  // al instante; si no, se llenan en cuanto llegan (no hace falta esperarlas para empezar a escribir).
  const properties = useQuery(queries.properties).data ?? NONE;
  const advisors = useQuery(queries.advisors).data ?? NONE;
  const [form, setForm] = useState(() =>
    emptyVisitForm({ property_id: presetProperty, advisor_id: advisorId || "", ...(prefill ? { ...prefill, advisor_id: advisorId || prefill.advisor_id || "" } : {}) })
  );
  const [errors, setErrors] = useState({});
  // Solo al editar hay algo que esperar: la visita guardada.
  const [loading, setLoading] = useState(isEdit);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [savedOffline, setSavedOffline] = useState(null); // { label } cuando se guardó en la cola sin señal

  useEffect(() => {
    if (!isEdit) return undefined;
    let cancelled = false;
    db.getVisitById(id)
      .then((visit) => {
        if (cancelled) return;
        if (visit) setForm(visitToForm(visit));
        else setNotFound(true);
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
      else {
        // Cada visita lleva su id desde el primer intento: si la petición llegó pero se perdió la respuesta, el reenvío de la
        // cola sin señal choca con él y no se duplica.
        const record = { ...fields, id: newId() };
        const can = { agenda: hasSection("agenda"), prospectos: hasSection("prospectos") };
        const queueIt = () => {
          const label = properties.find((p) => p.id === record.property_id)?.title || record.prospect_name || t("visits.form.newTitle");
          if (enqueueVisit(email, { fields: record, label, citaId: form.cita_id || null, can })) setSavedOffline({ label });
          else setSaveError(t("offline.saveFailed"));
          setSaving(false);
        };
        if (!isOnline()) {
          queueIt();
          return;
        }
        let saved;
        try {
          saved = await withTimeout(db.addVisit(record));
        } catch (err) {
          if (!isOfflineError(err)) throw err;
          queueIt();
          return;
        }
        // Si salió de una cita: se marca como realizada y se actualiza al prospecto ligado (mejor esfuerzo).
        if (form.cita_id) await closeLoopAfterVisit(db, saved, form.cita_id, can);
      }
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

  // Sin señal la visita/cita quedó en la cola de este dispositivo (lib/offlineQueue.js): se avisa en vez de navegar a algo que todavía no existe.
  if (savedOffline) {
    return (
      <div>
        <div className="card offline-saved" role="status">
          <h2>{t("offline.saved.title")}</h2>
          <p>{t("offline.saved.visit", { name: savedOffline.label })}</p>
          <button type="button" className="btn btn-primary" onClick={() => navigate(backTo, { replace: true })}>
            {t("offline.saved.back")}
          </button>
        </div>
      </div>
    );
  }
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
        {form.cita_id && !isEdit && <p className="form-hint visit-form__from-cita">{t("visits.form.fromCita")}</p>}
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
          <legend>{t("visits.form.followUp")}</legend>
          <div className="visit-pills">
            <label className="visit-pill">
              <input
                type="checkbox"
                checked={form.potential_client}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setForm((prev) => ({ ...prev, potential_client: checked }));
                  setErrors((prev) => ({ ...prev, prospect_phone: undefined }));
                }}
              />
              {t("visits.form.potentialClient")}
            </label>
          </div>
          <span className="form-hint">{t("visits.form.potentialClientHint")}</span>
        </fieldset>

        {form.potential_client && (
          <>
            <div className="form-field">
              <label htmlFor="visit-phone">
                {t("visits.form.prospectPhone")} ({t("visits.form.optional")})
              </label>
              <input id="visit-phone" type="tel" inputMode="tel" autoComplete="off" value={form.prospect_phone} onChange={setField("prospect_phone")} />
              {errors.prospect_phone && <span className="form-error">{t("visits.form.phoneInvalid")}</span>}
            </div>

            <div className="form-field">
              <label htmlFor="visit-looking">
                {t("visits.form.lookingFor")} ({t("visits.form.optional")})
              </label>
              <textarea id="visit-looking" rows={2} placeholder={t("visits.form.lookingForPlaceholder")} value={form.looking_for} onChange={setField("looking_for")} />
              <span className="form-hint">{t("visits.form.followUpHint")}</span>
            </div>
          </>
        )}

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
