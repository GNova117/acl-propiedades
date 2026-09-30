import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { advisorVisitStats, inMonth, monthLabel, monthOptions, topReasons } from "../lib/visitMonthly";
import { percentages, reasonLabel } from "../lib/visitReport";

// Resumen por asesor y motivos más comunes de no venta, por mes o de todo el
// tiempo. Solo lo ve quien puede ver las visitas de todos (con un asesor
// vinculado la lista ya viene recortada a las suyas y el resumen no tendría
// sentido).
export default function VisitsByAdvisor({ visits, advisors }) {
  const { t, i18n } = useTranslation();
  const [period, setPeriod] = useState("");
  const months = useMemo(() => monthOptions(12), []);
  const stats = useMemo(() => advisorVisitStats(visits, period || null), [visits, period]);
  const reasons = useMemo(() => {
    const scoped = period ? visits.filter((v) => inMonth(v.visited_at, period)) : visits;
    const list = topReasons(scoped);
    const pcts = percentages(list.map((r) => r.count));
    return list.map((r, i) => ({ ...r, pct: pcts[i] }));
  }, [visits, period]);
  const name = (id) => advisors.find((a) => a.id === id)?.name || t("visits.byAdvisor.unassigned");

  return (
    <section className="card" style={{ padding: "1rem", marginBottom: "1.25rem" }}>
      <h2 style={{ marginTop: 0 }}>{t("visits.byAdvisor.title")}</h2>
      <div className="form-field" style={{ maxWidth: 280 }}>
        <label htmlFor="vba-period">{t("visits.monthly.period")}</label>
        <select id="vba-period" value={period} onChange={(e) => setPeriod(e.target.value)}>
          <option value="">{t("visits.monthly.allTime")}</option>
          {months.map((value) => (
            <option key={value} value={value}>
              {monthLabel(value, i18n.language)}
            </option>
          ))}
        </select>
      </div>
      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>{t("visits.table.advisor")}</th>
              <th>{t("visits.byAdvisor.clients")}</th>
              <th>{t("visits.report.totalVisits")}</th>
              <th>{t("visits.byAdvisor.properties")}</th>
              <th>{t("visits.report.interested")}</th>
              <th>{t("visits.byAdvisor.offers")}</th>
              <th>{t("visits.potentialClient")}</th>
            </tr>
          </thead>
          <tbody>
            {stats.length === 0 ? (
              <tr>
                <td colSpan={7}>{t("visits.noMatches")}</td>
              </tr>
            ) : (
              stats.map((row) => (
                <tr key={row.advisorId || "none"}>
                  <td>{name(row.advisorId)}</td>
                  <td>
                    <strong>{row.clients}</strong>
                  </td>
                  <td>{row.visits}</td>
                  <td>{row.properties}</td>
                  <td>{row.interested}</td>
                  <td>{row.offers}</td>
                  <td>{row.potential}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="visit-note">{t("visits.byAdvisor.clientsNote")}</p>
      {reasons.length > 0 && (
        <>
          <h3>{t("visits.byAdvisor.reasonsTitle")}</h3>
          <ul className="vr-chips">
            {reasons.map((r) => (
              <li key={r.key}>
                {reasonLabel(t, r.key)} · {r.pct}% ({r.count})
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
