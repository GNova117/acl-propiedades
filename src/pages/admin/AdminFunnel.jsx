import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { useAuth } from "../../context/AuthContext";
import { computeFunnel } from "../../lib/funnelStats";
import "./admin.css";
import "./AdminFunnel.css";

const PERIODS = [30, 90, 365, 0];

// Estadísticas del embudo de prospectos. RLS ya recorta del lado de Supabase: un
// asesor con login vinculado ve solo las cifras de SUS prospectos; la oficina ve
// todo y puede filtrar por asesor. Los números salen de funnelStats.js (pura).
export default function AdminFunnel() {
  const { t } = useTranslation();
  const { advisorId } = useAuth();
  const seesAll = advisorId == null;
  const [prospects, setProspects] = useState([]);
  const [history, setHistory] = useState([]);
  const [advisors, setAdvisors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState(90);
  const [advisorFilter, setAdvisorFilter] = useState("");

  useEffect(() => {
    Promise.all([db.getProspects(), db.getProspectStageHistory(), db.getAdvisors().catch(() => [])])
      .then(([p, h, a]) => {
        setProspects(p);
        setHistory(h);
        setAdvisors(a);
      })
      .catch((err) => setError(err.message || t("funnel.loadError")))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(() => {
    const filtered = advisorFilter ? prospects.filter((p) => p.advisor_id === advisorFilter) : prospects;
    return computeFunnel({ prospects: filtered, history, periodDays: period || null });
  }, [prospects, history, period, advisorFilter]);

  const advisorName = (id) => advisors.find((a) => a.id === id)?.name || t("funnel.noAdvisor");
  const num = (n) => new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 }).format(n);

  const rateBar = (rate) => (
    <span className="funnel-bar funnel-bar--inline" role="img" aria-label={`${num(rate)} %`}>
      <span style={{ width: `${Math.min(100, rate)}%` }} />
    </span>
  );

  const groupTable = (title, rows, nameOf, colLabel) => (
    <div className="card funnel-card">
      <h2>{title}</h2>
      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>{colLabel}</th>
              <th>{t("funnel.colTotal")}</th>
              <th>{t("funnel.colClosed")}</th>
              <th>{t("funnel.colRate")}</th>
              <th>{t("funnel.colDays")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td>{nameOf(row.key)}</td>
                <td>{row.total}</td>
                <td>{row.closed}</td>
                <td>
                  <span className="funnel-rate">
                    {rateBar(row.rate)}
                    {num(row.rate)} %
                  </span>
                </td>
                <td>{row.avgDaysToClose == null ? "—" : num(row.avgDaysToClose)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const maxLost = Math.max(1, ...stats.lostReasons.map((r) => r.count));

  return (
    <div>
      <div className="admin-header">
        <div>
          <h1>{t("funnel.title")}</h1>
          <p className="form-hint">{t("funnel.subtitle")}</p>
        </div>
      </div>

      <div className="form-row" style={{ flexWrap: "wrap", marginBottom: "1.25rem" }}>
        <div className="form-field">
          <label htmlFor="fn-period">{t("funnel.period")}</label>
          <select id="fn-period" value={period} onChange={(e) => setPeriod(Number(e.target.value))}>
            {PERIODS.map((p) => (
              <option key={p} value={p}>
                {t(`funnel.periods.${p}`)}
              </option>
            ))}
          </select>
          <span className="form-hint">{t("funnel.periodHint")}</span>
        </div>
        {seesAll && (
          <div className="form-field">
            <label htmlFor="fn-advisor">{t("funnel.advisor")}</label>
            <select id="fn-advisor" value={advisorFilter} onChange={(e) => setAdvisorFilter(e.target.value)}>
              <option value="">{t("funnel.allAdvisors")}</option>
              {advisors.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {error && <p className="form-error">{error}</p>}
      {loading ? (
        <p className="form-hint">…</p>
      ) : stats.total === 0 ? (
        <p className="form-hint">{t("funnel.empty")}</p>
      ) : (
        <>
          <div className="funnel-kpis">
            <div className="card funnel-kpi">
              <strong>{stats.total}</strong>
              <span>{t("funnel.kpi.total")}</span>
            </div>
            <div className="card funnel-kpi">
              <strong>{stats.active}</strong>
              <span>{t("funnel.kpi.active")}</span>
            </div>
            <div className="card funnel-kpi">
              <strong>{stats.closed}</strong>
              <span>{t("funnel.kpi.closed")}</span>
            </div>
            <div className="card funnel-kpi">
              <strong>{stats.lost}</strong>
              <span>{t("funnel.kpi.lost")}</span>
            </div>
            <div className="card funnel-kpi funnel-kpi--accent">
              <strong>{num(stats.closeRate)} %</strong>
              <span>{t("funnel.kpi.rate")}</span>
            </div>
            <div className="card funnel-kpi">
              <strong>{stats.avgDaysToClose == null ? "—" : num(stats.avgDaysToClose)}</strong>
              <span>{t("funnel.kpi.days")}</span>
              <small>{stats.avgDaysToClose == null ? t("funnel.kpi.noDays") : t("funnel.kpi.daysHint", { median: num(stats.medianDaysToClose) })}</small>
            </div>
          </div>

          <div className="card funnel-card">
            <h2>{t("funnel.funnelTitle")}</h2>
            <p className="form-hint">{t("funnel.funnelHint")}</p>
            <ol className="funnel-steps">
              {stats.funnel.map((step) => (
                <li key={step.stage}>
                  <div className="funnel-step__head">
                    <span>{t(`prospects.stages.${step.stage}`)}</span>
                    <strong>
                      {step.reached} <span className="funnel-step__pct">({num(step.pctOfTotal)} %)</span>
                    </strong>
                  </div>
                  <div className="funnel-bar" role="img" aria-label={`${step.reached} · ${num(step.pctOfTotal)} %`}>
                    <span style={{ width: `${step.pctOfTotal}%` }} />
                  </div>
                  {step.conversionFromPrev != null && (
                    <span className="funnel-step__conv">
                      ↳ {t("funnel.toNext", { pct: num(step.conversionFromPrev) })}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </div>

          <div className="funnel-grid">
            {groupTable(t("funnel.bySourceTitle"), stats.bySource, (key) => t(`prospects.sources.${key}`, { defaultValue: key }), t("funnel.colName"))}
            {seesAll && !advisorFilter && groupTable(t("funnel.byAdvisorTitle"), stats.byAdvisor, advisorName, t("funnel.advisor"))}
          </div>

          <div className="card funnel-card">
            <h2>{t("funnel.lostTitle")}</h2>
            {stats.lostReasons.length === 0 ? (
              <p className="form-hint">{t("funnel.lostEmpty")}</p>
            ) : (
              <ul className="funnel-lost">
                {stats.lostReasons.map((r) => (
                  <li key={r.reason || "none"}>
                    <div className="funnel-step__head">
                      <span>{r.reason || t("funnel.noReason")}</span>
                      <strong>{r.count}</strong>
                    </div>
                    <div className="funnel-bar funnel-bar--lost" role="img" aria-label={String(r.count)}>
                      <span style={{ width: `${(r.count / maxLost) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="form-hint" style={{ marginBottom: 0 }}>{t("funnel.lostTip")}</p>
          </div>
          <p className="form-hint">{t("funnel.historyNote")}</p>
        </>
      )}
    </div>
  );
}
