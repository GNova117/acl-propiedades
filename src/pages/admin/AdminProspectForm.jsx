import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { useAuth } from "../../context/AuthContext";
import { propertyTypeLabel } from "../../lib/format";
import { criteriaSummary } from "../../lib/prospectMatch";
import { groupZonesByCity, zoneDisplayName } from "../../lib/zones";
import {
  PROSPECT_SOURCES,
  PROSPECT_STAGES,
  emptyProspectForm,
  prospectToForm,
  toProspectFields,
  validateProspectForm,
} from "../../lib/prospects";
import InternalNotes from "../../components/InternalNotes";
import ProspectContactHistory from "../../components/ProspectContactHistory";
import "./admin.css";
import "./AdminProspects.css";

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
  const [zones, setZones] = useState([]);
  const [propertyTypes, setPropertyTypes] = useState([]);
  // ¿Ya tenía "qué busca" guardado? Solo entonces se manda null al vaciarlo.
  const hadCriteria = useRef(false);
  const [form, setForm] = useState(() => emptyProspectForm({ advisor_id: advisorId || "" }));
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      db.getProperties({}),
      db.getAdvisors(),
      isEdit ? db.getProspectById(id) : Promise.resolve(null),
      db.getZones().catch(() => []),
      db.getPropertyTypes().catch(() => []),
    ])
      .then(([propertyData, advisorData, prospect, zoneData, typeData]) => {
        if (cancelled) return;
        setProperties(propertyData);
        setAdvisors(advisorData);
        setZones(zoneData);
        setPropertyTypes(typeData);
        if (isEdit) {
          if (prospect) {
            hadCriteria.current = Object.keys(prospect.search_criteria || {}).length > 0;
            setForm(prospectToForm(prospect));
          } else setNotFound(true);
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
  const zoneGroups = useMemo(() => groupZonesByCity(zones), [zones]);
  // La zona guardada puede ya no estar en la lista (renombrada o borrada): se
  // conserva como opción para no perderla en silencio al guardar.
  const orphanZone = form.want_zone && !zones.some((z) => z.name === form.want_zone) ? form.want_zone : null;
  const extraSummary = criteriaSummary(form.want_extra, t);

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
      const fields = toProspectFields({ ...form, advisor_id: advisorId || form.advisor_id }, { hadCriteria: hadCriteria.current });
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

        <fieldset className="prospect-search">
          <legend>{t("prospects.form.searchTitle")}</legend>
          <p className="form-hint">{t("prospects.form.searchHint")}</p>
          <div className="form-row">
            <div className="form-field">
              <label htmlFor="pr-want-type">{t("properties.type")}</label>
              <select id="pr-want-type" value={form.want_type} onChange={setField("want_type")}>
                <option value="">{t("prospects.form.any")}</option>
                {propertyTypes.map((pt) => (
                  <option key={pt.key} value={pt.key}>
                    {propertyTypeLabel(t, pt.key)}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="pr-want-operation">{t("properties.operationType")}</label>
              <select id="pr-want-operation" value={form.want_operation} onChange={setField("want_operation")}>
                <option value="">{t("prospects.form.any")}</option>
                <option value="compra">{t("propertyOperation.compra")}</option>
                <option value="renta">{t("propertyOperation.renta")}</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-field">
              <label htmlFor="pr-want-zone">{t("properties.zone")}</label>
              <select id="pr-want-zone" value={form.want_zone} onChange={setField("want_zone")}>
                <option value="">{t("prospects.form.any")}</option>
                {orphanZone && <option value={orphanZone}>{orphanZone}</option>}
                {zoneGroups.map(({ city, zones: groupZones }) => (
                  <optgroup key={city ?? "other"} label={city ?? t("zones.otherZones")}>
                    {groupZones.map((zone) => (
                      <option key={zone.id} value={zone.name}>
                        {zoneDisplayName(zone)}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="pr-want-bedrooms">{t("properties.minBedrooms")}</label>
              <input id="pr-want-bedrooms" type="number" min="0" inputMode="numeric" value={form.want_min_bedrooms} onChange={setField("want_min_bedrooms")} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-field">
              <label htmlFor="pr-want-min-price">{t("properties.minPrice")}</label>
              <input id="pr-want-min-price" type="number" min="0" inputMode="numeric" value={form.want_min_price} onChange={setField("want_min_price")} />
            </div>
            <div className="form-field">
              <label htmlFor="pr-want-max-price">{t("properties.maxPrice")}</label>
              <input id="pr-want-max-price" type="number" min="0" inputMode="numeric" value={form.want_max_price} onChange={setField("want_max_price")} />
              {errorText("want_max_price")}
            </div>
          </div>
          {extraSummary && <p className="form-hint">{t("prospects.form.searchExtra", { text: extraSummary })}</p>}
        </fieldset>

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

      {isEdit && <ProspectContactHistory prospectId={id} />}

      {isEdit && <InternalNotes entityType="prospect" entityId={id} />}
    </div>
  );
}
