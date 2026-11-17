import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { formatMXN } from "../../lib/format";
import { summarizeByAdvisor } from "../../lib/commissions";
import { queries } from "../../lib/queries";
import { useQuery } from "../../lib/useQuery";
import "./admin.css";
import "../../components/CommissionsCard.css";
import LoadingState from "../../components/LoadingState";
import { confirmDialog } from "../../lib/toast";

const NONE = [];

// «Comisiones»: todas las comisiones registradas desde las liquidaciones, por asesor y estado, con lo que se debe y lo
// que ya se pagó. Solo la ven y manejan los socios (RLS; el apartado de Liquidaciones da la ruta, la base decide).
export default function AdminCommissions() {
  const { t } = useTranslation();
  const commissionsQ = useQuery(queries.commissions);
  const advisorsQ = useQuery(queries.advisors);
  const propertiesQ = useQuery(queries.properties);
  const [advisorFilter, setAdvisorFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("pendiente");
  const [error, setError] = useState("");
  const [payDate, setPayDate] = useState({});
  const rows = commissionsQ.data ?? NONE;
  const advisors = advisorsQ.data ?? NONE;
  const properties = propertiesQ.data ?? NONE;
  const today = new Date().toLocaleDateString("en-CA");

  const visible = useMemo(() => rows.filter((r) => (!advisorFilter || r.advisor_id === advisorFilter) && (!statusFilter || r.status === statusFilter)), [rows, advisorFilter, statusFilter]);
  const totals = useMemo(() => summarizeByAdvisor(rows), [rows]);
  const name = (id) => advisors.find((a) => a.id === id)?.name || "—";
  const title = (id) => properties.find((p) => p.id === id)?.title || "—";

  const act = async (fn) => {
    setError("");
    try {
      await fn();
      await commissionsQ.reload();
    } catch {
      setError(t("commissions.errors.generic"));
    }
  };

  return (
    <div>
      <div className="admin-header">
        <h1>{t("commissions.navTitle")}</h1>
      </div>
      <p className="form-hint">{t("commissions.pageHint")}</p>

      {totals.length > 0 && (
        <div className="admin-stats">
          {totals.map((entry) => (
            <div key={entry.advisor_id} className="card admin-stat">
              <strong>{name(entry.advisor_id)}</strong>
              <span>{t("commissions.owed", { amount: formatMXN(entry.pending) })}</span>
              <span className="form-hint">{t("commissions.paidTotal", { amount: formatMXN(entry.paid) })}</span>
            </div>
          ))}
        </div>
      )}

      <div className="agenda-filters">
        <div className="form-field">
          <label htmlFor="comm-advisor">{t("commissions.advisor")}</label>
          <select id="comm-advisor" value={advisorFilter} onChange={(e) => setAdvisorFilter(e.target.value)}>
            <option value="">{t("commissions.all")}</option>
            {advisors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="comm-status">{t("commissions.status")}</label>
          <select id="comm-status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">{t("commissions.all")}</option>
            <option value="pendiente">{t("commissions.pending")}</option>
            <option value="pagada">{t("commissions.paidState")}</option>
          </select>
        </div>
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {commissionsQ.loading ? (
        <LoadingState variant="lines" />
      ) : visible.length === 0 ? (
        <p className="card empty-state">{t("commissions.empty")}</p>
      ) : (
        <ul className="commissions-card__list">
          {visible.map((r) => (
            <li key={r.id} className="card commissions-card__item">
              <div>
                <strong>{name(r.advisor_id)}</strong> · {t(`commissions.concepts.${r.concept}`)} · <strong>{formatMXN(r.amount)}</strong>{" "}
                <span className={`prospect-chip${r.status === "pagada" ? "" : " prospect-chip--today"}`}>{r.status === "pagada" ? t("commissions.paidOn", { date: r.paid_on }) : t("commissions.pending")}</span>
                <p className="form-hint">
                  <Link to={`/admin/propiedades/${r.property_id}/liquidacion`}>{title(r.property_id)}</Link>
                </p>
              </div>
              <div className="commissions-card__actions">
                {r.status === "pendiente" ? (
                  <>
                    <input type="date" max={today} value={payDate[r.id] ?? today} onChange={(e) => setPayDate((d) => ({ ...d, [r.id]: e.target.value }))} aria-label={t("commissions.payDate")} />
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => act(() => db.setCommissionPaid(r.id, payDate[r.id] ?? today))}>
                      {t("commissions.markPaid")}
                    </button>
                  </>
                ) : (
                  <button type="button" className="btn btn-outline btn-sm" onClick={async () => await confirmDialog(t("commissions.confirmUndo")) && act(() => db.setCommissionPaid(r.id, null))}>
                    {t("commissions.undoPaid")}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
