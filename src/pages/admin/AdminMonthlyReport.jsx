import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { useAuth } from "../../context/AuthContext";
import { formatMXN } from "../../lib/format";
import { buildMonthlyReport } from "../../lib/monthlyReport";
import { KPI_ROWS, downloadMonthlyReportPdf, formatChange } from "../../lib/monthlyReportPdf";
import "./admin.css";
import "./AdminMonthlyReport.css";

const MONTHS_BACK = 18;

const sourceKeys = ["manual", "visita", "whatsapp", "simulador", "estimacion", "comparador", "sitio", "recomendacion", "redes", "otro"];
const channelKeys = ["formulario", "solicitud", "whatsapp", "simulador", "estimacion", "comparador"];

// Reporte mensual: qué pasó en el mes y cómo se compara con el anterior. Solo
// junta lo que el rol puede ver (cada sección sin acceso se omite, no se pone en
// cero) y NO incluye utilidades: esas son de los socios (Liquidaciones).
export default function AdminMonthlyReport() {
  const { t } = useTranslation();
  const { hasSection } = useAuth();
  const now = new Date();
  const [choice, setChoice] = useState(`${now.getFullYear()}-${now.getMonth()}`); // "2026-8": mes base 0
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const guarded = (section, load) => (hasSection(section) ? load().catch(() => null) : Promise.resolve(null));
    Promise.all([
      guarded("reportes", () => db.getVentas()),
      db.getProperties({}).catch(() => []),
      db.getAdvisors().catch(() => []),
      guarded("visitas", () => db.getVisits()),
      guarded("prospectos", () => db.getProspects()),
      guarded("prospectos", () => db.getProspectStageHistory()),
      guarded("valuacion", () => db.getValuationEstimates()),
      guarded("documentos_legales", () => db.getSigningRequests()),
      guarded("mensajes", () => db.getContactMessages()),
      guarded("clientes", () => db.getClients()),
    ])
      .then(([ventas, properties, advisors, visits, prospects, history, estimates, signings, messages, clients]) =>
        setData({ ventas, properties, advisors, visits, prospects, history, estimates, signings, messages, clients })
      )
      .catch((err) => setError(err.message || t("monthly.loadError")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const options = useMemo(() => {
    const list = [];
    for (let i = 0; i < MONTHS_BACK; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      list.push({ value: `${d.getFullYear()}-${d.getMonth()}`, year: d.getFullYear(), month: d.getMonth() });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [year, month] = choice.split("-").map(Number);
  const monthName = (y, m) => {
    const name = new Date(y, m, 1).toLocaleDateString("es-MX", { month: "long", year: "numeric" });
    return name.charAt(0).toUpperCase() + name.slice(1);
  };

  const report = useMemo(() => {
    if (!data) return null;
    return buildMonthlyReport({ year, month, data });
  }, [data, year, month]);

  const pdfLabels = () => ({
    title: t("monthly.pdf.title"),
    monthName: monthName(year, month),
    generated: t("monthly.pdf.generated", { date: new Date().toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short" }) }),
    kpiTitle: t("monthly.kpiTitle"),
    colConcept: t("monthly.colConcept"),
    colThis: t("monthly.colThis"),
    colPrev: t("monthly.colPrev"),
    colChange: t("monthly.colChange"),
    metrics: Object.fromEntries(KPI_ROWS.map(({ key }) => [key, t(`monthly.metrics.${key}`)])),
    salesTitle: t("monthly.salesTitle"),
    prospectsBySourceTitle: t("monthly.prospectsBySource"),
    visitsByInterestTitle: t("monthly.visitsByInterest"),
    messagesByChannelTitle: t("monthly.messagesByChannel"),
    estimatesByZoneTitle: t("monthly.estimatesByZone"),
    sources: Object.fromEntries(sourceKeys.map((k) => [k, t(`prospects.sources.${k}`, { defaultValue: k })])),
    interests: Object.fromEntries(["muy_interesado", "interesado", "oferta_realizada", "descartado"].map((k) => [k, t(`visits.interest.${k}`, { defaultValue: k })])),
    channels: Object.fromEntries(channelKeys.map((k) => [k, t(`monthly.channels.${k}`)])),
    note: t("monthly.pdf.note"),
  });

  const download = async () => {
    setBusy(true);
    try {
      await downloadMonthlyReportPdf(report, pdfLabels());
    } catch (err) {
      window.alert(err.message || t("monthly.pdfError"));
    } finally {
      setBusy(false);
    }
  };

  const cell = (v, money) => (v == null ? "—" : money ? formatMXN(v) : new Intl.NumberFormat("es-MX").format(v));
  const Group = ({ title, rows, nameOf }) =>
    rows && rows.length > 0 ? (
      <div className="card monthly-card">
        <h2>{title}</h2>
        <ul className="monthly-list">
          {rows.map((r) => (
            <li key={r.key}>
              <span>{nameOf(r.key)}</span>
              <strong>{r.total}</strong>
            </li>
          ))}
        </ul>
      </div>
    ) : null;

  return (
    <div>
      <div className="admin-header">
        <div>
          <h1>{t("monthly.title")}</h1>
          <p className="form-hint">{t("monthly.subtitle")}</p>
        </div>
        <div className="admin-header__actions">
          <button type="button" className="btn btn-primary" onClick={download} disabled={!report || busy}>
            {busy ? <span className="spinner" /> : null}
            {t("monthly.download")}
          </button>
        </div>
      </div>

      <div className="form-field" style={{ maxWidth: 280, marginBottom: "1.25rem" }}>
        <label htmlFor="mr-month">{t("monthly.month")}</label>
        <select id="mr-month" value={choice} onChange={(e) => setChoice(e.target.value)}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {monthName(o.year, o.month)}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="form-error">{error}</p>}
      {!report ? (
        <p className="form-hint">…</p>
      ) : (
        <>
          <div className="card monthly-card">
            <h2>{t("monthly.kpiTitle")}</h2>
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>{t("monthly.colConcept")}</th>
                    <th>{monthName(year, month)}</th>
                    <th>{t("monthly.colPrev")}</th>
                    <th>{t("monthly.colChange")}</th>
                  </tr>
                </thead>
                <tbody>
                  {KPI_ROWS.filter(({ key }) => report.current[key] != null).map(({ key, money }) => (
                    <tr key={key}>
                      <td>{t(`monthly.metrics.${key}`)}</td>
                      <td>
                        <strong>{cell(report.current[key], money)}</strong>
                      </td>
                      <td>{cell(report.previous[key], money)}</td>
                      <td>{formatChange(report.current[key], report.previous[key], money)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="form-hint" style={{ marginBottom: 0 }}>
              {t("monthly.scopeNote")}
            </p>
          </div>

          {report.sales && report.sales.length > 0 && (
            <div className="card monthly-card">
              <h2>{t("monthly.salesTitle")}</h2>
              <ul className="monthly-list">
                {report.sales.map((s) => (
                  <li key={`${s.date}-${s.title}`}>
                    <span>
                      {s.date.split("-").reverse().join("/")} · {s.title}
                      {s.advisor ? ` · ${s.advisor}` : ""}
                    </span>
                    <strong>{formatMXN(s.price)}</strong>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="monthly-grid">
            <Group title={t("monthly.prospectsBySource")} rows={report.prospectsBySource} nameOf={(k) => t(`prospects.sources.${k}`, { defaultValue: k })} />
            <Group title={t("monthly.visitsByInterest")} rows={report.visitsByInterest} nameOf={(k) => t(`visits.interest.${k}`, { defaultValue: k })} />
            <Group title={t("monthly.messagesByChannel")} rows={report.messagesByChannel} nameOf={(k) => t(`monthly.channels.${k}`, { defaultValue: k })} />
            <Group title={t("monthly.estimatesByZone")} rows={report.estimatesByZone} nameOf={(k) => k} />
          </div>
        </>
      )}
    </div>
  );
}
