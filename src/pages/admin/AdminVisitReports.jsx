import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { buildVisitReport, reasonLabel } from "../../lib/visitReport";
import {
  isReportSent,
  monthLabel,
  monthOptions,
  monthPayload,
  parseMonthValue,
  previousMonthValue,
  reportableProperties,
  setReportSent,
} from "../../lib/visitMonthly";
import "../../components/VisitReportView.css";
import "./admin.css";
import "./AdminVisits.css";

// Informes del mes para los propietarios: una fila por propiedad con lo que
// pasó ese mes (visitas, interesados, motivo más repetido) y desde ahí se abre
// el informe (con PDF y enlace) para mandarlo. Por ahora el envío es manual; la
// marca "Enviado" solo sirve para que el recordatorio del panel sepa qué falta.
export default function AdminVisitReports() {
  const { t, i18n } = useTranslation();
  const now = useMemo(() => new Date(), []);
  const [searchParams, setSearchParams] = useSearchParams();
  const month = parseMonthValue(searchParams.get("mes")) ? searchParams.get("mes") : previousMonthValue(now);
  const months = useMemo(() => monthOptions(12, now), [now]);

  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [, bump] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    Promise.all([db.getProperties({}), db.getVisits()])
      .then(async ([properties, visits]) => {
        const list = reportableProperties(properties, visits, month);
        // getVisitReport junta las visitas de TODOS los asesores (ya anonimizadas):
        // un asesor que solo ve las suyas también obtiene cifras completas.
        const payloads = await Promise.all(list.map((p) => db.getVisitReport(p.id).catch(() => null)));
        if (cancelled) return;
        setRows(
          list.map((property, i) => {
            const payload = payloads[i] ? monthPayload(payloads[i], month) : null;
            return { property, report: payload ? buildVisitReport(payload, { now }) : null };
          })
        );
        setError("");
      })
      .catch((err) => !cancelled && setError(err.message || "Error"));
    return () => {
      cancelled = true;
    };
  }, [month, now]);

  const toggleSent = (propertyId) => {
    setReportSent(month, propertyId, !isReportSent(month, propertyId));
    bump((n) => n + 1);
  };

  const pending = rows ? rows.filter((r) => !isReportSent(month, r.property.id)).length : 0;

  return (
    <div>
      <div className="admin-header">
        <div>
          <h1>{t("visits.monthly.title")}</h1>
          <p className="form-hint">{t("visits.monthly.subtitle")}</p>
        </div>
        <div className="admin-header__actions">
          <Link to="/admin/visitas" className="btn btn-outline">
            {t("visits.backToList")}
          </Link>
        </div>
      </div>

      <div className="form-field" style={{ maxWidth: 280 }}>
        <label htmlFor="vm-month">{t("visits.monthly.month")}</label>
        <select id="vm-month" value={month} onChange={(e) => setSearchParams({ mes: e.target.value }, { replace: true })}>
          {months.map((value) => (
            <option key={value} value={value}>
              {monthLabel(value, i18n.language)}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="form-error">{t("visits.loadError", { error })}</p>}
      {rows && rows.length > 0 && <p className="visit-note">{t("visits.monthly.pending", { count: pending, total: rows.length })}</p>}

      <div className="card admin-table-wrapper">
        <table className="admin-table visits-table">
          <thead>
            <tr>
              <th>{t("visits.table.property")}</th>
              <th>{t("visits.report.totalVisits")}</th>
              <th>{t("visits.report.interested")}</th>
              <th>{t("visits.report.discarded")}</th>
              <th>{t("visits.monthly.topReason")}</th>
              <th>{t("visits.monthly.sent")}</th>
              <th>{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {!rows ? (
              <tr>
                <td colSpan={7}>{t("common.loading")}</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7}>{t("visits.monthly.empty")}</td>
              </tr>
            ) : (
              rows.map(({ property, report }) => {
                const sent = isReportSent(month, property.id);
                const top = report?.reasons[0];
                return (
                  <tr key={property.id}>
                    <td>{[property.code, property.title].filter(Boolean).join(" · ")}</td>
                    <td>{report ? report.totalVisits : "—"}</td>
                    <td>{report ? report.interested : "—"}</td>
                    <td>{report ? report.discarded : "—"}</td>
                    <td>{top ? `${reasonLabel(t, top.key)} (${top.pct}%)` : "—"}</td>
                    <td>
                      <label>
                        <input type="checkbox" checked={sent} onChange={() => toggleSent(property.id)} /> {sent ? t("visits.monthly.yesSent") : t("visits.monthly.notSent")}
                      </label>
                    </td>
                    <td className="admin-table__actions">
                      <Link to={`/admin/visitas/propiedad/${property.id}?mes=${month}`} className="btn btn-primary btn-sm">
                        {t("visits.monthly.openReport")}
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
