import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { exportToCsv } from "../../lib/csvExport";
import { useAuth } from "../../context/AuthContext";
import { OPEN_STAGES, PROSPECT_STAGES, followUpState, unattendedState, visitToProspectFields } from "../../lib/prospects";
import { convertProspectToClient } from "../../lib/prospectActions";
import { matchingProperties } from "../../lib/prospectMatch";
import { useProspectContact } from "../../lib/useProspectContact";
import ProspectCard from "../../components/ProspectCard";
import "./admin.css";
import "./AdminProspects.css";

// Embudo de prospectos por etapas. RLS recorta del lado de Supabase: un asesor
// con login vinculado ve solo los suyos; un correo sin asesor vinculado ve todos
// y puede filtrar por asesor. En pantalla ancha cada etapa es una columna; en el
// teléfono se ve una etapa a la vez, con pestañas arriba (cada una con su
// contador). Cambiar de etapa es un selector en la tarjeta (sin arrastrar:
// funciona igual con el dedo en el celular).

const normalize = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// La etapa con la que se abre el teléfono: la primera abierta que tiene prospectos.
const firstStageWithProspects = (prospects) => OPEN_STAGES.find((stage) => prospects.some((p) => p.stage === stage)) || PROSPECT_STAGES[0];

export default function AdminProspects() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { advisorId, hasSection } = useAuth();
  const seesAll = advisorId == null;
  const canImport = hasSection("visitas");

  const [prospects, setProspects] = useState([]);
  const [advisors, setAdvisors] = useState([]);
  const [properties, setProperties] = useState([]);
  const [visits, setVisits] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [importing, setImporting] = useState(false);
  const [query, setQuery] = useState("");
  const [advisorFilter, setAdvisorFilter] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [unattendedOnly, setUnattendedOnly] = useState(false);
  // Etapa visible en el teléfono (en pantalla ancha se ven todas).
  const [activeStage, setActiveStage] = useState(PROSPECT_STAGES[0]);

  // El formulario "Registrar contacto" de una tarjeta: al guardar el contacto
  // el prospecto se actualiza aquí (último contacto, etapa y seguimiento).
  const contact = useProspectContact({
    onUpdated: (updated) => setProspects((prev) => prev.map((p) => (p.id === updated.id ? updated : p))),
  });

  const load = () => {
    setLoading(true);
    Promise.all([
      db.getProspects(),
      db.getAdvisors(),
      db.getProperties({}),
      canImport ? db.getVisits().catch(() => []) : Promise.resolve([]),
      db.getProspectStageHistory().catch(() => []),
    ])
      .then(([prospectData, advisorData, propertyData, visitData, historyData]) => {
        setHistory(historyData);
        setProspects(prospectData);
        setAdvisors(advisorData);
        setProperties(propertyData);
        setVisits(visitData);
        setActiveStage(firstStageWithProspects(prospectData));
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

  // Propiedades disponibles que encajan con lo que busca cada prospecto abierto.
  const matchesByProspect = useMemo(() => new Map(prospects.map((p) => [p.id, matchingProperties(p, properties)])), [prospects, properties]);

  const filtered = useMemo(() => {
    const q = normalize(query);
    return prospects.filter((p) => {
      if (advisorFilter && p.advisor_id !== advisorFilter) return false;
      if (overdueOnly && followUpState(p) !== "overdue") return false;
      if (unattendedOnly && !unattendedState(p)) return false;
      if (!q) return true;
      return [p.name, p.phone, p.email, p.looking_for, propertyTitle(p.property_id)].some((v) => normalize(v).includes(q));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prospects, query, advisorFilter, overdueOnly, unattendedOnly, properties]);

  const handleExport = () => {
    exportToCsv("prospectos.csv", filtered, [
      { label: t("prospects.form.name"), key: "name" },
      { label: t("prospects.form.phone"), key: "phone" },
      { label: t("clients.email"), key: "email" },
      { label: t("prospects.form.stage"), value: (p) => t(`prospects.stages.${p.stage}`) },
      { label: t("prospects.form.advisor"), value: (p) => advisorName(p.advisor_id) },
      { label: t("prospects.form.property"), value: (p) => propertyTitle(p.property_id) },
      { label: t("prospects.form.lookingFor"), key: "looking_for" },
      { label: t("messages.date"), value: (p) => (p.created_at ? new Date(p.created_at).toLocaleDateString("es-MX") : "") },
    ]);
  };

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

  // Posventa: marca el paso (30 días / 6 meses) como atendido.
  const markPostsaleDone = (prospect, step) => patch(prospect, { [step.column]: new Date().toISOString() });

  // En el teléfono la tarjeta se va a la pestaña de su nueva etapa: se sigue viendo.
  const changeStage = (prospect, stage) => {
    setActiveStage(stage);
    return patch(prospect, { stage, ...(stage === "perdido" ? {} : { lost_reason: null }) });
  };

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

  // Convierte al prospecto en cliente (comprador por omisión; el tipo se puede
  // cambiar en la ficha, a la que se llega enseguida para completar el resto de
  // los datos). Si ya hay un cliente con el mismo teléfono o correo se ofrece
  // vincularlo en vez de duplicarlo.
  const handleConvert = async (prospect) => {
    setBusyId(prospect.id);
    try {
      const clientId = await convertProspectToClient(db, prospect, (existing) => window.confirm(t("prospects.convertExisting", { name: existing.name })));
      if (clientId) navigate(`/admin/clientes/${clientId}`);
    } catch (err) {
      window.alert(err.message || t("prospects.convertError"));
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

  return (
    <div>
      <div className="admin-header">
        <div>
          <h1>{t("prospects.title")}</h1>
          <p className="form-hint">{t("prospects.subtitle")}</p>
        </div>
        <div className="admin-header__actions">
          <Link to="/admin/prospectos/nuevo" className="btn btn-primary">
            {t("prospects.new")}
          </Link>
          {canImport && importable.length > 0 && (
            <button type="button" className="btn btn-outline" onClick={handleImport} disabled={importing}>
              {importing ? <span className="spinner" /> : null}
              {t("prospects.import", { count: importable.length })}
            </button>
          )}
          <button type="button" className="btn btn-outline" onClick={handleExport} disabled={filtered.length === 0}>
            {t("common.exportCsv")}
          </button>
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
        <label className="prospect-filters__check">
          <input type="checkbox" checked={unattendedOnly} onChange={(e) => setUnattendedOnly(e.target.checked)} />
          {t("prospects.unattendedOnly")}
        </label>
      </div>

      {loadError && <p className="form-error">{loadError}</p>}
      {loading ? (
        <p className="form-hint">…</p>
      ) : (
        <>
          {/* Solo en el teléfono: una etapa a la vez en vez de seis columnas apiladas. */}
          <div className="prospect-tabs" role="group" aria-label={t("prospects.tabs.label")}>
            {PROSPECT_STAGES.map((stage) => (
              <button
                key={stage}
                type="button"
                className={`prospect-tabs__tab prospect-tabs__tab--${stage}${stage === activeStage ? " is-active" : ""}`}
                aria-pressed={stage === activeStage}
                onClick={() => setActiveStage(stage)}
              >
                {t(`prospects.stages.${stage}`)}
                <span className="prospect-tabs__count">{filtered.filter((p) => p.stage === stage).length}</span>
              </button>
            ))}
          </div>

          <div className="prospect-board">
            {PROSPECT_STAGES.map((stage) => {
              const items = filtered.filter((p) => p.stage === stage);
              return (
                <section
                  key={stage}
                  className={`prospect-col prospect-col--${stage}${stage === activeStage ? " is-active" : ""}`}
                  aria-label={t(`prospects.stages.${stage}`)}
                >
                  <h2 className="prospect-col__title">
                    {t(`prospects.stages.${stage}`)}
                    <span className="prospect-col__count">{items.length}</span>
                  </h2>
                  {items.length === 0 && <p className="form-hint prospect-col__empty">{t("prospects.emptyColumn")}</p>}
                  {items.map((p) => (
                    <ProspectCard
                      key={p.id}
                      prospect={p}
                      seesAll={seesAll}
                      advisorName={advisorName(p.advisor_id)}
                      propertyTitle={propertyTitle(p.property_id)}
                      matches={matchesByProspect.get(p.id) || []}
                      history={history}
                      busy={busyId === p.id}
                      canClients={hasSection("clientes")}
                      canAgenda={hasSection("agenda")}
                      contact={contact}
                      onStage={changeStage}
                      onConvert={handleConvert}
                      onDelete={handleDelete}
                      onPostsaleDone={markPostsaleDone}
                    />
                  ))}
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
