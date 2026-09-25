import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { isSupabaseConfigured } from "../../lib/supabaseClient";
import "./admin.css";

const PAGE_SIZE = 100;
const ACTION_CLASS = { INSERT: "badge-available", UPDATE: "badge-reserved", DELETE: "badge-sold" };

// Registro de actividad: quién creó, editó o borró qué. Lo escriben triggers de
// Supabase (ver schema.sql), solo lo ven roles con el apartado 'roles' y nadie
// puede editarlo ni borrarlo desde la app. Guarda el NOMBRE de las columnas que
// cambiaron, no sus valores.
export default function AdminActivity() {
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [tableFilter, setTableFilter] = useState("");
  const [actorFilter, setActorFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const filters = useMemo(
    () => ({ table: tableFilter, actor: actorFilter.trim(), from: fromDate, to: toDate }),
    [tableFilter, actorFilter, fromDate, toDate]
  );

  const load = async (offset) => {
    setLoading(true);
    setError("");
    try {
      const data = await db.getAuditLog({ ...filters, limit: PAGE_SIZE, offset });
      setRows((prev) => (offset === 0 ? data : [...prev, ...data]));
      setHasMore(data.length === PAGE_SIZE);
    } catch (err) {
      setError(err.message || t("activity.loadError"));
    } finally {
      setLoading(false);
    }
  };

  // Recarga desde cero cuando cambia un filtro (con una pausa breve al teclear el correo).
  useEffect(() => {
    const timer = setTimeout(() => load(0), 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const tableLabel = (name) => t(`activity.tables.${name}`, { defaultValue: name });
  const tableOptions = Object.keys(t("activity.tables", { returnObjects: true }) || {});

  return (
    <div>
      <div className="admin-header">
        <div>
          <h1>{t("activity.title")}</h1>
          <p className="form-hint">{t("activity.subtitle")}</p>
        </div>
      </div>

      {!isSupabaseConfigured && <p className="form-hint">{t("activity.demoNote")}</p>}

      <div className="form-row" style={{ flexWrap: "wrap", marginBottom: "1.25rem" }}>
        <div className="form-field">
          <label htmlFor="act-table">{t("activity.filterTable")}</label>
          <select id="act-table" value={tableFilter} onChange={(e) => setTableFilter(e.target.value)}>
            <option value="">{t("activity.all")}</option>
            {tableOptions.map((name) => (
              <option key={name} value={name}>
                {tableLabel(name)}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="act-actor">{t("activity.filterActor")}</label>
          <input id="act-actor" type="search" value={actorFilter} onChange={(e) => setActorFilter(e.target.value)} placeholder="correo@…" />
        </div>
        <div className="form-field">
          <label htmlFor="act-from">{t("activity.from")}</label>
          <input id="act-from" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="act-to">{t("activity.to")}</label>
          <input id="act-to" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="card admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>{t("activity.when")}</th>
              <th>{t("activity.who")}</th>
              <th>{t("activity.action")}</th>
              <th>{t("activity.what")}</th>
              <th>{t("activity.record")}</th>
              <th>{t("activity.changed")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={6}>{t("activity.empty")}</td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{new Date(row.at).toLocaleString("es-MX", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                <td>{row.actor || t("activity.system")}</td>
                <td>
                  <span className={`badge ${ACTION_CLASS[row.action] || ""}`}>{t(`activity.actions.${row.action}`, { defaultValue: row.action })}</span>
                </td>
                <td>{tableLabel(row.table_name)}</td>
                <td style={{ whiteSpace: "normal", maxWidth: 260 }}>{row.label || "—"}</td>
                <td style={{ whiteSpace: "normal", maxWidth: 260 }} className="form-hint">
                  {(row.changed || []).join(", ")}
                </td>
              </tr>
            ))}
            {loading && (
              <tr>
                <td colSpan={6}>{t("common.loading")}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {hasMore && !loading && (
        <button type="button" className="btn btn-outline" style={{ marginTop: "1rem" }} onClick={() => load(rows.length)}>
          {t("activity.loadMore")}
        </button>
      )}
    </div>
  );
}
