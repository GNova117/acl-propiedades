import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { formatMXN } from "../../lib/format";
import { MUNICIPALITIES, PROFILES, rateText } from "../../lib/expenseBreakdown";
import { formatVisitDateTime } from "../../lib/visitReport";
import "./admin.css";

// Historial de desgloses guardados por casa: cada fila es la copia exacta que
// se guardó ese día (rubros con nombre, tarifa y monto). Aunque después cambie
// una tarifa en /admin/gastos, estos registros no se recalculan: el PDF de un
// registro viejo sale con lo mismo que se le mostró a esa casa en su momento.
export default function AdminExpenseHistory() {
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [reports, setReports] = useState(null);
  const [error, setError] = useState("");
  const [house, setHouse] = useState(searchParams.get("casa") || "");
  const [municipality, setMunicipality] = useState("");
  const [profile, setProfile] = useState("");
  const [pdfBusyId, setPdfBusyId] = useState(null);

  const load = () =>
    db
      .getExpenseReports()
      .then((rows) => {
        setReports(rows);
        setError("");
      })
      .catch((err) => setError(err.message || "Error"));

  useEffect(() => {
    load();
  }, []);

  const visible = useMemo(() => {
    if (!reports) return [];
    const needle = house.trim().toLowerCase();
    return reports.filter(
      (r) => (!needle || r.house_name.toLowerCase().includes(needle)) && (!municipality || r.municipality === municipality) && (!profile || r.profile === profile)
    );
  }, [reports, house, municipality, profile]);

  const remove = async (id) => {
    if (!window.confirm(t("expenses.history.confirmDelete"))) return;
    try {
      await db.deleteExpenseReport(id);
      load();
    } catch (err) {
      window.alert(err.message || "Error");
    }
  };

  const viewPdf = async (report) => {
    setPdfBusyId(report.id);
    try {
      const { downloadExpenseBreakdownPdf } = await import("../../lib/expenseBreakdownPdf");
      await downloadExpenseBreakdownPdf(
        {
          title: t("expenses.pdf.title"),
          profileLine: `${t(`expenses.${report.profile}`)} · ${report.municipality}`,
          detailLines: [
            `${t("expenses.house")}: ${report.house_name}`,
            report.price > 0 && `${t("expenses.price")}: ${formatMXN(report.price)}`,
            report.profile === "comprador" && report.credit > 0 && `${t("expenses.creditAmount")}: ${formatMXN(report.credit)}`,
          ].filter(Boolean),
          generatedLine: t("expenses.pdf.generated", { date: formatVisitDateTime(report.created_at, i18n.language) }),
          colConcept: t("expenses.concept"),
          colRate: t("expenses.rate"),
          colAmount: t("expenses.amount"),
          totalLabel: t("expenses.total"),
          total: formatMXN(report.total),
          note: t("expenses.copyNote"),
          empty: t("expenses.empty"),
          rows: report.items.map((it) => ({ name: it.name, rate: rateText(it, t), amount: formatMXN(it.amount) })),
        },
        `desglose-gastos-${report.profile}-${report.house_name}`
      );
    } catch (err) {
      window.alert(err.message || t("expenses.pdf.error"));
    } finally {
      setPdfBusyId(null);
    }
  };

  return (
    <div>
      <div className="admin-header">
        <div>
          <h1>{t("expenses.history.title")}</h1>
          <p className="form-hint">{t("expenses.history.subtitle")}</p>
        </div>
        <div className="admin-header__actions">
          <Link to="/admin/gastos" className="btn btn-outline">
            {t("expenses.history.backToExpenses")}
          </Link>
        </div>
      </div>

      <div className="card" style={{ padding: "1rem", marginBottom: "1.25rem", display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <div className="form-field">
          <label htmlFor="eh-house">{t("expenses.history.searchHouse")}</label>
          <input
            id="eh-house"
            type="text"
            value={house}
            onChange={(e) => {
              setHouse(e.target.value);
              setSearchParams(e.target.value ? { casa: e.target.value } : {}, { replace: true });
            }}
          />
        </div>
        <div className="form-field">
          <label htmlFor="eh-muni">{t("expenses.municipality")}</label>
          <select id="eh-muni" value={municipality} onChange={(e) => setMunicipality(e.target.value)}>
            <option value="">{t("expenses.history.allMunicipalities")}</option>
            {MUNICIPALITIES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="eh-profile">{t("expenses.profile")}</label>
          <select id="eh-profile" value={profile} onChange={(e) => setProfile(e.target.value)}>
            <option value="">{t("expenses.history.allProfiles")}</option>
            {PROFILES.map((p) => (
              <option key={p} value={p}>
                {t(`expenses.${p}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="form-error">{t("expenses.history.loadError", { error })}</p>}

      <div className="card admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>{t("expenses.history.colDate")}</th>
              <th>{t("expenses.history.colHouse")}</th>
              <th>{t("expenses.history.colMunicipality")}</th>
              <th>{t("expenses.history.colProfile")}</th>
              <th>{t("expenses.history.colTotal")}</th>
              <th>{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {!reports ? (
              <tr>
                <td colSpan={6}>{t("common.loading")}</td>
              </tr>
            ) : visible.length === 0 ? (
              <tr>
                <td colSpan={6}>{reports.length === 0 ? t("expenses.history.empty") : t("expenses.history.noMatches")}</td>
              </tr>
            ) : (
              visible.map((r) => (
                <tr key={r.id}>
                  <td>{formatVisitDateTime(r.created_at, i18n.language)}</td>
                  <td>{r.house_name}</td>
                  <td>{r.municipality}</td>
                  <td>{t(`expenses.${r.profile}`)}</td>
                  <td>{formatMXN(r.total)}</td>
                  <td className="admin-table__actions">
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => viewPdf(r)} disabled={pdfBusyId === r.id}>
                      {pdfBusyId === r.id ? <span className="spinner" /> : null}
                      {t("expenses.history.viewPdf")}
                    </button>
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => remove(r.id)}>
                      {t("common.delete")}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
