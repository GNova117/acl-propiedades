import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { useAuth } from "../../context/AuthContext";
import { whatsappDigits } from "../../lib/format";
import { PROSPECT_STAGES, daysSince, followUpState, visitToProspectFields } from "../../lib/prospects";
import "./admin.css";
import "./AdminProspects.css";

// Embudo de prospectos por etapas. RLS recorta del lado de Supabase: un asesor
// con login vinculado ve solo los suyos; un correo sin asesor vinculado ve todos
// y puede filtrar por asesor. Cambiar de etapa es un selector en cada tarjeta
// (sin arrastrar: funciona igual con el dedo en el celular).
const normalize = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function whatsappLink(phone) {
  let digits = whatsappDigits(phone);
  if (digits.length === 10) digits = `52${digits}`;
  return digits ? `https://wa.me/${digits}` : null;
}

export default function AdminProspects() {
  const { t } = useTranslation();
  const { advisorId, hasSection } = useAuth();
  const seesAll = advisorId == null;
  const canImport = hasSection("visitas");

  const [prospects, setProspects] = useState([]);
  const [advisors, setAdvisors] = useState([]);
  const [properties, setProperties] = useState([]);
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [importing, setImporting] = useState(false);
  const [query, setQuery] = useState("");
  const [advisorFilter, setAdvisorFilter] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      db.getProspects(),
      db.getAdvisors(),
      db.getProperties({}),
      canImport ? db.getVisits().catch(() => []) : Promise.resolve([]),
    ])
      .then(([prospectData, advisorData, propertyData, visitData]) => {
        setProspects(prospectData);
        setAdvisors(advisorData);
        setProperties(propertyData);
        setVisits(visitData);
        setLoadError("");
      })
      .catch((err) => setLoadError(err.message || "Error"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const advisorName = (id) => advisors.find((a) => a.id === id)?.name || "";
  const propertyTitle = (id) => properties.find((p) => p.id === id)?.title || "";

  // Visitas marcadas como "posible cliente" que aún no son prospecto.
  const importable = useMemo(() => {
    const imported = new Set(prospects.map((p) => p.visit_id).filter(Boolean));
    return visits.filter((v) => v.potential_client && !imported.has(v.id));
  }, [visits, prospects]);

  const filtered = useMemo(() => {
    const q = normalize(query);
    return prospects.filter((p) => {
      if (advisorFilter && p.advisor_id !== advisorFilter) return false;
      if (overdueOnly && followUpState(p) !== "overdue") return false;
      if (!q) return true;
      return [p.name, p.phone, p.email, p.looking_for, propertyTitle(p.property_id)].some((v) => normalize(v).includes(q));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prospects, query, advisorFilter, overdueOnly, properties]);

  const patch = async (prospect, fields) => {
    setBusyId(prospect.id);
    try {
      const updated = await db.updateProspect(prospect.id, fields);
      setProspects((prev) => prev.map((p) => (p.id === prospect.id ? updated : p)));
    } catch (err) {
      window.alert(err.message || t("prospects.saveError"));
    } finally {
      setBusyId(null);
    }
  };

  const changeStage = (prospect, stage) => patch(prospect, { stage, ...(stage === "perdido" ? {} : { lost_reason: null }) });

  const logContact = (prospect) =>
    patch(prospect, {
      last_contact_at: new Date().toISOString(),
      // Si había un seguimiento pendiente para hoy o vencido, ya se atendió.
      ...(followUpState(prospect) ? { next_followup_at: null } : {}),
      ...(prospect.stage === "nuevo" ? { stage: "contactado" } : {}),
    });

  const handleDelete = async (prospect) => {
    if (!window.confirm(t("prospects.confirmDelete", { name: prospect.name }))) return;
    setBusyId(prospect.id);
    try {
      await db.deleteProspect(prospect.id);
      setProspects((prev) => prev.filter((p) => p.id !== prospect.id));
    } catch (err) {
      window.alert(err.message || t("prospects.deleteError"));
    } finally {
      setBusyId(null);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const created = await db.addProspects(importable.map(visitToProspectFields));
      setProspects((prev) => [...created, ...prev]);
    } catch (err) {
      window.alert(err.message || t("prospects.importError"));
    } finally {
      setImporting(false);
    }
  };

  const contactText = (p) => {
    const days = daysSince(p.last_contact_at);
    if (days == null) return t("prospects.noContact");
    if (days <= 0) return t("prospects.contactToday");
    return t("prospects.contactAgo", { count: days });
  };

  const followChip = (p) => {
    const state = followUpState(p);
    if (state === "overdue") return <span className="prospect-chip prospect-chip--overdue">{t("prospects.followOverdue")}</span>;
    if (state === "today") return <span className="prospect-chip prospect-chip--today">{t("prospects.followToday")}</span>;
    if (p.next_followup_at && p.stage !== "cerrado" && p.stage !== "perdido") {
      return (
        <span className="prospect-chip">
          {t("prospects.followOn", { date: new Date(`${p.next_followup_at}T00:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "short" }) })}
        </span>
      );
    }
    return null;
  };

  return (
    <div>
      <div className="admin-header">
        <div>
          <h1>{t("prospects.title")}</h1>
          <p className="form-hint">{t("prospects.subtitle")}</p>
        </div>
        <div className="admin-header__actions">
          {canImport && importable.length > 0 && (
            <button type="button" className="btn btn-outline" onClick={handleImport} disabled={importing}>
              {importing ? <span className="spinner" /> : null}
              {t("prospects.import", { count: importable.length })}
            </button>
          )}
          <Link to="/admin/prospectos/nuevo" className="btn btn-primary">
            {t("prospects.new")}
          </Link>
        </div>
      </div>

      <div className="prospect-filters">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("prospects.searchPlaceholder")}
          aria-label={t("prospects.searchPlaceholder")}
        />
        {seesAll && (
          <select value={advisorFilter} onChange={(e) => setAdvisorFilter(e.target.value)} aria-label={t("prospects.form.advisor")}>
            <option value="">{t("prospects.allAdvisors")}</option>
            {advisors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        )}
        <label className="prospect-filters__check">
          <input type="checkbox" checked={overdueOnly} onChange={(e) => setOverdueOnly(e.target.checked)} />
          {t("prospects.overdueOnly")}
        </label>
      </div>

      {loadError && <p className="form-error">{loadError}</p>}
      {loading ? (
        <p className="form-hint">…</p>
      ) : (
        <div className="prospect-board">
          {PROSPECT_STAGES.map((stage) => {
            const items = filtered.filter((p) => p.stage === stage);
            return (
              <section key={stage} className={`prospect-col prospect-col--${stage}`} aria-label={t(`prospects.stages.${stage}`)}>
                <h2 className="prospect-col__title">
                  {t(`prospects.stages.${stage}`)}
                  <span className="prospect-col__count">{items.length}</span>
                </h2>
                {items.length === 0 && <p className="form-hint prospect-col__empty">{t("prospects.emptyColumn")}</p>}
                {items.map((p) => {
                  const wa = whatsappLink(p.phone);
                  return (
                    <article key={p.id} className="card prospect-card">
                      <div className="prospect-card__head">
                        <Link to={`/admin/prospectos/${p.id}`} className="prospect-card__name">
                          {p.name}
                        </Link>
                        {p.source && p.source !== "manual" && <span className="prospect-chip">{t(`prospects.sources.${p.source}`)}</span>}
                      </div>
                      {p.phone && (
                        <p className="prospect-card__line">
                          <a href={`tel:${whatsappDigits(p.phone)}`}>{p.phone}</a>
                          {wa && (
                            <>
                              {" · "}
                              <a href={wa} target="_blank" rel="noopener noreferrer">
                                WhatsApp
                              </a>
                            </>
                          )}
                        </p>
                      )}
                      {p.property_id && propertyTitle(p.property_id) && <p className="prospect-card__line">{propertyTitle(p.property_id)}</p>}
                      {p.looking_for && <p className="prospect-card__line form-hint">{p.looking_for}</p>}
                      {stage === "perdido" && p.lost_reason && <p className="prospect-card__line form-hint">{p.lost_reason}</p>}
                      <p className="prospect-card__meta">
                        {contactText(p)}
                        {seesAll && advisorName(p.advisor_id) ? ` · ${advisorName(p.advisor_id)}` : ""}
                      </p>
                      {followChip(p)}
                      <div className="prospect-card__actions">
                        <select
                          value={p.stage}
                          onChange={(e) => changeStage(p, e.target.value)}
                          disabled={busyId === p.id}
                          aria-label={t("prospects.form.stage")}
                        >
                          {PROSPECT_STAGES.map((s) => (
                            <option key={s} value={s}>
                              {t(`prospects.stages.${s}`)}
                            </option>
                          ))}
                        </select>
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => logContact(p)} disabled={busyId === p.id}>
                          {t("prospects.logContact")}
                        </button>
                        <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDelete(p)} disabled={busyId === p.id}>
                          {t("common.delete")}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
