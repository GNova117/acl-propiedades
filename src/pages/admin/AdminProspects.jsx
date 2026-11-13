import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { exportToCsv } from "../../lib/csvExport";
import { useAuth } from "../../context/AuthContext";
import { FOLLOWUP_OPTIONS, PROSPECT_STAGES, firstStageWithProspects, followUpState, isForgotten, unattendedState, visitToProspectFields } from "../../lib/prospects";
import { applyBulk, followupDate } from "../../lib/prospectBulk";
import { convertProspectToClient } from "../../lib/prospectActions";
import { matchingProperties } from "../../lib/prospectMatch";
import { useProspectContact } from "../../lib/useProspectContact";
import { peek } from "../../lib/dataCache";
import { queries } from "../../lib/queries";
import { useQuery } from "../../lib/useQuery";
import ProspectCard from "../../components/ProspectCard";
import ProspectImportModal from "../../components/ProspectImportModal";
import "./admin.css";
import "./AdminProspects.css";

// Embudo de prospectos por etapas. RLS recorta del lado de Supabase: un asesor
// con login vinculado ve solo los suyos; un correo sin asesor vinculado ve todos
// y puede filtrar por asesor. En pantalla ancha cada etapa es una columna; en el
// teléfono se ve una etapa a la vez, con pestañas arriba (cada una con su
// contador). Cambiar de etapa es un selector en la tarjeta (sin arrastrar:
// funciona igual con el dedo en el celular).

const NONE = [];

const normalize = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const NO_ADVISOR = "__none__"; // valor del filtro «Sin asesor»

export default function AdminProspects() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { advisorId, hasSection } = useAuth();
  const seesAll = advisorId == null;
  const canImport = hasSection("visitas");

  // Las listas salen del caché (ver dataCache.js): si ya se pidieron en otra pantalla, esta se
  // pinta al instante y se actualiza al llegar lo nuevo.
  const prospectsQ = useQuery(queries.prospects);
  const advisorsQ = useQuery(queries.advisors);
  const propertiesQ = useQuery(queries.properties);
  const visitsQ = useQuery(queries.visits, { enabled: canImport });
  const historyQ = useQuery(queries.stageHistory);
  const selectionsQ = useQuery(queries.selections);
  const prospects = prospectsQ.data ?? NONE;
  const advisors = advisorsQ.data ?? NONE;
  const properties = propertiesQ.data ?? NONE;
  const visits = visitsQ.data ?? NONE;
  const history = historyQ.data ?? NONE;
  const loading = prospectsQ.loading;
  // Sin señal la lista que ya estaba cargada sigue a la vista: el error de red solo se muestra si no hay nada que mostrar.
  const loadError = prospectsQ.data ? "" : [prospectsQ, advisorsQ, propertiesQ].find((q) => q.error)?.error.message || "";
  const setProspects = prospectsQ.mutate;
  const [busyId, setBusyId] = useState(null);
  const [importing, setImporting] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false); // «Pegar o importar lista»
  const [query, setQuery] = useState("");
  // Equipo hoy (la oficina) llega aquí ya filtrado: ?asesor=<id>|ninguno&filtro=vencidos|sin-atender|olvidados&seleccionar=1.
  const [params] = useSearchParams();
  const filtro = params.get("filtro");
  const [advisorFilter, setAdvisorFilter] = useState(() => (params.get("asesor") === "ninguno" ? NO_ADVISOR : params.get("asesor") || ""));
  const [overdueOnly, setOverdueOnly] = useState(filtro === "vencidos");
  const [unattendedOnly, setUnattendedOnly] = useState(filtro === "sin-atender");
  const [forgottenOnly, setForgottenOnly] = useState(filtro === "olvidados");
  // Etapa visible en el teléfono (en pantalla ancha se ven todas). Abre en la primera
  // etapa abierta que tenga prospectos: con la lista ya en el caché, desde el primer pintado.
  const cachedProspects = peek(queries.prospects.key);
  const [activeStage, setActiveStage] = useState(() => firstStageWithProspects(cachedProspects || []));
  const stageChosen = useRef(Boolean(cachedProspects));
  useEffect(() => {
    if (!stageChosen.current && prospectsQ.data) {
      stageChosen.current = true;
      setActiveStage(firstStageWithProspects(prospectsQ.data));
    }
  }, [prospectsQ.data]);

  // Modo «Seleccionar»: casillas en las tarjetas y una barra para cambiar de etapa, poner el seguimiento o
  // (la oficina) reasignar a varios prospectos a la vez.
  const [selecting, setSelecting] = useState(() => params.get("seleccionar") === "1");
  const [selected, setSelected] = useState(() => new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMessage, setBulkMessage] = useState("");
  const [bulkStage, setBulkStage] = useState("");
  const [bulkAdvisor, setBulkAdvisor] = useState("");

  // El formulario "Registrar contacto" de una tarjeta: al guardar el contacto
  // el prospecto se actualiza aquí (último contacto, etapa y seguimiento).
  const contact = useProspectContact({
    onUpdated: (updated) => setProspects((prev) => prev.map((p) => (p.id === updated.id ? updated : p))),
  });

  const advisorName = (id) => advisors.find((a) => a.id === id)?.name || "";
  const propertyTitle = (id) => properties.find((p) => p.id === id)?.title || "";

  // Visitas marcadas como "posible cliente" que aún no son prospecto.
  const importable = useMemo(() => {
    const imported = new Set(prospects.map((p) => p.visit_id).filter(Boolean));
    return visits.filter((v) => v.potential_client && !imported.has(v.id));
  }, [visits, prospects]);

  // Propiedades disponibles que encajan con lo que busca cada prospecto abierto.
  const matchesByProspect = useMemo(() => new Map(prospects.map((p) => [p.id, matchingProperties(p, properties)])), [prospects, properties]);

  const activeAdvisorIds = useMemo(() => new Set(advisors.filter((a) => a.active !== false).map((a) => a.id)), [advisors]);
  const filtered = useMemo(() => {
    const q = normalize(query);
    return prospects.filter((p) => {
      // «Sin asesor» incluye a los de un asesor que ya no está activo (también necesitan dueño).
      if (advisorFilter === NO_ADVISOR ? p.advisor_id && activeAdvisorIds.has(p.advisor_id) : advisorFilter && p.advisor_id !== advisorFilter) return false;
      if (overdueOnly && followUpState(p) !== "overdue") return false;
      if (unattendedOnly && !unattendedState(p)) return false;
      if (forgottenOnly && !isForgotten(p)) return false;
      if (!q) return true;
      return [p.name, p.phone, p.email, p.looking_for, propertyTitle(p.property_id)].some((v) => normalize(v).includes(q));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prospects, query, advisorFilter, overdueOnly, unattendedOnly, forgottenOnly, activeAdvisorIds, properties]);

  // Si se llegó con filtros en la dirección (Equipo hoy), en el teléfono el tablero abre en la primera etapa que tenga algo de lo filtrado.
  const filtersFromUrl = useRef(Boolean(params.get("asesor") || params.get("filtro")));
  useEffect(() => {
    if (filtersFromUrl.current && prospectsQ.data) {
      filtersFromUrl.current = false;
      setActiveStage(firstStageWithProspects(filtered));
    }
  }, [prospectsQ.data, filtered]);

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

  // Los elegidos que siguen a la vista (un filtro nuevo no deja acciones sobre prospectos escondidos).
  const picked = useMemo(() => filtered.filter((p) => selected.has(p.id)), [filtered, selected]);

  const toggleOne = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Todos los de una etapa: los marca, o los desmarca si ya estaban todos marcados.
  const toggleColumn = (items) =>
    setSelected((prev) => {
      const next = new Set(prev);
      const all = items.every((p) => next.has(p.id));
      items.forEach((p) => (all ? next.delete(p.id) : next.add(p.id)));
      return next;
    });

  const toggleSelecting = () => {
    setSelecting((on) => !on);
    setSelected(new Set());
    setBulkOpen(false);
    setBulkMessage("");
  };

  // Aplica la acción a los elegidos, uno por uno (ver applyBulk), y avisa qué pasó.
  const runBulk = async (kind, value) => {
    if (picked.length === 0) return;
    setBulkBusy(true);
    setBulkMessage("");
    try {
      const { updated, skipped, failed } = await applyBulk(db, picked, kind, value);
      if (updated.length > 0) {
        const byId = new Map(updated.map((r) => [r.id, r]));
        setProspects((prev) => prev.map((p) => byId.get(p.id) ?? p));
        // En el teléfono las tarjetas se van a la pestaña de su nueva etapa: se sigue viendo.
        if (kind === "stage") setActiveStage(value);
      }
      const parts = [];
      if (updated.length > 0) parts.push(t("bulkActions.done", { count: updated.length }));
      else if (failed === 0) parts.push(t("prospects.bulk.nothing"));
      if (skipped > 0 && updated.length > 0) parts.push(t("prospects.bulk.skipped", { count: skipped }));
      if (failed > 0) parts.push(t("bulkActions.someFailed"));
      setBulkMessage(parts.join(" "));
    } finally {
      setBulkBusy(false);
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
          <button type="button" className={`btn btn-outline${selecting ? " is-active" : ""}`} onClick={toggleSelecting} aria-pressed={selecting}>
            {selecting ? t("prospects.bulk.exit") : t("prospects.bulk.select")}
          </button>
          <button type="button" className="btn btn-outline" onClick={() => setPasteOpen(true)}>
            {t("prospectImport.open")}
          </button>
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
            <option value={NO_ADVISOR}>{t("prospects.noAdvisor")}</option>
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
        <label className="prospect-filters__check">
          <input type="checkbox" checked={forgottenOnly} onChange={(e) => setForgottenOnly(e.target.checked)} />
          {t("prospects.forgottenOnly")}
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
                  {selecting && items.length > 0 && (
                    <label className="prospect-col__select-all">
                      <input type="checkbox" checked={items.every((p) => selected.has(p.id))} onChange={() => toggleColumn(items)} />
                      {t("prospects.bulk.selectAll", { count: items.length })}
                    </label>
                  )}
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
                      selectable={selecting}
                      selected={selected.has(p.id)}
                      onToggleSelect={toggleOne}
                      selections={selectionsQ.data}
                    />
                  ))}
                </section>
              );
            })}
          </div>

          {selecting && (
            <div className="prospect-bulk" role="region" aria-label={t("prospects.bulk.label")}>
              {picked.length > 0 && bulkOpen && (
                <div className="prospect-bulk__panel card">
                  <div className="prospect-bulk__group">
                    <span className="prospect-bulk__label">{t("prospects.bulk.stageLabel")}</span>
                    <div className="prospect-bulk__row">
                      <select value={bulkStage} onChange={(e) => setBulkStage(e.target.value)} disabled={bulkBusy} aria-label={t("prospects.bulk.stageLabel")}>
                        <option value="">{t("prospects.bulk.choose")}</option>
                        {PROSPECT_STAGES.map((stage) => (
                          <option key={stage} value={stage}>
                            {t(`prospects.stages.${stage}`)}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        aria-label={`${t("bulkActions.applyStatus")}: ${t("prospects.bulk.stageLabel")}`}
                        onClick={() => runBulk("stage", bulkStage)}
                        disabled={bulkBusy || !bulkStage}
                      >
                        {t("bulkActions.applyStatus")}
                      </button>
                    </div>
                  </div>

                  <div className="prospect-bulk__group">
                    <span className="prospect-bulk__label">{t("prospects.bulk.followupLabel")}</span>
                    <div className="prospect-bulk__row">
                      {FOLLOWUP_OPTIONS.map((option) => (
                        <button key={option.key} type="button" className="btn btn-outline btn-sm" onClick={() => runBulk("followup", followupDate(option.days))} disabled={bulkBusy}>
                          {t(`prospects.followupOptions.${option.key}`)}
                        </button>
                      ))}
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => runBulk("followup", followupDate(null))} disabled={bulkBusy}>
                        {t("prospects.noFollowup")}
                      </button>
                    </div>
                  </div>

                  {seesAll && (
                    <div className="prospect-bulk__group">
                      <span className="prospect-bulk__label">{t("prospects.bulk.advisorLabel")}</span>
                      <div className="prospect-bulk__row">
                        <select value={bulkAdvisor} onChange={(e) => setBulkAdvisor(e.target.value)} disabled={bulkBusy} aria-label={t("prospects.bulk.advisorLabel")}>
                          <option value="">{t("prospects.bulk.choose")}</option>
                          {advisors
                            .filter((a) => a.active !== false)
                            .map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.name}
                              </option>
                            ))}
                        </select>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          aria-label={`${t("bulkActions.applyStatus")}: ${t("prospects.bulk.advisorLabel")}`}
                          onClick={() => runBulk("advisor", bulkAdvisor)}
                          disabled={bulkBusy || !bulkAdvisor}
                        >
                          {t("bulkActions.applyStatus")}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {bulkMessage && (
                <p className="prospect-bulk__message card" role="status">
                  {bulkMessage}
                </p>
              )}
              <div className="prospect-bulk__bar card">
                <span className="prospect-bulk__count">{picked.length > 0 ? t("bulkActions.selectedCount", { count: picked.length }) : t("prospects.bulk.hint")}</span>
                {picked.length > 0 && (
                  <>
                    <button type="button" className="btn btn-primary btn-sm" aria-expanded={bulkOpen} onClick={() => setBulkOpen((open) => !open)}>
                      {t("prospects.bulk.actions")} {bulkOpen ? "▾" : "▴"}
                    </button>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => setSelected(new Set())} disabled={bulkBusy}>
                      {t("bulkActions.clearSelection")}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}
      {pasteOpen && (
        <ProspectImportModal
          onClose={() => setPasteOpen(false)}
          onImported={(created) => {
            setProspects((prev) => [...created, ...(prev || [])]);
            setActiveStage("nuevo"); // en el teléfono el tablero va a donde quedaron los recién importados
          }}
        />
      )}
    </div>
  );
}
