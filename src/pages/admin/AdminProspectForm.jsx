import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { useAuth } from "../../context/AuthContext";
import {
  PROSPECT_SOURCES,
  PROSPECT_STAGES,
  emptyProspectForm,
  prospectToForm,
  toProspectFields,
  validateProspectForm,
} from "../../lib/prospects";
import "./admin.css";

// Alta y edición de un prospecto. El asesor con login vinculado siempre queda
// como responsable; el correo de oficina (sin asesor vinculado) elige quién lo lleva.
export default function AdminProspectForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { advisorId } = useAuth();
  const isEdit = Boolean(id);

  const [properties, setProperties] = useState([]);
  const [advisors, setAdvisors] = useState([]);
  const [form, setForm] = useState(() => emptyProspectForm({ advisor_id: advisorId || "" }));
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([db.getProperties({}), db.getAdvisors(), isEdit ? db.getProspectById(id) : Promise.resolve(null)])
      .then(([propertyData, advisorData, prospect]) => {
        if (cancelled) return;
        setProperties(propertyData);
        setAdvisors(advisorData);
        if (isEdit) {
          if (prospect) setForm(prospectToForm(prospect));
          else setNotFound(true);
        }
      })
      .catch((err) => !cancelled && setSaveError(err.message || t("prospects.saveError")))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const sortedProperties = useMemo(() => properties.slice().sort((a, b) => String(a.title).localeCompare(String(b.title))), [properties]);
  const selectableAdvisors = useMemo(() => advisors.filter((a) => a.active !== false), [advisors]);
  const fixedAdvisor = advisors.find((a) => a.id === advisorId);

  const setField = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));
  const errorText = (key) => (errors[key] ? <span className="form-error">{t(errors[key])}</span> : null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const found = validateProspectForm(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    setSaveError("");
    try {
      const fields = toProspectFields({ ...form, advisor_id: advisorId || form.advisor_id });
      if (isEdit) await db.updateProspect(id, fields);
      else await db.addProspect({ ...fields, last_contact_at: null });
      navigate("/admin/prospectos");
    } catch (err) {
      setSaveError(err.message || t("prospects.saveError"));
      setSaving(false);
    }
  };

  if (loading) return <p className="form-hint">…</p>;
  if (notFound) {
    return (
      <div>
        <p>{t("prospects.notFound")}</p>
        <Link to="/admin/prospectos" className="btn btn-outline">
          {t("common.close")}
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="admin-header">
        <h1>{isEdit ? t("prospects.form.editTitle") : t("prospects.form.newTitle")}</h1>
      </div>

      <form className="card admin-form" onSubmit={handleSubmit} noValidate>
        <div className="form-field">
          <label htmlFor="pr-name">{t("prospects.form.name")}</label>
          <input id="pr-name" type="text" autoComplete="off" value={form.name} onChange={setField("name")} />
          {errorText("name")}
        </div>

        <div className="form-row">
          <div className="form-field">
            <label htmlFor="pr-phone">{t("prospects.form.phone")}</label>
            <input id="pr-phone" type="tel" value={form.phone} onChange={setField("phone")} />
            {errorText("phone")}
          </div>
          <div className="form-field">
            <label htmlFor="pr-email">{t("prospects.form.email")}</label>
            <input id="pr-email" type="email" value={form.email} onChange={setField("email")} />
            {errorText("email")}
          </div>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label htmlFor="pr-stage">{t("prospects.form.stage")}</label>
            <select id="pr-stage" value={form.stage} onChange={setField("stage")}>
              {PROSPECT_STAGES.map((s) => (
                <option key={s} value={s}>
                  {t(`prospects.stages.${s}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="pr-source">{t("prospects.form.source")}</label>
            <select id="pr-source" value={form.source} onChange={setField("source")}>
              {PROSPECT_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {t(`prospects.sources.${s}`)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-field">
            {advisorId ? (
              <>
                <label>{t("prospects.form.advisor")}</label>
                <p>{fixedAdvisor?.name || "—"}</p>
              </>
            ) : (
              <>
                <label htmlFor="pr-advisor">{t("prospects.form.advisor")}</label>
                <select id="pr-advisor" value={form.advisor_id} onChange={setField("advisor_id")}>
                  <option value="">{t("prospects.form.noAdvisor")}</option>
                  {selectableAdvisors.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
          <div className="form-field">
            <label htmlFor="pr-followup">{t("prospects.form.nextFollowup")}</label>
            <input id="pr-followup" type="date" value={form.next_followup_at} onChange={setField("next_followup_at")} />
          </div>
        </div>

        <div className="form-field">
          <label htmlFor="pr-property">{t("prospects.form.property")}</label>
          <select id="pr-property" value={form.property_id} onChange={setField("property_id")}>
            <option value="">{t("prospects.form.noProperty")}</option>
            {sortedProperties.map((p) => (
              <option key={p.id} value={p.id}>
                {[p.code, p.title].filter(Boolean).join(" · ")}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="pr-looking">{t("prospects.form.lookingFor")}</label>
          <input id="pr-looking" type="text" value={form.looking_for} onChange={setField("looking_for")} placeholder={t("prospects.form.lookingForPlaceholder")} />
        </div>

        {form.stage === "perdido" && (
          <div className="form-field">
            <label htmlFor="pr-lost">{t("prospects.form.lostReason")}</label>
            <input id="pr-lost" type="text" value={form.lost_reason} onChange={setField("lost_reason")} />
          </div>
        )}

        <div className="form-field">
          <label htmlFor="pr-notes">{t("prospects.form.notes")}</label>
          <textarea id="pr-notes" rows={3} value={form.notes} onChange={setField("notes")} />
        </div>

        {saveError && <span className="form-error">{saveError}</span>}

        <div className="admin-form__actions">
          <Link to="/admin/prospectos" className="btn btn-outline">
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
