import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { useAuth } from "../../context/AuthContext";
import { formatMXN } from "../../lib/format";
import { buildMySales, rowsOfYear, salesYears, summarizeYear } from "../../lib/mySales";
import "./admin.css";
import "./AdminMySales.css";

// «Mis ventas y comisiones» (solo con un login vinculado a un asesor, sin pedir ningún apartado): sus ventas por año y mes y la
// comisión que la oficina publicó de cada casa (ver lib/mySales.js). La liquidación completa no sale de la oficina: aquí solo
// llega el monto de cada quien. Una venta cuya comisión aún no se publica sale como «Pendiente», nunca como $0.
export default function AdminMySales() {
  const { t, i18n } = useTranslation();
  const { advisorId } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [year, setYear] = useState(() => new Date().getFullYear());
  const locale = i18n.language?.startsWith("en") ? "en-US" : "es-MX";

  useEffect(() => {
    if (advisorId == null) return undefined;
    let cancelled = false;
    // Sin la tabla de comisiones publicadas (SQL sin correr) las ventas se ven igual, con la comisión pendiente.
    Promise.all([db.getVentas(), db.getProperties({}), db.getAdvisorCommissions().catch(() => [])])
      .then(([ventas, properties, commissions]) => !cancelled && setData({ ventas, properties, commissions }))
      .catch((err) => !cancelled && setError(err.message || t("mySales.loadError")));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advisorId]);

  const rows = useMemo(() => (data ? buildMySales({ ...data, advisorId }) : []), [data, advisorId]);
  const years = useMemo(() => salesYears(rows), [rows]);
  const summary = useMemo(() => summarizeYear(rows, year), [rows, year]);
  const yearRows = useMemo(() => rowsOfYear(rows, year), [rows, year]);

  if (advisorId == null) return <div className="empty-state">{t("accessControl.restricted")}</div>;
  if (error) return <div className="empty-state">{error}</div>;
  if (!data) return <div className="empty-state">{t("common.loading")}</div>;

  const monthName = (index) => new Date(year, index, 1).toLocaleDateString(locale, { month: "long" });
  const dayLabel = (fecha) => new Date(`${fecha}T00:00:00`).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
  const activeMonths = summary.months.map((m, index) => ({ ...m, index })).filter((m) => m.count > 0 || m.commission > 0);
  const maxVolume = Math.max(1, ...summary.months.map((m) => m.volume));

  return (
    <div className="my-sales">
      <div className="admin-header">
        <div>
          <h1>{t("mySales.title")}</h1>
          <p className="form-hint">{t("mySales.hint")}</p>
        </div>
        <div className="form-field my-sales__year">
          <label htmlFor="ms-year">{t("mySales.year")}</label>
          <select id="ms-year" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="admin-stats">
        <div className="card admin-stat-card">
          <span className="admin-stat-card__value">{summary.count}</span>
          <span className="admin-stat-card__label">{t("mySales.kpi.count")}</span>
        </div>
        <div className="card admin-stat-card">
          <span className="admin-stat-card__value">{formatMXN(summary.volume)}</span>
          <span className="admin-stat-card__label">{t("mySales.kpi.volume")}</span>
        </div>
        <div className="card admin-stat-card">
          <span className="admin-stat-card__value">{formatMXN(summary.commission)}</span>
          <span className="admin-stat-card__label">{t("mySales.kpi.commission")}</span>
        </div>
      </div>

      {summary.pending > 0 && (
        <p className="card my-sales__pending" role="status">
          {t("mySales.pendingNote", { count: summary.pending, year })}
        </p>
      )}

      {yearRows.length === 0 ? (
        <p className="card my-sales__empty">{t("mySales.empty", { year })}</p>
      ) : (
        <>
          <section className="card my-sales__months" aria-label={t("mySales.monthChart")}>
            <h2>{t("mySales.byMonth")}</h2>
            <ul>
              {activeMonths.map((m) => (
                <li key={m.index}>
                  <span className="my-sales__month-name">{monthName(m.index)}</span>
                  <span className="my-sales__bar" aria-hidden="true">
                    <span style={{ width: `${m.volume > 0 ? Math.max(4, Math.round((m.volume / maxVolume) * 100)) : 0}%` }} />
                  </span>
                  <span className="my-sales__month-line">
                    {m.count > 0 && m.commission === 0
                      ? t("mySales.monthLinePending", { count: m.count })
                      : t("mySales.monthLine", { count: m.count, commission: formatMXN(m.commission) })}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <ul className="my-sales__list">
            {yearRows.map((row) => (
              <li key={row.propertyId} className="card my-sales__row">
                <div className="my-sales__main">
                  <strong>{row.property?.title || "—"}</strong>
                  <span className="form-hint">
                    {[dayLabel(row.fecha), row.price ? formatMXN(row.price) : null].filter(Boolean).join(" · ")}
                  </span>
                  <span className="my-sales__chips">
                    {row.sold && <span className="my-sales__chip">{t("mySales.sold")}</span>}
                    {row.roles.includes("captacion") && <span className="my-sales__chip">{t("mySales.captured")}</span>}
                  </span>
                </div>
                <div className="my-sales__commission">
                  <span className="form-hint">{t("mySales.table.commission")}</span>
                  {row.commission == null ? <span className="my-sales__pending-chip">{t("mySales.pending")}</span> : <strong>{formatMXN(row.commission)}</strong>}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="form-hint">{t("mySales.disclaimer")}</p>
    </div>
  );
}
